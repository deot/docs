import {
	onBeforeUnmount,
	ref,
	unref,
	watch
} from 'vue';
import type { Ref, ShallowRef } from 'vue';

export const MIN_RUNTIME_HEIGHT = 24;

type SandboxContainer = HTMLElement | null | Readonly<ShallowRef<HTMLElement | null>>;

export interface SandboxExposed {
	container?: SandboxContainer;
}

export const resolveSandboxContainer = (sandbox: SandboxExposed | null) => sandbox?.container
	? unref(sandbox.container)
	: null;

export const useSandboxAutoHeight = (sandboxRef: Ref<SandboxExposed | null>) => {
	const height = ref(MIN_RUNTIME_HEIGHT);
	let container: HTMLElement | null = null;
	let iframe: HTMLIFrameElement | null = null;
	let containerObserver: MutationObserver | null = null;
	let contentObserver: ResizeObserver | null = null;
	let frameId = 0;

	const cancelMeasure = () => {
		if (!frameId) return;
		cancelAnimationFrame(frameId);
		frameId = 0;
	};

	const measure = () => {
		frameId = 0;
		if (!iframe) return;
		try {
			const iframeWindow = iframe.contentWindow;
			const iframeDocument = iframe.contentDocument;
			if (!iframeWindow || !iframeDocument?.body) return;

			const { body, documentElement } = iframeDocument;
			const bodyStyle = iframeWindow.getComputedStyle(body);
			const bodyMargins = (Number.parseFloat(bodyStyle.marginTop) || 0)
				+ (Number.parseFloat(bodyStyle.marginBottom) || 0);
			const bodyRect = body.getBoundingClientRect();
			let childrenBottom = 0;
			for (const child of body.children) {
				childrenBottom = Math.max(
					childrenBottom,
					child.getBoundingClientRect().bottom - bodyRect.top
				);
			}
			const scrollHeight = Math.max(body.scrollHeight, documentElement.scrollHeight);
			const overflowingHeight = scrollHeight > iframe.clientHeight + 1
				? scrollHeight
				: 0;
			const contentHeight = Math.ceil(Math.max(
				body.offsetHeight + bodyMargins,
				bodyRect.height + bodyMargins,
				childrenBottom + bodyMargins,
				overflowingHeight
			));
			const nextHeight = Math.max(contentHeight, MIN_RUNTIME_HEIGHT);
			if (height.value !== nextHeight) height.value = nextHeight;
		} catch {
			if (height.value !== MIN_RUNTIME_HEIGHT) height.value = MIN_RUNTIME_HEIGHT;
		}
	};

	const scheduleMeasure = () => {
		if (frameId) return;
		frameId = requestAnimationFrame(measure);
	};

	const disconnectContent = () => {
		contentObserver?.disconnect();
		contentObserver = null;
		cancelMeasure();
	};

	const observeContent = () => {
		disconnectContent();
		if (!iframe) return;
		try {
			const iframeWindow = iframe.contentWindow;
			const iframeDocument = iframe.contentDocument;
			const Observer = (iframeWindow as Window & typeof globalThis | null)?.ResizeObserver;
			if (!iframeWindow || !iframeDocument?.body || !Observer) {
				scheduleMeasure();
				return;
			}
			const observer = new Observer(scheduleMeasure);
			observer.observe(iframeDocument.documentElement);
			observer.observe(iframeDocument.body);
			contentObserver = observer;
			scheduleMeasure();
		} catch {
			if (height.value !== MIN_RUNTIME_HEIGHT) height.value = MIN_RUNTIME_HEIGHT;
		}
	};

	const handleIframeLoad = () => observeContent();

	const setIframe = (nextIframe: HTMLIFrameElement | null) => {
		if (iframe === nextIframe) return;
		iframe?.removeEventListener('load', handleIframeLoad);
		disconnectContent();
		iframe = nextIframe;
		if (!iframe) {
			height.value = MIN_RUNTIME_HEIGHT;
			return;
		}
		iframe.addEventListener('load', handleIframeLoad);
		iframe.style.height = '100%';
		observeContent();
	};

	const syncIframe = () => setIframe(container?.querySelector('iframe') || null);

	const setContainer = (nextContainer: HTMLElement | null) => {
		if (container === nextContainer) return;
		containerObserver?.disconnect();
		containerObserver = null;
		container = nextContainer;
		setIframe(null);
		if (!container) return;
		containerObserver = new MutationObserver(syncIframe);
		containerObserver.observe(container, { childList: true, subtree: true });
		syncIframe();
	};

	watch(
		() => resolveSandboxContainer(sandboxRef.value),
		setContainer,
		{ flush: 'post', immediate: true }
	);

	onBeforeUnmount(() => {
		setContainer(null);
		cancelMeasure();
	});

	return height;
};
