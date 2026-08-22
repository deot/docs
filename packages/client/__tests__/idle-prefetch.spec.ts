// @vitest-environment jsdom

import { flushPromises } from '@vue/test-utils';
import type { DocsConfig, ResourceIdentity } from '../src/types';

const { build, prefetch } = vi.hoisted(() => ({
	build: vi.fn(),
	prefetch: vi.fn()
}));

import { IdlePrefetchScheduler } from '../src/modules/resource/prefetch';

const IdlePrefetch = new IdlePrefetchScheduler(
	{ prefetch } as never,
	{ build } as never
);

const identity = (source: string): ResourceIdentity => ({
	namespace: 'idle-test',
	lang: 'zh-CN',
	type: 'markdown',
	source
});

const config = (prefetchConfig?: DocsConfig['prefetch']): DocsConfig => ({
	locales: { 'zh-CN': { label: '简体中文' } },
	namespace: 'idle-test',
	prefetch: prefetchConfig,
	routes: {}
});

const fulfilled = (value: unknown) => ({ status: 'fulfilled' as const, value });
const rejected = (reason: unknown) => ({ status: 'rejected' as const, reason });

describe('idle resource prefetch', () => {
	let callbacks: Map<number, () => void>;
	let nextId: number;
	let cancelIdleCallback: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		vi.clearAllMocks();
		callbacks = new Map();
		nextId = 0;
		vi.stubGlobal('requestIdleCallback', vi.fn((callback: () => void) => {
			const id = ++nextId;
			callbacks.set(id, callback);
			return id;
		}));
		cancelIdleCallback = vi.fn((id: number) => callbacks.delete(id));
		vi.stubGlobal('cancelIdleCallback', cancelIdleCallback);
		prefetch.mockImplementation(async (identities: ResourceIdentity[]) => (
			identities.map(value => fulfilled(value))
		));
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	const flushIdle = async () => {
		const callback = callbacks.values().next().value;
		expect(callback).toBeTypeOf('function');
		callbacks.delete(callbacks.keys().next().value!);
		callback!();
		await flushPromises();
	};

	it('normalizes the public boolean and object configuration', () => {
		expect(IdlePrefetch.normalizeOptions(false)).toBeNull();
		expect(IdlePrefetch.normalizeOptions(undefined)).toEqual({
			batchSize: 2,
			idleTimeout: 1500
		});
		expect(IdlePrefetch.normalizeOptions({ batchSize: 3.9, idleTimeout: 0 })).toEqual({
			batchSize: 3,
			idleTimeout: 0
		});
		expect(IdlePrefetch.normalizeOptions({ batchSize: 100, idleTimeout: -1 })).toEqual({
			batchSize: 20,
			idleTimeout: 1500
		});
		expect(IdlePrefetch.normalizeOptions({ batchSize: Number.NaN, idleTimeout: Number.NaN }))
			.toEqual({ batchSize: 2, idleTimeout: 1500 });
	});

	it('loads batches only while idle and skips identities completed in this session', async () => {
		const first = identity('./first.md');
		const second = identity('./second.md');
		const third = identity('./third.md');
		const fourth = identity('./fourth.md');
		build.mockImplementationOnce(async ({ prefetchResources }) => {
			const firstResults = await prefetchResources([first, second, third]);
			const secondResults = await prefetchResources([first, fourth]);
			return { collector: { identities: new Map() }, results: [...firstResults, ...secondResults] };
		});

		const stop = IdlePrefetch.start(config({ batchSize: 2, idleTimeout: 25 }));
		expect(prefetch).not.toHaveBeenCalled();
		expect(requestIdleCallback).toHaveBeenCalledWith(expect.any(Function), { timeout: 25 });

		await flushIdle();
		expect(prefetch).toHaveBeenNthCalledWith(1, [first, second], {
			priority: 25,
			signal: expect.any(AbortSignal)
		});
		await flushIdle();
		expect(prefetch).toHaveBeenNthCalledWith(2, [third], expect.any(Object));
		await flushIdle();
		expect(prefetch).toHaveBeenNthCalledWith(3, [fourth], expect.any(Object));
		expect(prefetch.mock.calls.flatMap(([identities]) => identities)
			.filter(item => item === first)).toHaveLength(1);
		stop();
	});

	it('retries only failed and newly discovered resources after reconnecting', async () => {
		const ready = identity('./ready.md');
		const failed = identity('./failed.md');
		const discovered = identity('./discovered.md');
		let run = 0;
		build.mockImplementation(async ({ prefetchResources }) => {
			run += 1;
			await prefetchResources(run === 1 ? [ready, failed] : [ready, failed, discovered]);
			return { collector: { identities: new Map() }, results: [] };
		});
		prefetch
			.mockResolvedValueOnce([fulfilled(ready), rejected(new Error('offline'))])
			.mockImplementation(async (identities: ResourceIdentity[]) => (
				identities.map(value => fulfilled(value))
			));

		const stop = IdlePrefetch.start(config());
		await flushIdle();
		expect(build).toHaveBeenCalledTimes(1);
		window.dispatchEvent(new Event('online'));
		await flushPromises();
		await flushIdle();
		expect(prefetch).toHaveBeenLastCalledWith([failed, discovered], expect.any(Object));
		expect(build).toHaveBeenCalledTimes(2);
		window.dispatchEvent(new Event('online'));
		await flushPromises();
		expect(build).toHaveBeenCalledTimes(2);
		stop();
	});

	it('uses a timer fallback and cancels pending idle work on stop', async () => {
		vi.useFakeTimers();
		vi.stubGlobal('requestIdleCallback', undefined);
		vi.stubGlobal('cancelIdleCallback', undefined);
		const target = identity('./timer.md');
		build.mockImplementation(async ({ prefetchResources }) => {
			await prefetchResources([target]);
			return { collector: { identities: new Map() }, results: [] };
		});

		const stop = IdlePrefetch.start(config());
		expect(prefetch).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(16);
		expect(prefetch).toHaveBeenCalledOnce();
		const signal = prefetch.mock.calls[0][1].signal as AbortSignal;
		stop();
		expect(signal.aborted).toBe(true);
	});

	it('isolates concurrent start sessions on one scheduler', async () => {
		let session = 0;
		build.mockImplementation(async ({ prefetchResources }) => {
			session += 1;
			await prefetchResources([identity(`./session-${session}.md`)]);
			return { collector: { identities: new Map() }, results: [] };
		});

		const stopFirst = IdlePrefetch.start(config());
		const stopSecond = IdlePrefetch.start(config());
		expect(build).toHaveBeenCalledTimes(2);
		await flushIdle();
		const firstSignal = prefetch.mock.calls[0][1].signal as AbortSignal;
		stopFirst();
		expect(firstSignal.aborted).toBe(true);

		await flushIdle();
		const secondSignal = prefetch.mock.calls[1][1].signal as AbortSignal;
		expect(secondSignal.aborted).toBe(false);
		stopSecond();
		expect(secondSignal.aborted).toBe(true);
	});

	it('does not start when disabled and cancels requestIdleCallback before execution', async () => {
		const disabledStop = IdlePrefetch.start(config(false));
		disabledStop();
		expect(build).not.toHaveBeenCalled();

		const target = identity('./cancel.md');
		build.mockImplementation(async ({ prefetchResources }) => {
			await prefetchResources([target]);
			return { collector: { identities: new Map() }, results: [] };
		});
		const stop = IdlePrefetch.start(config());
		stop();
		stop();
		expect(cancelIdleCallback).toHaveBeenCalledOnce();
		expect(prefetch).not.toHaveBeenCalled();
		await flushPromises();
	});
});
