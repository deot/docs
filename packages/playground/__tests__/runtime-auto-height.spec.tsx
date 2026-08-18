// @vitest-environment jsdom

import {
	defineComponent,
	nextTick,
	shallowRef
} from 'vue';
import type { Ref } from 'vue';
import { mount } from '@vue/test-utils';
import {
	MIN_RUNTIME_HEIGHT,
	useSandboxAutoHeight
} from '../src/core/runtime/auto-height';
import type { SandboxExposed } from '../src/core/runtime/auto-height';
import { invalid } from './fixtures';

class ResizeObserverMock {
	static instances: ResizeObserverMock[] = [];
	callback: ResizeObserverCallback;
	disconnect = vi.fn();
	observe = vi.fn();
	unobserve = vi.fn();

	constructor(callback: ResizeObserverCallback) {
		this.callback = callback;
		ResizeObserverMock.instances.push(this);
	}

	trigger() {
		this.callback([], invalid<ResizeObserver>(this));
	}
}

const createIframe = (initialHeight: number) => {
	const iframe = document.createElement('iframe');
	document.body.appendChild(iframe);
	const iframeWindow = iframe.contentWindow as Window & typeof globalThis;
	const iframeDocument = iframe.contentDocument as Document;
	let contentHeight = initialHeight;
	iframeDocument.body.style.margin = '0';
	Object.defineProperty(iframeWindow, 'ResizeObserver', {
		configurable: true,
		value: ResizeObserverMock
	});
	for (const element of [iframeDocument.body, iframeDocument.documentElement]) {
		Object.defineProperties(element, {
			offsetHeight: { configurable: true, get: () => contentHeight },
			scrollHeight: { configurable: true, get: () => contentHeight }
		});
	}
	return {
		iframe,
		setHeight: (height: number) => (contentHeight = height)
	};
};

