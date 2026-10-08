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
import {
	PREVIEW_SCROLL_CONTENT_CLASS,
	PREVIEW_SCROLL_HTML_CLASS
} from '../src/core/preview-scroll';
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

const mockBox = (element: Element, size: number) => {
	Object.defineProperties(element, {
		offsetHeight: { configurable: true, get: () => size },
		scrollHeight: { configurable: true, get: () => size }
	});
	element.getBoundingClientRect = () => ({
		x: 0,
		y: 0,
		top: 0,
		left: 0,
		right: 0,
		width: 0,
		height: size,
		bottom: size,
		toJSON: () => ({})
	});
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
		expect(preview.iframe.style.height).toBe(`${window.innerHeight}px`);
		expect(runtimeHeight.value).toBe(MIN_RUNTIME_HEIGHT);
		expect(wrapper.attributes('data-height')).toBe(String(MIN_RUNTIME_HEIGHT));
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

	it('does not retain temporary viewport height from a fixed overlay', async () => {
		const preview = createIframe(64);
		const overlay = preview.iframe.contentDocument!.createElement('div');
		overlay.style.position = 'fixed';
		mockBox(overlay, 560);
		preview.iframe.contentDocument!.body.appendChild(overlay);
		Object.defineProperty(preview.iframe, 'clientHeight', { get: () => 560 });
		let height!: Ref<number>;
		const wrapper = mount(defineComponent({
			setup() {
				height = useSandboxAutoHeight(shallowRef({ container: document.body }));
				return () => <div />;
			}
		}));
		await nextTick();
		flushFrames();
		expect(height.value).toBe(64);
		wrapper.unmount();
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

	it('measures Scroller content when preview scroll class is present', async () => {
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
		const container = document.createElement('div');
		container.appendChild(iframe);
		document.body.appendChild(container);
		const iframeWindow = iframe.contentWindow as Window & typeof globalThis;
		const iframeDocument = iframe.contentDocument as Document;
		Object.defineProperty(iframeWindow, 'ResizeObserver', {
			configurable: true,
			value: ResizeObserverMock
		});
		Object.defineProperty(iframe, 'clientHeight', {
			configurable: true,
			get: () => 146
		});
		Object.defineProperties(iframeDocument.body, {
			offsetHeight: { configurable: true, get: () => 146 },
			scrollHeight: { configurable: true, get: () => 146 }
		});
		Object.defineProperties(iframeDocument.documentElement, {
			offsetHeight: { configurable: true, get: () => 146 },
			scrollHeight: { configurable: true, get: () => 146 }
		});

		sandboxRef.value = { container };
		await nextTick();
		flushFrames();
		await nextTick();
		expect(runtimeHeight.value).toBe(146);

		// await import('@deot/vc') 成功后才会挂 class 与内容节点。
		iframeDocument.documentElement.classList.add(PREVIEW_SCROLL_HTML_CLASS);
		const app = iframeDocument.createElement('div');
		app.id = 'app';
		const scrollContent = iframeDocument.createElement('div');
		scrollContent.className = PREVIEW_SCROLL_CONTENT_CLASS;
		const inner = iframeDocument.createElement('div');
		scrollContent.appendChild(inner);
		app.appendChild(scrollContent);
		iframeDocument.body.appendChild(app);
		mockBox(scrollContent, 320);
		mockBox(inner, 320);
		await nextTick();
		flushFrames();
		await nextTick();
		expect(runtimeHeight.value).toBe(320);

		iframeDocument.documentElement.classList.remove(PREVIEW_SCROLL_HTML_CLASS);
		iframeDocument.body.replaceChildren();
		const emptyApp = iframeDocument.createElement('div');
		emptyApp.id = 'app';
		iframeDocument.body.appendChild(emptyApp);
		await nextTick();
		flushFrames();
		await nextTick();
		expect(runtimeHeight.value).toBe(320);

		iframeDocument.documentElement.classList.add(PREVIEW_SCROLL_HTML_CLASS);
		const nextContent = iframeDocument.createElement('div');
		nextContent.className = PREVIEW_SCROLL_CONTENT_CLASS;
		const nextInner = iframeDocument.createElement('div');
		nextContent.appendChild(nextInner);
		emptyApp.appendChild(nextContent);
		mockBox(nextContent, 410);
		mockBox(nextInner, 410);
		await nextTick();
		flushFrames();
		await nextTick();
		expect(runtimeHeight.value).toBe(410);
	});

	it('keeps inline line-box height stable and lets natural content shrink', async () => {
		vi.stubGlobal('ResizeObserver', ResizeObserverMock);
		const container = document.createElement('div');
		container.className = 'docs-playground-local';
		const mountPoint = document.createElement('div');
		mountPoint.className = 'docs-playground-local__mount docs-playground-local__mount--auto';
		const strong = document.createElement('strong');
		strong.textContent = 'Runtime first';
		mountPoint.appendChild(strong);
		container.appendChild(mountPoint);
		document.body.appendChild(container);
		let naturalHeight = 28;
		let height!: Ref<number>;
		mockBox(strong, 22);
		Object.defineProperties(mountPoint, {
			offsetHeight: { get: () => naturalHeight },
			clientHeight: { get: () => height.value },
			scrollHeight: { get: () => Math.max(naturalHeight, height.value) }
		});
		const wrapper = mount(defineComponent({
			setup() {
				height = useSandboxAutoHeight(shallowRef({ container }));
				return () => <div />;
			}
		}));
		await nextTick();
		flushFrames();
		const observer = ResizeObserverMock.instances.at(-1)!;
		for (let index = 0; index < 4; index++) {
			expect(height.value).toBe(28);
			observer.trigger();
			flushFrames();
		}
		naturalHeight = 56;
		observer.trigger();
		flushFrames();
		expect(height.value).toBe(56);
		naturalHeight = 28;
		observer.trigger();
		flushFrames();
		expect(height.value).toBe(28);
		wrapper.unmount();
	});

	it('measures local sandbox content instead of its bridge iframe', async () => {
		vi.stubGlobal('ResizeObserver', ResizeObserverMock);
		const container = document.createElement('div');
		container.className = 'docs-playground-local';
		const mountPoint = document.createElement('div');
		mountPoint.className = 'docs-playground-local__mount';
		const child = document.createElement('p');
		mountPoint.appendChild(child);
		container.appendChild(mountPoint);
		document.body.appendChild(container);
		mockBox(mountPoint, 180);
		mockBox(child, 180);
		let height!: Ref<number>;
		const wrapper = mount(defineComponent({
			setup() {
				height = useSandboxAutoHeight(shallowRef({ container }));
				return () => <div />;
			}
		}));
		await nextTick();
		flushFrames();
		expect(height.value).toBe(180);
		const extra = document.createElement('span');
		mountPoint.appendChild(extra);
		mockBox(extra, 240);
		mockBox(mountPoint, 240);
		await nextTick();
		flushFrames();
		expect(height.value).toBe(240);
		// mount 沿用上一次预览高度；内容缩短时不能被它的 offsetHeight 卡住。
		Object.defineProperty(mountPoint, 'clientHeight', { get: () => 240 });
		extra.remove();
		mockBox(child, 64);
		await nextTick();
		flushFrames();
		expect(height.value).toBe(64);
		const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		mockBox(svg, 96);
		mountPoint.replaceChildren(svg);
		await nextTick();
		flushFrames();
		expect(height.value).toBe(96);
		wrapper.unmount();
	});
});
