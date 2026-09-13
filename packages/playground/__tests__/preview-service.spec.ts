// @vitest-environment jsdom
import * as vue from 'vue';
import { PlaygroundService, PREVIEW_SERVICE_USE_CODE } from '../src/preview-service';
import type { PlaygroundRunOptions } from '../src/preview-service';
import { PREVIEW_SCROLLER_USE_CODE } from '../src/core/preview-scroll';

describe('preview service', () => {
	let runtime: PlaygroundService;
	let post: ReturnType<typeof vi.spyOn>;
	const applied = (accepted = true, source: MessageEventSource = window) => {
		const request = post.mock.calls.map(call => call[0]).filter(data => data.operation === 'enable').at(-1);
		window.dispatchEvent(new MessageEvent('message', {
			source,
			data: { ...request, action: 'docs:height:applied', accepted }
		}));
	};
	const releases = () => post.mock.calls.filter(call => call[0].operation === 'release');
	beforeEach(() => {
		vi.useFakeTimers();
		post = vi.spyOn(window, 'postMessage').mockImplementation(() => {});
		vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(600);
		runtime = new PlaygroundService(window, vue);
	});
	afterEach(() => {
		runtime.dispose();
		vi.restoreAllMocks();
		vi.useRealTimers();
	});

	it('creates a class-backed service', () => {
		expect(runtime).toBeInstanceOf(PlaygroundService);
		expect(PlaygroundService.prototype.enable).toBeTypeOf('function');
		expect(PlaygroundService.prototype.disable).toBeTypeOf('function');
		expect(PlaygroundService.prototype.run).toBeTypeOf('function');
		expect(PlaygroundService.prototype.dispose).toBeTypeOf('function');
		expect(Object.hasOwn(runtime, 'enable')).toBe(false);
		expect(Object.hasOwn(runtime, 'disable')).toBe(false);
		expect(Object.hasOwn(runtime, 'run')).toBe(false);
	});

	it('waits for the host and actual viewport, then restores the manual request', async () => {
		vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(100);
		const ready = runtime.enable(560);
		applied();
		let settled = false;
		void ready.then(() => { settled = true; });
		await Promise.resolve();
		expect(settled).toBe(false);
		vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(560);
		await vi.advanceTimersByTimeAsync(20);
		expect(await ready).toBe(true);
		runtime.disable();
		runtime.disable();
		expect(releases()).toHaveLength(1);
	});

	it('replaces manual requests and times out without leaking timers', async () => {
		const first = runtime.enable(400);
		const second = runtime.enable(500);
		expect(await first).toBe(false);
		await vi.advanceTimersByTimeAsync(2000);
		expect(await second).toBe(false);
		expect(vi.getTimerCount()).toBe(0);
	});

	it('returns a boolean handler when run has no handler', async () => {
		const handleVisible = runtime.run(560);
		const ready = handleVisible(true);
		applied();
		expect(await ready).toBe(true);
		expect(releases()).toHaveLength(0);
		expect(await handleVisible(false)).toBeUndefined();
		expect(releases()).toHaveLength(1);
	});

	it('rejects insufficient space without running the handler', async () => {
		const handler = vi.fn();
		const result = runtime.run(560, handler)();
		applied(false);
		expect(await result).toBeUndefined();
		expect(handler).not.toHaveBeenCalled();
	});

	it('is a lazy factory, forwards arguments and result, and merges repeated clicks', async () => {
		let finish!: (value: number) => void;
		const handler = vi.fn<(value: number) => Promise<number>>(() => new Promise<number>((resolve) => { finish = resolve; }));
		const open = runtime.run(560, handler);
		expect(handler).not.toHaveBeenCalled();
		const result = open(7);
		expect(open(8)).toBe(result);
		applied();
		await Promise.resolve();
		expect(handler).toHaveBeenCalledWith(7);
		finish(9);
		expect(await result).toBe(9);
		expect(releases()).toHaveLength(1);
	});

	it.each(['ref', 'getter', 'computed'])('holds height until %s visibility closes', async (kind) => {
		const state = vue.reactive({ visible: false });
		const visible = kind === 'ref'
			? vue.toRef(state, 'visible')
			: kind === 'computed' ? vue.computed(() => state.visible) : () => state.visible;
		const handler = vi.fn(() => { state.visible = true; });
		const open = runtime.run(560, { visible }, handler);
		const result = open();
		applied();
		await result;
		expect(releases()).toHaveLength(0);
		expect(open()).toBe(result);
		expect(handler).toHaveBeenCalledTimes(1);
		state.visible = false;
		expect(releases()).toHaveLength(1);
		await Promise.resolve();
		await Promise.resolve();
		const second = open();
		applied();
		await second;
		expect(handler).toHaveBeenCalledTimes(2);
	});

	it('opens a visible ref when the handler is omitted', async () => {
		const visible = vue.ref(false);
		const open = runtime.run(560, { visible });
		const result = open();
		applied();
		await result;
		expect(visible.value).toBe(true);
		expect(releases()).toHaveLength(0);
		visible.value = false;
		expect(releases()).toHaveLength(1);
	});

	it('requires a handler when visible is a getter', () => {
		const run = runtime.run as unknown as (height: number, options: PlaygroundRunOptions) => unknown;
		expect(() => run.call(runtime, 560, { visible: () => false }))
			.toThrow(TypeError);
	});

	it('releases if the handler does not open visible or throws', async () => {
		const visible = vue.ref(false);
		const result = runtime.run(560, { visible }, () => {})();
		applied();
		await result;
		expect(releases()).toHaveLength(1);
		const error = new Error('business failure');
		const failed = runtime.run(560, () => { throw error; })();
		const assertion = expect(failed).rejects.toBe(error);
		applied();
		await assertion;
		expect(releases()).toHaveLength(2);
	});

	it('accepts another run immediately after awaiting completion', async () => {
		const handler = vi.fn(() => 7);
		const open = runtime.run(560, handler);
		const first = open();
		applied();
		await first;
		const second = open();
		expect(second).not.toBe(first);
		applied();
		expect(await second).toBe(7);
		expect(handler).toHaveBeenCalledTimes(2);
	});

	it('cancels a pending run on component scope disposal', async () => {
		const scope = vue.effectScope();
		const handler = vi.fn();
		const open = scope.run(() => runtime.run(560, handler))!;
		const result = open();
		scope.stop();
		applied();
		await result;
		expect(handler).not.toHaveBeenCalled();
		expect(await open()).toBeUndefined();
		expect(vi.getTimerCount()).toBe(0);
	});

	it('disposes visible listeners and pending manual waits with the app', async () => {
		const visible = vue.ref(false);
		const result = runtime.run(560, { visible }, () => { visible.value = true; })();
		applied();
		await result;
		const manual = runtime.enable(560);
		runtime.dispose();
		expect(await manual).toBe(false);
		expect(releases()).toHaveLength(2);
		visible.value = false;
		expect(releases()).toHaveLength(2);
		expect(vi.getTimerCount()).toBe(0);
	});

	it('rejects invalid heights and boolean snapshots', () => {
		for (const height of [0, -1, NaN, Infinity]) {
			expect(() => runtime.enable(height)).toThrow(TypeError);
		}
		expect(() => runtime.run(560, { visible: false } as unknown as PlaygroundRunOptions, () => {}))
			.toThrow(TypeError);
	});

	it('executes serialized injection without module closure dependencies', () => {
		const app = vue.createApp({ render: () => null });
		new Function('app', 'window', '__docsPreviewVue', PREVIEW_SERVICE_USE_CODE)(app, window, vue);
		expect(app._context.provides['docs:playground']).toBe((window as any).$docsPlayground);
		const container = document.createElement('div');
		app.mount(container);
		app.unmount();
		expect((window as any).$docsPlayground).toBeUndefined();
	});

	it.each([true, false])('preserves injection and app cleanup with Scroller available=%s', (available) => {
		let injected: unknown;
		const app = vue.createApp({
			setup() {
				injected = vue.inject('docs:playground');
				return () => vue.h('button', 'ready');
			}
		});
		const Scroller = vue.defineComponent({ setup: (_, { slots }) => () => vue.h('div', slots.default?.()) });
		const target = window as any;
		target.__app__ = app;
		new Function('app', 'window', '__docsPreviewVue', '_createApp', '__docsH', '__docsVc',
			PREVIEW_SERVICE_USE_CODE + PREVIEW_SCROLLER_USE_CODE)(app, window, vue, vue.createApp, vue.h, available ? { Scroller } : {});
		const container = document.createElement('div');
		app.mount(container);
		expect(injected).toBe(target.$docsPlayground);
		expect(container.textContent).toBe('ready');
		target.__app__.unmount();
		expect(target.$docsPlayground).toBeUndefined();
		delete target.__app__;
		document.documentElement.className = '';
	});
});