describe('runtime auto height', () => {
	let callbacks: Map<number, FrameRequestCallback>;
	let frameId: number;
	let cancelAnimationFrame: ReturnType<typeof vi.fn>;

	const flushFrames = () => {
		const pending = [...callbacks.values()];
		callbacks.clear();
		for (const callback of pending) callback(0);
	};

	beforeEach(() => {
		callbacks = new Map();
		frameId = 0;
		ResizeObserverMock.instances = [];
		vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
			const id = ++frameId;
			callbacks.set(id, callback);
			return id;
		}));
		cancelAnimationFrame = vi.fn((id: number) => callbacks.delete(id));
		vi.stubGlobal('cancelAnimationFrame', cancelAnimationFrame);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		document.body.innerHTML = '';
	});

	it('grows, shrinks and batches resize notifications', async () => {
		let sandboxRef!: Ref<SandboxExposed | null>;
		let runtimeHeight!: Ref<number>;
		const Harness = defineComponent({
			setup() {
				sandboxRef = shallowRef<SandboxExposed | null>(null);
				runtimeHeight = useSandboxAutoHeight(sandboxRef);
				return () => <div data-height={runtimeHeight.value} />;
			}
		});
		const wrapper = mount(Harness);
		const container = document.createElement('div');
		const preview = createIframe(320);
		container.appendChild(preview.iframe);
		sandboxRef.value = { container };
		await nextTick();
		flushFrames();
		await nextTick();

		expect(runtimeHeight.value).toBe(320);
		expect(preview.iframe.style.height).toBe('100%');
		const observer = ResizeObserverMock.instances.at(-1) as ResizeObserverMock;
		preview.setHeight(MIN_RUNTIME_HEIGHT - 1);
		observer.trigger();
		observer.trigger();
		expect(callbacks).toHaveLength(1);
		flushFrames();
		await nextTick();
		expect(runtimeHeight.value).toBe(MIN_RUNTIME_HEIGHT);
		expect(wrapper.attributes('data-height')).toBe(String(MIN_RUNTIME_HEIGHT));
	});

	it('keeps collapsing heading margins so html 100% height does not oscillate', async () => {
		const bodyHeight = 82;
		const collapsedTop = 18;
		const intrinsic = bodyHeight + collapsedTop;
		let iframeHeight = intrinsic;
		let sandboxRef!: Ref<SandboxExposed | null>;
		let runtimeHeight!: Ref<number>;
		const Harness = defineComponent({
			setup() {
				sandboxRef = shallowRef<SandboxExposed | null>(null);
				runtimeHeight = useSandboxAutoHeight(sandboxRef);
				return () => <div />;
			}
		});
		mount(Harness);
		const iframe = document.createElement('iframe');
		document.body.appendChild(iframe);
		const iframeWindow = iframe.contentWindow as Window & typeof globalThis;
		const iframeDocument = iframe.contentDocument as Document;
		const app = iframeDocument.createElement('div');
		iframeDocument.body.appendChild(app);
		Object.defineProperty(iframeWindow, 'ResizeObserver', {
			configurable: true,
			value: ResizeObserverMock
		});
		Object.defineProperty(iframe, 'clientHeight', {
			configurable: true,
			get: () => iframeHeight
		});
		const htmlRect = () => ({
			x: 0,
			y: 0,
			top: 0,
			left: 0,
			right: 0,
			width: 0,
			height: iframeHeight,
			bottom: iframeHeight,
			toJSON: () => ({})
		});
		const bodyRect = () => ({
			x: 0,
			y: collapsedTop,
			top: collapsedTop,
			left: 0,
			right: 0,
			width: 0,
			height: bodyHeight,
			bottom: collapsedTop + bodyHeight,
			toJSON: () => ({})
		});
		iframeDocument.documentElement.getBoundingClientRect = htmlRect;
		iframeDocument.body.getBoundingClientRect = bodyRect;
		app.getBoundingClientRect = bodyRect;
		Object.defineProperties(iframeDocument.body, {
			offsetHeight: { configurable: true, get: () => bodyHeight },
			scrollHeight: { configurable: true, get: () => bodyHeight }
		});
		Object.defineProperties(iframeDocument.documentElement, {
			offsetHeight: { configurable: true, get: () => iframeHeight },
			scrollHeight: { configurable: true, get: () => Math.max(iframeHeight, intrinsic) }
		});
		const container = document.createElement('div');
		container.appendChild(iframe);
		sandboxRef.value = { container };
		await nextTick();
		flushFrames();
		await nextTick();
		expect(runtimeHeight.value).toBe(intrinsic);

		iframeHeight = runtimeHeight.value;
		const observer = ResizeObserverMock.instances.at(-1) as ResizeObserverMock;
		observer.trigger();
		flushFrames();
		await nextTick();
		expect(runtimeHeight.value).toBe(intrinsic);
		iframeHeight = runtimeHeight.value;
		observer.trigger();
		flushFrames();
		await nextTick();
		expect(runtimeHeight.value).toBe(intrinsic);
	});

	it('rebinds a replaced iframe and releases its resources', async () => {
		let sandboxRef!: Ref<SandboxExposed | null>;
		let runtimeHeight!: Ref<number>;
		const Harness = defineComponent({
			setup() {
				sandboxRef = shallowRef<SandboxExposed | null>(null);
				runtimeHeight = useSandboxAutoHeight(sandboxRef);
				return () => <div />;
			}
		});
		const wrapper = mount(Harness);
		const container = document.createElement('div');
		const first = createIframe(240);
		container.appendChild(first.iframe);
		sandboxRef.value = { container };
		await nextTick();
		flushFrames();
		const firstObserver = ResizeObserverMock.instances.at(-1) as ResizeObserverMock;

		const second = createIframe(410);
		container.replaceChildren(second.iframe);
		await nextTick();
		flushFrames();
		await nextTick();
		expect(firstObserver.disconnect).toHaveBeenCalledTimes(1);
		expect(runtimeHeight.value).toBe(410);

		const secondObserver = ResizeObserverMock.instances.at(-1) as ResizeObserverMock;
		secondObserver.trigger();
		expect(callbacks).toHaveLength(1);
		wrapper.unmount();
		expect(secondObserver.disconnect).toHaveBeenCalledTimes(1);
		expect(cancelAnimationFrame).toHaveBeenCalledTimes(1);
	});
});
