// @vitest-environment jsdom

const { http, cancel, removeShared, indexedData } = vi.hoisted(() => ({
	http: vi.fn(),
	cancel: vi.fn(),
	removeShared: vi.fn(async () => {}),
	indexedData: new Map<string, unknown>()
}));

vi.mock('../src/modules/network', () => ({
	Network: { http, removeShared }
}));
vi.mock('@deot/helper-cache', () => ({
	IndexedDBStore: class {
		async get(key: string) { return indexedData.get(key) || null; }
		async set(key: string, value: unknown) { indexedData.set(key, value); }
		async remove(key: string) { indexedData.delete(key); }
		async search() { return [...indexedData.keys()].map(__id => ({ __id })); }
	}
}));

import { ResourceGateway } from '../src/modules/gateway';
import type { ResourceCache, ResourceRecord } from '../src/modules/gateway';
import { RequestScheduler } from '../src/modules/gateway/scheduler';
import { resourceIdentityKey } from '../src/utils/resolver';
import type { ResourceIdentity } from '../src/types';

class MemoryCache implements ResourceCache {
	data = new Map<string, ResourceRecord>();

	async get(key: string) { return this.data.get(key) || null; }
	async set(key: string, value: ResourceRecord) { this.data.set(key, value); }
	async remove(key: string) { this.data.delete(key); }
	async list() { return [...this.data.values()]; }
	async clear() { this.data.clear(); }
}

const identity = (source: string, namespace = 'docs'): ResourceIdentity => ({
	namespace,
	lang: 'zh-CN',
	type: 'markdown',
	source
});

describe('ResourceGateway', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		indexedData.clear();
		window.$docs = {
			locales: { 'zh-CN': { label: '简体中文' } },
			routes: {},
			base: 'https://docs.example.com/',
			namespace: 'docs'
		};
	});

	it('merges concurrent logical requests and keeps the previous version', async () => {
		const cache = new MemoryCache();
		let content = 'first';
		const request = vi.fn(async () => ({ status: 200, body: content, etag: content }));
		const gateway = new ResourceGateway({ cache, request });
		const target = identity('./index.md');

		const [first, shared] = await Promise.all([
			gateway.load(target, { url: '/site/zh-CN/index.md' }),
			gateway.load(target, { url: '/site/zh-CN/index.md' })
		]);
		expect(first.content).toBe('first');
		expect(shared.content).toBe('first');
		expect(request).toHaveBeenCalledTimes(1);
		expect((await cache.list())[0].statusHistory).toHaveLength(1);

		content = 'second';
		const second = await gateway.revalidate(target, { url: '/site/zh-CN/index.md' });
		expect(second.content).toBe('second');
		expect(second.previous?.content).toBe('first');
	});

	it('isolates shared caller cancellation and cancels only after the last consumer', async () => {
		let release!: () => void;
		let requestSignal: AbortSignal | undefined;
		const blocked = new Promise<void>((resolve) => {
			release = resolve;
		});
		const request = vi.fn(async (_url, _headers, signal) => {
			requestSignal = signal;
			await blocked;
			return { status: 200, body: 'shared' };
		});
		const gateway = new ResourceGateway({ cache: new MemoryCache(), request });
		const target = identity('./shared-abort.md');
		const firstController = new AbortController();
		const secondController = new AbortController();
		const first = gateway.revalidate(target, {
			url: '/shared-abort.md', signal: firstController.signal
		});
		const second = gateway.revalidate(target, {
			url: '/shared-abort.md', signal: secondController.signal
		});

		await vi.waitFor(() => expect(requestSignal).toBeDefined());
		firstController.abort();
		await expect(first).rejects.toMatchObject({ name: 'AbortError' });
		expect(requestSignal?.aborted).toBe(false);
		expect(request).toHaveBeenCalledOnce();
		release();
		await expect(second).resolves.toMatchObject({ content: 'shared' });
		expect((await gateway.list())[0].statusHistory).toHaveLength(1);
	});

	it('does not persist a late injected response after the last consumer aborts', async () => {
		let release!: () => void;
		const blocked = new Promise<void>((resolve) => {
			release = resolve;
		});
		const cache = new MemoryCache();
		const request = vi.fn(async () => {
			await blocked;
			return { status: 200, body: 'too late' };
		});
		const gateway = new ResourceGateway({ cache, request });
		const controller = new AbortController();
		const failure = gateway.revalidate(identity('./late-abort.md'), {
			url: '/late-abort.md', signal: controller.signal
		});
		await vi.waitFor(() => expect(request).toHaveBeenCalledOnce());
		controller.abort();
		await expect(failure).rejects.toMatchObject({ name: 'AbortError' });
		await vi.waitFor(() => expect([...cache.data.values()][0]).toMatchObject({
			requestStatus: 'error', reason: 'The operation was aborted'
		}));
		release();
		await Promise.resolve();
		expect([...cache.data.values()][0]).toMatchObject({
			requestStatus: 'error', content: undefined
		});
	});

	it('shares ordinary revalidation and coalesces explicit trailing freshness', async () => {
		let releaseFirst!: () => void;
		const firstBlocked = new Promise<void>((resolve) => {
			releaseFirst = resolve;
		});
		const request = vi.fn(async () => {
			if (request.mock.calls.length === 1) {
				await firstBlocked;
				return { status: 200, body: 'in-flight snapshot' };
			}
			return { status: 200, body: 'latest snapshot' };
		});
		const gateway = new ResourceGateway({ cache: new MemoryCache(), request });
		const target = identity('./trailing.md');
		const first = gateway.revalidate(target, { url: '/trailing.md' });
		const ordinaryShared = gateway.revalidate(target, { url: '/trailing.md' });
		const trailingA = gateway.revalidate(target, {
			url: '/trailing.md', priority: 75, trailing: true
		});
		const trailingB = gateway.revalidate(target, {
			url: '/trailing.md', priority: 80, trailing: true
		});

		await vi.waitFor(() => expect(request).toHaveBeenCalledOnce());
		releaseFirst();
		await expect(first).resolves.toMatchObject({ content: 'in-flight snapshot' });
		await expect(ordinaryShared).resolves.toMatchObject({ content: 'in-flight snapshot' });
		await expect(Promise.all([trailingA, trailingB])).resolves.toEqual([
			expect.objectContaining({ content: 'latest snapshot' }),
			expect.objectContaining({ content: 'latest snapshot' })
		]);
		expect(request).toHaveBeenCalledTimes(2);
		expect((await gateway.list())[0].statusHistory).toHaveLength(2);
	});

	it('normalizes 304 and only notifies when content changes', async () => {
		const cache = new MemoryCache();
		const responses = [
			{ status: 200, body: 'cached', etag: 'v1' },
			{ status: 304, body: '', etag: 'v1' }
		];
		const gateway = new ResourceGateway({
			cache,
			request: vi.fn(async () => responses.shift()!)
		});
		const target = identity('./cached.md');
		const listener = vi.fn();
		gateway.subscribe(target, listener);
		await gateway.load(target, { url: '/cached.md' });
		await gateway.revalidate(target, { url: '/cached.md' });
		expect(listener).toHaveBeenCalledTimes(1);
	});

	it('isolates equal sources by namespace', async () => {
		const gateway = new ResourceGateway({
			cache: new MemoryCache(),
			request: vi.fn(async url => ({ status: 200, body: url }))
		});
		const first = await gateway.load(identity('./index.md', 'a'), { url: '/a.md' });
		const second = await gateway.load(identity('./index.md', 'b'), { url: '/b.md' });
		expect(first.content).toBe('/a.md');
		expect(second.content).toBe('/b.md');
	});

	it('runs queued resources by priority without exceeding concurrency', async () => {
		let releaseFirst!: () => void;
		const firstPending = new Promise<void>((resolve) => {
			releaseFirst = resolve;
		});
		const started: string[] = [];
		const request = vi.fn(async (url: string) => {
			started.push(url);
			if (url === '/first.md') await firstPending;
			return { status: 200, body: url };
		});
		const gateway = new ResourceGateway({ cache: new MemoryCache(), request, concurrency: 1 });
		const first = gateway.revalidate(identity('./first.md'), { url: '/first.md', priority: 100 });
		const polling = gateway.revalidate(identity('./polling.md'), { url: '/polling.md', priority: 0 });
		const route = gateway.revalidate(identity('./route.md'), { url: '/route.md', priority: 100 });

		await vi.waitFor(() => expect(started).toEqual(['/first.md']));
		releaseFirst();
		await Promise.all([first, polling, route]);
		expect(started).toEqual(['/first.md', '/route.md', '/polling.md']);
	});

	it('raises the priority of a scheduler task only while it remains queued', async () => {
		let releaseFirst!: () => void;
		const blocked = new Promise<void>((resolve) => {
			releaseFirst = resolve;
		});
		const order: string[] = [];
		const scheduler = new RequestScheduler(1);
		const first = scheduler.schedule(async () => {
			order.push('first');
			await blocked;
		}, 100);
		const warm = scheduler.schedule(async () => {
			order.push('warm');
		}, 25);
		const medium = scheduler.schedule(async () => {
			order.push('medium');
		}, 75);
		warm.setPriority(100);
		releaseFirst();
		await Promise.all([first, warm, medium]);
		expect(order).toEqual(['first', 'warm', 'medium']);
		warm.setPriority(200);
	});

	it('promotes a queued prefetch when the current route starts loading it', async () => {
		let releaseFirst!: () => void;
		const firstPending = new Promise<void>((resolve) => {
			releaseFirst = resolve;
		});
		const started: string[] = [];
		const cache = new MemoryCache();
		const gateway = new ResourceGateway({
			cache,
			concurrency: 1,
			request: vi.fn(async (url) => {
				started.push(url);
				if (url === '/first.md') await firstPending;
				return { status: 200, body: url };
			})
		});
		const first = gateway.revalidate(identity('./first.md'), { url: '/first.md' });
		await vi.waitFor(() => expect(started).toEqual(['/first.md']));
		const warmIdentity = identity('./warm.md');
		const warm = gateway.prefetch([warmIdentity]);
		const medium = gateway.revalidate(identity('./medium.md'), {
			url: '/medium.md', priority: 75
		});
		const route = gateway.load(warmIdentity);
		await vi.waitFor(() => {
			expect([...cache.data.values()]
				.find(record => record.identity.source === './warm.md'))
				.toMatchObject({ requestStatus: 'waiting' });
		});
		releaseFirst();
		await Promise.all([first, warm, medium, route]);
		expect(started).toEqual([
			'/first.md',
			'https://docs.example.com/zh-CN/warm.md',
			'/medium.md'
		]);
	});

	it('releases concurrency after failed resources', async () => {
		const request = vi.fn(async (url: string) => {
			if (url !== '/healthy.md') throw new Error(`404 ${url}`);
			return { status: 200, body: 'healthy' };
		});
		const gateway = new ResourceGateway({
			cache: new MemoryCache(),
			request,
			concurrency: 2
		});
		const failures = Array.from({ length: 6 }, (_, index) => (
			gateway.load(identity(`./missing-${index}.md`), { url: `/missing-${index}.md` })
		));
		await Promise.allSettled(failures);

		await expect(gateway.load(identity('./healthy.md'), { url: '/healthy.md' }))
			.resolves.toMatchObject({ content: 'healthy' });
	});

	it('forwards cancellation and invalidates persisted resources', async () => {
		const cache = new MemoryCache();
		const request = vi.fn();
		const gateway = new ResourceGateway({ cache, request });
		const target = identity('./abort.md');
		const controller = new AbortController();
		controller.abort();
		await expect(gateway.load(target, { url: '/abort.md', signal: controller.signal }))
			.rejects.toMatchObject({ name: 'AbortError' });
		expect(request).not.toHaveBeenCalled();

		const stored = identity('./stored.md');
		const healthy = new ResourceGateway({
			cache,
			request: vi.fn(async () => ({ status: 200, body: 'stored' }))
		});
		await healthy.load(stored, { url: '/stored.md' });
		expect(cache.data.size).toBe(2);
		expect([...cache.data.values()].find(item => item.identity.source === './abort.md'))
			.toMatchObject({ status: 'error', requestStatus: 'error' });
		await healthy.invalidate(stored);
		expect(cache.data.size).toBe(1);
	});

	it('serves cached content immediately and updates metadata without a new version', async () => {
		const cache = new MemoryCache();
		const request = vi.fn(async () => ({
			status: 200,
			body: 'same content',
			etag: 'next-etag',
			lastModified: 'next-date'
		}));
		const gateway = new ResourceGateway({ cache, request });
		const target = identity('./same.md');
		const first = await gateway.load(target, { url: '/same.md' });
		const cached = await gateway.load(target, { url: '/same.md', refresh: false });
		expect(cached).toMatchObject({
			content: first.content,
			hash: first.hash,
			contentHistoryId: first.contentHistoryId
		});
		expect(cached.accessedAt).toBeGreaterThanOrEqual(first.accessedAt);
		expect(request).toHaveBeenCalledOnce();

		const unchanged = await gateway.revalidate(target, { url: '/same.md' });
		expect(unchanged.previous).toBeUndefined();
		expect(unchanged.etag).toBe('next-etag');
		expect(unchanged.lastModified).toBe('next-date');
	});

	it('lists persisted and memory resources and clears all cached records', async () => {
		const cache = new MemoryCache();
		const set = vi.spyOn(cache, 'set');
		const gateway = new ResourceGateway({
			cache,
			request: vi.fn(async url => ({ status: 200, body: url }))
		});
		await gateway.load(identity('./first.md'), { url: '/first.md' });
		await gateway.load(identity('./second.md'), { url: '/second.md' });
		set.mockClear();

		await expect(gateway.list()).resolves.toEqual(expect.arrayContaining([
			expect.objectContaining({ url: '/first.md' }),
			expect.objectContaining({ url: '/second.md' })
		]));
		expect(set).not.toHaveBeenCalled();
		await gateway.clear();
		await expect(gateway.list()).resolves.toEqual([]);
	});

	it('cancels in-flight work and prevents cleared records from being restored', async () => {
		let release!: () => void;
		let requestSignal: AbortSignal | undefined;
		const blocked = new Promise<void>((resolve) => {
			release = resolve;
		});
		const cache = new MemoryCache();
		const gateway = new ResourceGateway({
			cache,
			request: vi.fn(async (_url, _headers, signal) => {
				requestSignal = signal;
				await blocked;
				return { status: 200, body: 'late content' };
			})
		});
		const target = gateway.load(identity('./late.md'), { url: '/late.md' });
		await vi.waitFor(() => expect(requestSignal).toBeDefined());
		await gateway.clear();
		expect(requestSignal?.aborted).toBe(true);
		await expect(target).rejects.toMatchObject({ name: 'AbortError' });
		release();
		await vi.waitFor(async () => expect(await gateway.list()).toEqual([]));
	});

	it('keeps an immediate retry behind invalidate until the old row is removed', async () => {
		let releaseRemove!: () => void;
		let markRemoveStarted!: () => void;
		const removeStarted = new Promise<void>((resolve) => {
			markRemoveStarted = resolve;
		});
		const removeBlocked = new Promise<void>((resolve) => {
			releaseRemove = resolve;
		});
		class DelayedRemoveCache extends MemoryCache {
			override async remove(key: string) {
				markRemoveStarted();
				await removeBlocked;
				await super.remove(key);
			}
		}
		const cache = new DelayedRemoveCache();
		let content = 'old';
		const request = vi.fn(async () => ({ status: 200, body: content }));
		const gateway = new ResourceGateway({ cache, request });
		const target = identity('./invalidate-race.md');
		await gateway.load(target, { url: '/invalidate-race.md' });
		content = 'new';
		const invalidating = gateway.invalidate(target);
		await removeStarted;
		const retry = gateway.load(target, { url: '/invalidate-race.md' });
		await Promise.resolve();
		expect(request).toHaveBeenCalledOnce();
		releaseRemove();
		await invalidating;
		await expect(retry).resolves.toMatchObject({ content: 'new' });
		expect(cache.data.get(resourceIdentityKey(target))).toMatchObject({ content: 'new' });
	});

	it('keeps an immediate retry behind clear and stops every polling timer', async () => {
		vi.useFakeTimers();
		let releaseClear!: () => void;
		let markClearStarted!: () => void;
		const clearStarted = new Promise<void>((resolve) => {
			markClearStarted = resolve;
		});
		const clearBlocked = new Promise<void>((resolve) => {
			releaseClear = resolve;
		});
		class DelayedClearCache extends MemoryCache {
			override async clear() {
				markClearStarted();
				await clearBlocked;
				await super.clear();
			}
		}
		const cache = new DelayedClearCache();
		let content = 'old';
		const request = vi.fn(async () => ({ status: 200, body: content }));
		const gateway = new ResourceGateway({ cache, request });
		const target = identity('./clear-race.md');
		await gateway.load(target, { url: '/clear-race.md' });
		gateway.poll(target, 10);
		content = 'new';
		const clearing = gateway.clear();
		await clearStarted;
		const retry = gateway.load(target, { url: '/clear-race.md' });
		await vi.advanceTimersByTimeAsync(30);
		expect(request).toHaveBeenCalledOnce();
		releaseClear();
		await clearing;
		await expect(retry).resolves.toMatchObject({ content: 'new' });
		await vi.advanceTimersByTimeAsync(30);
		expect(request).toHaveBeenCalledTimes(2);
		vi.useRealTimers();
	});

	it('serializes legacy list repair before a newer network record', async () => {
		let releaseMigration!: () => void;
		let markMigrationStarted!: () => void;
		const migrationStarted = new Promise<void>((resolve) => {
			markMigrationStarted = resolve;
		});
		const migrationBlocked = new Promise<void>((resolve) => {
			releaseMigration = resolve;
		});
		class DelayedMigrationCache extends MemoryCache {
			blockNextSet = true;

			override async set(key: string, value: ResourceRecord) {
				if (this.blockNextSet) {
					this.blockNextSet = false;
					markMigrationStarted();
					await migrationBlocked;
				}
				await super.set(key, value);
			}
		}
		const cache = new DelayedMigrationCache();
		const target = identity('./migration-race.md');
		cache.data.set(resourceIdentityKey(target), {
			identity: target,
			url: '/migration-race.md',
			content: 'legacy',
			updatedAt: 1,
			checkedAt: 1,
			accessedAt: 1
		} as unknown as ResourceRecord);
		const gateway = new ResourceGateway({
			cache,
			request: vi.fn(async () => ({ status: 200, body: 'network' }))
		});
		const listing = gateway.list();
		await migrationStarted;
		const updating = gateway.revalidate(target, { url: '/migration-race.md' });
		releaseMigration();
		await listing;
		await expect(updating).resolves.toMatchObject({ content: 'network' });
		expect(cache.data.get(resourceIdentityKey(target))).toMatchObject({ content: 'network' });
	});

	it('prunes unreachable records only inside the requested namespace', async () => {
		const gateway = new ResourceGateway({
			cache: new MemoryCache(),
			request: vi.fn(async url => ({ status: 200, body: url }))
		});
		const retained = identity('./retained.md');
		const garbage = identity('./garbage.md');
		const external = identity('./external.md', 'other');
		await gateway.load(retained, { url: '/retained.md' });
		await gateway.load(garbage, { url: '/garbage.md' });
		await gateway.load(external, { url: '/external.md' });

		await expect(gateway.prune('docs', [retained])).resolves.toEqual([
			expect.objectContaining({ identity: garbage })
		]);
		await expect(gateway.list()).resolves.toEqual(expect.arrayContaining([
			expect.objectContaining({ identity: retained }),
			expect.objectContaining({ identity: external })
		]));
		expect((await gateway.list()).some(record => record.identity.source === './garbage.md'))
			.toBe(false);
	});

	it('uses validators and repairs invalid cached sidebar JSON after a 304', async () => {
		const cache = new MemoryCache();
		const sidebar = { ...identity('./sidebar.json'), type: 'sidebar' as const };
		const request = vi.fn()
			.mockResolvedValueOnce({
				status: 200, body: 'invalid json', etag: 'sidebar-etag', lastModified: 'yesterday'
			})
			.mockResolvedValueOnce({ status: 304, body: '' })
			.mockResolvedValueOnce({ status: 200, body: '[{"label":"Guide"}]' });
		const gateway = new ResourceGateway({ cache, request });
		await gateway.load(sidebar, { url: '/sidebar.json' });
		const repaired = await gateway.revalidate(sidebar, { url: '/sidebar.json' });
		expect(request.mock.calls[1][1]).toEqual({
			'If-None-Match': 'sidebar-etag',
			'If-Modified-Since': 'yesterday'
		});
		expect(request.mock.calls[2][1]).toEqual({});
		expect(repaired.content).toContain('Guide');
	});

	it('prefetches, polls and releases subscription sets', async () => {
		vi.useFakeTimers();
		const request = vi.fn(async url => ({ status: 200, body: url }));
		const gateway = new ResourceGateway({ cache: new MemoryCache(), request });
		gateway.setConcurrency(0);
		const first = identity('./first.md');
		const second = identity('./second.md');
		await gateway.prefetch([first, second]);
		expect(request).toHaveBeenCalledTimes(2);
		expect(gateway.isPrefetched(first)).toBe(true);

		const listenerA = vi.fn();
		const listenerB = vi.fn();
		const unsubscribeA = gateway.subscribe(first, listenerA);
		const unsubscribeB = gateway.subscribe(first, listenerB);
		expect(gateway.isSubscribed(first)).toBe(true);
		unsubscribeA();
		expect(gateway.isSubscribed(first)).toBe(true);
		unsubscribeB();
		expect(gateway.isSubscribed(first)).toBe(false);

		const stop = gateway.poll([first, second, first], { interval: 10, priority: 5 });
		await vi.advanceTimersByTimeAsync(10);
		expect(request).toHaveBeenCalledTimes(4);
		stop();
		gateway.stopPolling(first);
		await gateway.invalidate(first);
		expect(gateway.isPrefetched(first)).toBe(false);
		vi.useRealTimers();
	});

	it('rejects unusable 304 and non-success transport responses', async () => {
		const request = vi.fn()
			.mockResolvedValueOnce({ status: 304, body: '' })
			.mockResolvedValueOnce({ status: 404, body: 'missing' });
		const gateway = new ResourceGateway({ cache: new MemoryCache(), request });
		await expect(gateway.load(identity('./empty-304.md'), { url: '/empty-304.md' }))
			.rejects.toThrow('304 without cached content');
		await expect(gateway.load(identity('./raw-404.md'), { url: '/raw-404.md' }))
			.rejects.toThrow('HTTP 404');
	});

	it('awaits cached resource revalidation when prefetching', async () => {
		let content = 'first';
		const cache = new MemoryCache();
		const request = vi.fn(async () => ({ status: 200, body: content }));
		const gateway = new ResourceGateway({ cache, request });
		const target = identity('./cached-prefetch.md');
		await gateway.load(target, { url: '/cached-prefetch.md' });
		content = 'second';

		const [result] = await gateway.prefetch([target]);
		expect(result.status).toBe('fulfilled');
		expect(request).toHaveBeenCalledTimes(2);
		const record = (await gateway.list())[0];
		expect(record.content).toBe('second');
		expect(record.statusHistory.at(-1)).toMatchObject({
			status: 'success',
			waitingAt: expect.any(Number),
			pendingAt: expect.any(Number)
		});
	});

	it('uses the default HTTP and IndexedDB adapters', async () => {
		const headers = new Headers({ 'ETag': 'v1', 'Last-Modified': 'today' });
		const leaf = Object.assign(Promise.resolve({
			status: 200,
			body: { label: 'Guide' },
			headers
		}), { cancel });
		http.mockReturnValueOnce(leaf);
		window.$docs = {
			locales: { 'zh-CN': { label: '简体中文' } },
			routes: {},
			base: 'https://docs.example.com/',
			namespace: 'default-adapter'
		};
		const gateway = new ResourceGateway();
		const target = identity('./default.md', 'default-adapter');
		const record = await gateway.load(target);
		expect(record.url).toBe('https://docs.example.com/zh-CN/default.md');
		expect(record.content).toBe('{"label":"Guide"}');
		expect(record.etag).toBe('v1');
		expect(indexedData.size).toBe(1);
		await expect(gateway.list()).resolves.toEqual([record]);
		await gateway.clear();
		expect(indexedData.size).toBe(0);
	});

	it('shares one default HTTP leaf across identities with the same final URL', async () => {
		let resolveLeaf!: (response: unknown) => void;
		const leafTarget = new Promise((resolve) => {
			resolveLeaf = resolve;
		});
		http.mockReturnValueOnce(Object.assign(leafTarget, { cancel }));
		const gateway = new ResourceGateway({ cache: new MemoryCache() });
		const first = gateway.revalidate(identity('./same-url-a.md'), { url: '/same-url.md' });
		const second = gateway.revalidate(identity('./same-url-b.md'), { url: '/same-url.md' });
		await vi.waitFor(() => expect(http).toHaveBeenCalledOnce());
		resolveLeaf({ status: 200, body: 'shared transport', headers: new Headers() });

		await expect(Promise.all([first, second])).resolves.toEqual([
			expect.objectContaining({ content: 'shared transport' }),
			expect.objectContaining({ content: 'shared transport' })
		]);
		expect(http).toHaveBeenCalledOnce();
		expect(http.mock.calls[0][1].shared).toEqual(expect.any(Function));
		expect(removeShared).toHaveBeenCalledWith(http.mock.calls[0][1].shared);
	});

	it('retries a shared 304 when equal URLs use different validators', async () => {
		const response = (body: string, etag: string) => Object.assign(Promise.resolve({
			status: 200,
			body,
			headers: new Headers({ ETag: etag })
		}), { cancel });
		http.mockReturnValueOnce(response('first cache', 'first-etag'));
		http.mockReturnValueOnce(response('second cache', 'second-etag'));
		let rejectConditional!: (reason: unknown) => void;
		const conditional = new Promise((_resolve, reject) => {
			rejectConditional = reject;
		});
		http.mockReturnValueOnce(Object.assign(conditional, { cancel }));
		http.mockReturnValueOnce(response('fresh body', 'fresh-etag'));
		const gateway = new ResourceGateway({ cache: new MemoryCache() });
		const firstIdentity = identity('./validator-a.md');
		const secondIdentity = identity('./validator-b.md');
		await gateway.load(firstIdentity, { url: '/seed-a.md' });
		await gateway.load(secondIdentity, { url: '/seed-b.md' });

		const first = gateway.revalidate(firstIdentity, { url: '/validators.md' });
		const second = gateway.revalidate(secondIdentity, { url: '/validators.md' });
		await vi.waitFor(() => expect(http).toHaveBeenCalledTimes(3));
		rejectConditional({ status: 304, headers: new Headers({ ETag: 'first-etag' }) });
		const records = await Promise.all([first, second]);

		expect(http).toHaveBeenCalledTimes(4);
		expect(records.map(record => record.content)).toEqual(expect.arrayContaining([
			'fresh body'
		]));
		expect(http.mock.calls[3][1].headers).toEqual({ Accept: 'text/plain' });
	});

	it('removes a settled URL entry so a later request can retry', async () => {
		http.mockReturnValueOnce(Object.assign(Promise.reject({
			status: 404,
			statusText: 'HTTP_STATUS_ERROR',
			body: { statusText: 'Not Found' }
		}), { cancel }));
		const gateway = new ResourceGateway({ cache: new MemoryCache() });
		const failure = gateway.load(identity('./missing-shared.md'), { url: '/missing-shared.md' });
		await expect(failure).rejects.toThrow('404 Not Found');

		http.mockReturnValueOnce(Object.assign(Promise.resolve({
			status: 200,
			body: 'available',
			headers: new Headers()
		}), { cancel }));
		await expect(gateway.load(identity('./retry-shared.md'), {
			url: '/missing-shared.md'
		})).resolves.toMatchObject({ content: 'available' });
		expect(http).toHaveBeenCalledTimes(2);
	});

	it('waits for physical URL cancellation before starting its replacement', async () => {
		let rejectLeaf!: (reason: unknown) => void;
		const leaf = new Promise((_resolve, reject) => {
			rejectLeaf = reject;
		});
		let releaseCancel!: () => void;
		const cancelBlocked = new Promise<void>((resolve) => {
			releaseCancel = resolve;
		});
		const firstCancel = vi.fn(async () => {
			await cancelBlocked;
			rejectLeaf({ statusText: 'cancelled' });
		});
		http.mockReturnValueOnce(Object.assign(leaf, { cancel: firstCancel }));
		const gateway = new ResourceGateway({ cache: new MemoryCache() });
		const controller = new AbortController();
		const first = gateway.load(identity('./cancel-a.md'), {
			url: '/cancel-retry.md',
			signal: controller.signal
		});
		await vi.waitFor(() => expect(http).toHaveBeenCalledOnce());
		controller.abort();
		await expect(first).rejects.toMatchObject({ name: 'AbortError' });
		await vi.waitFor(() => expect(firstCancel).toHaveBeenCalledOnce());

		http.mockReturnValueOnce(Object.assign(Promise.resolve({
			status: 200,
			body: 'replacement',
			headers: new Headers()
		}), { cancel }));
		const replacement = gateway.load(identity('./cancel-b.md'), {
			url: '/cancel-retry.md'
		});
		await Promise.resolve();
		expect(http).toHaveBeenCalledOnce();

		releaseCancel();
		await expect(replacement).resolves.toMatchObject({ content: 'replacement' });
		expect(http).toHaveBeenCalledTimes(2);
	});

	it('normalizes HTTP 304 failures, propagates errors and cancels the leaf', async () => {
		const errorHeaders = new Headers({ ETag: 'v1' });
		http.mockReturnValueOnce(Object.assign(Promise.resolve({
			status: 200, body: 'cached', headers: errorHeaders
		}), { cancel }));
		const gateway = new ResourceGateway({ cache: new MemoryCache() });
		const target = identity('./conditional.md');
		await gateway.load(target, { url: '/conditional.md' });
		http.mockReturnValueOnce(Object.assign(Promise.reject({
			status: 304, headers: errorHeaders
		}), { cancel }));
		await expect(gateway.revalidate(target, { url: '/conditional.md' }))
			.resolves.toMatchObject({ content: 'cached' });

		const controller = new AbortController();
		const pendingLeaf = Object.assign(new Promise(() => undefined), { cancel });
		http.mockReturnValueOnce(pendingLeaf);
		const failure = gateway.revalidate(identity('./failure.md'), {
			url: '/failure.md', signal: controller.signal
		});
		await vi.waitFor(() => expect(http).toHaveBeenCalledTimes(3));
		controller.abort();
		expect(cancel).toHaveBeenCalled();
		await expect(failure).rejects.toMatchObject({ name: 'AbortError' });
	});

	it('uses the HTTP response status when a resource is missing', async () => {
		const responseError = (reason: unknown) => Object.assign(Promise.reject(reason), { cancel });
		http.mockReturnValueOnce(responseError({
			status: 404,
			statusText: 'HTTP_STATUS_ERROR',
			body: { statusText: 'Not Found' }
		}));
		const gateway = new ResourceGateway({ cache: new MemoryCache() });
		await expect(gateway.load(identity('./missing.md'), { url: '/missing.md' }))
			.rejects.toThrow('404 Not Found');

		http.mockReturnValueOnce(responseError({
			status: '503', statusText: 'HTTP_STATUS_ERROR'
		}));
		await expect(gateway.load(identity('./unavailable.md'), { url: '/unavailable.md' }))
			.rejects.toThrow('HTTP 503');

		http.mockReturnValueOnce(responseError({ statusText: 'offline' }));
		await expect(gateway.load(identity('./offline.md'), { url: '/offline.md' }))
			.rejects.toThrow('offline');

		http.mockReturnValueOnce(responseError({}));
		await expect(gateway.load(identity('./unknown.md'), { url: '/unknown.md' }))
			.rejects.toThrow('Resource request failed');

		http.mockReturnValueOnce(responseError(Object.assign(new Error('[object Object]'), {
			status: 404,
			body: { statusText: 'Not Found' }
		})));
		await expect(gateway.load(identity('./error-instance.md'), {
			url: '/error-instance.md'
		})).rejects.toThrow('404 Not Found');
	});

	it('persists one ordinary request lifecycle from pending to success', async () => {
		let release!: () => void;
		const blocked = new Promise<void>((resolve) => {
			release = resolve;
		});
		const cache = new MemoryCache();
		const gateway = new ResourceGateway({
			cache,
			request: vi.fn(async () => {
				await blocked;
				return { status: 200, body: 'ready' };
			})
		});
		const target = identity('./lifecycle.md');
		const result = gateway.load(target, { url: '/lifecycle.md' });

		await vi.waitFor(() => {
			const pending = [...cache.data.values()][0];
			expect(pending).toMatchObject({ status: 'pending', requestStatus: 'pending' });
			expect(pending.statusHistory).toHaveLength(1);
			expect(pending.statusHistory[0]).toMatchObject({ status: 'pending' });
			expect(pending.statusHistory[0].waitingAt).toBeUndefined();
		});
		release();
		const completed = await result;
		expect(completed.statusHistory).toHaveLength(1);
		expect(completed.statusHistory[0]).toMatchObject({
			status: 'success',
			pendingAt: expect.any(Number),
			completedAt: expect.any(Number)
		});
		expect(completed.contentHistoryId).toBe(completed.statusHistory[0].id);
		expect(completed.contentHistoryIndex).toBe(0);
	});

	it('persists prefetch waiting before queue execution and reuses its attempt', async () => {
		let releaseFirst!: () => void;
		const firstBlocked = new Promise<void>((resolve) => {
			releaseFirst = resolve;
		});
		const started: string[] = [];
		const cache = new MemoryCache();
		const gateway = new ResourceGateway({
			cache,
			concurrency: 1,
			request: vi.fn(async (url) => {
				started.push(url);
				if (url === '/first.md') await firstBlocked;
				return { status: 200, body: url };
			})
		});
		const first = gateway.revalidate(identity('./first.md'), { url: '/first.md' });
		await vi.waitFor(() => expect(started).toEqual(['/first.md']));
		const prefetched = gateway.prefetch([identity('./queued.md')]);

		await vi.waitFor(() => {
			const queued = [...cache.data.values()]
				.find(item => item.identity.source === './queued.md');
			expect(queued).toMatchObject({ status: 'waiting', requestStatus: 'waiting' });
			expect(queued?.statusHistory).toHaveLength(1);
			expect(queued?.statusHistory[0]).toMatchObject({
				status: 'waiting',
				waitingAt: expect.any(Number)
			});
			expect(started).toEqual(['/first.md']);
		});
		releaseFirst();
		await first;
		await prefetched;
		const completed = [...cache.data.values()]
			.find(item => item.identity.source === './queued.md')!;
		expect(completed.statusHistory).toHaveLength(1);
		expect(completed.statusHistory[0]).toMatchObject({
			status: 'success',
			waitingAt: expect.any(Number),
			pendingAt: expect.any(Number),
			completedAt: expect.any(Number)
		});
	});

	it('keeps content successful when later requests fail and bounds history', async () => {
		const cache = new MemoryCache();
		let failing = false;
		const gateway = new ResourceGateway({
			cache,
			request: vi.fn(async () => {
				if (failing) throw new Error('offline');
				return { status: 200, body: 'stable' };
			})
		});
		const target = identity('./stable.md');
		const first = await gateway.load(target, { url: '/stable.md' });
		const sourceId = first.contentHistoryId;
		failing = true;
		for (let index = 0; index < 22; index++) {
			await expect(gateway.revalidate(target, { url: '/stable.md' }))
				.rejects.toThrow('offline');
		}

		const record = (await gateway.list())[0];
		expect(record).toMatchObject({
			status: 'success',
			requestStatus: 'error',
			reason: 'offline',
			content: 'stable',
			contentHistoryId: sourceId
		});
		expect(record.statusHistory).toHaveLength(20);
		expect(record.statusHistory[record.contentHistoryIndex!].id).toBe(sourceId);
		expect(record.statusHistory.filter(item => item.status === 'error')).toHaveLength(19);
	});

	it('moves the content source only when the hash changes', async () => {
		vi.useFakeTimers();
		vi.setSystemTime(1000);
		const responses = [
			{ status: 200, body: 'same' },
			{ status: 200, body: 'same' },
			{ status: 304, body: '' },
			{ status: 200, body: 'changed' }
		];
		const gateway = new ResourceGateway({
			cache: new MemoryCache(),
			request: vi.fn(async () => responses.shift() || { status: 200, body: 'changed' })
		});
		const target = identity('./source.md');
		const first = await gateway.load(target, { url: '/source.md' });
		const sourceId = first.contentHistoryId;
		const updatedAt = first.updatedAt;

		vi.setSystemTime(2000);
		const same = await gateway.revalidate(target, { url: '/source.md' });
		expect(same.contentHistoryId).toBe(sourceId);
		expect(same.updatedAt).toBe(updatedAt);
		const notModified = await gateway.revalidate(target, { url: '/source.md' });
		expect(notModified.contentHistoryId).toBe(sourceId);
		expect(notModified.updatedAt).toBe(updatedAt);

		vi.setSystemTime(3000);
		const changed = await gateway.revalidate(target, { url: '/source.md' });
		expect(changed.contentHistoryId).not.toBe(sourceId);
		expect(changed.updatedAt).toBe(3000);
		expect(changed.previous?.content).toBe('same');
		for (let index = 0; index < 20; index++) {
			await gateway.revalidate(target, { url: '/source.md' });
		}
		const compacted = await gateway.revalidate(target, { url: '/source.md' });
		expect(compacted.statusHistory).toHaveLength(20);
		expect(compacted.statusHistory.some(item => item.id === sourceId)).toBe(false);
		expect(compacted.statusHistory[compacted.contentHistoryIndex!].id)
			.toBe(changed.contentHistoryId);
		vi.useRealTimers();
	});

	it('treats empty content as available and normalizes error reasons', async () => {
		const cache = new MemoryCache();
		const request = vi.fn()
			.mockResolvedValueOnce({ status: 200, body: '' })
			.mockRejectedValueOnce('')
			.mockRejectedValueOnce(new Error('x'.repeat(1200)));
		const gateway = new ResourceGateway({ cache, request });
		const target = identity('./empty.md');
		await expect(gateway.load(target, { url: '/empty.md' })).resolves.toMatchObject({
			status: 'success', content: ''
		});
		await expect(gateway.revalidate(target, { url: '/empty.md' }))
			.rejects.toThrow('Resource request failed');
		let record = (await gateway.list())[0];
		expect(record).toMatchObject({
			status: 'success',
			requestStatus: 'error',
			reason: 'Resource request failed'
		});
		await expect(gateway.revalidate(target, { url: '/empty.md' })).rejects.toThrow();
		record = (await gateway.list())[0];
		expect(record.reason).toHaveLength(1000);
		expect(record.statusHistory.at(-1)?.reason).toHaveLength(1000);
	});

	it('repairs legacy records and damaged content history pointers', async () => {
		const cache = new MemoryCache();
		const healthy = identity('./legacy.md');
		const missing = identity('./legacy-missing.md');
		cache.data.set('healthy', {
			identity: healthy,
			url: '/legacy.md',
			content: 'legacy',
			updatedAt: 10,
			checkedAt: 10,
			accessedAt: 10,
			contentHistoryId: 'damaged',
			contentHistoryIndex: 0,
			statusHistory: Array.from({ length: 25 }, (_, index) => ({
				id: index ? `failure-${index}` : 'valid',
				status: index ? 'error' : 'success',
				createdAt: index + 10,
				reason: index ? 'offline' : undefined
			}))
		} as unknown as ResourceRecord);
		cache.data.set('missing', {
			identity: missing,
			url: '/legacy-missing.md',
			checkedAt: 0,
			accessedAt: 0
		} as unknown as ResourceRecord);
		const gateway = new ResourceGateway({ cache });
		const records = await gateway.list();
		const repaired = records.find(item => item.identity.source === './legacy.md')!;
		expect(repaired).toMatchObject({
			status: 'success',
			requestStatus: 'success',
			contentHistoryId: 'valid',
			contentHistoryIndex: 0,
			hash: expect.any(String)
		});
		expect(repaired.statusHistory).toHaveLength(20);
		expect(repaired.statusHistory[repaired.contentHistoryIndex!].id).toBe('valid');
		const normalizedMissing = records.find(
			item => item.identity.source === './legacy-missing.md'
		)!;
		expect(normalizedMissing).toMatchObject({
			status: 'error',
			requestStatus: 'error',
			reason: 'Legacy resource has no content',
			contentHistoryId: null,
			contentHistoryIndex: null
		});
	});

	it('migrates a persisted legacy record when load reads it into memory', async () => {
		const cache = new MemoryCache();
		const target = identity('./persisted-legacy.md');
		cache.data.set(resourceIdentityKey(target), {
			identity: target,
			url: '/persisted-legacy.md',
			content: 'legacy body',
			updatedAt: 10,
			checkedAt: 10,
			accessedAt: 10
		} as unknown as ResourceRecord);
		const gateway = new ResourceGateway({ cache });
		const restored = await gateway.load(target, { refresh: false });

		expect(restored).toMatchObject({
			status: 'success',
			requestStatus: 'success',
			content: 'legacy body',
			contentHistoryId: expect.any(String)
		});
		expect(cache.data.get(resourceIdentityKey(target))).toEqual(restored);
	});

	it('keeps lifecycle and content subscriptions strictly isolated', async () => {
		const responses: Array<Error | { status: number; body: string }> = [
			{ status: 200, body: 'content' },
			{ status: 200, body: 'content' },
			new Error('offline')
		];
		const gateway = new ResourceGateway({
			cache: new MemoryCache(),
			request: vi.fn(async () => {
				const response = responses.shift()!;
				if (response instanceof Error) throw response;
				return response;
			})
		});
		const target = identity('./subscriptions.md');
		const contentListener = vi.fn();
		const statusListener = vi.fn();
		gateway.subscribe(target, contentListener);
		const unsubscribeStatus = gateway.subscribeStatus(statusListener);

		await gateway.load(target, { url: '/subscriptions.md' });
		await gateway.revalidate(target, { url: '/subscriptions.md' });
		await expect(gateway.revalidate(target, { url: '/subscriptions.md' }))
			.rejects.toThrow('offline');
		expect(contentListener).toHaveBeenCalledOnce();
		expect(statusListener.mock.calls.map(([record]) => record.requestStatus))
			.toEqual(['pending', 'success', 'pending', 'success', 'pending', 'error']);
		unsubscribeStatus();
	});
});
