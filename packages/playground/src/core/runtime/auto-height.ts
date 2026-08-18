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
	/**
	 * `@vue/repl` sandbox 根节点，用来测量运行时高度。
	 */
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
			// 标题默认 margin 会穿过 body 折叠到 html 外侧；相对 body 测量会漏掉这段高度，
			// 再和 html{height:100%} 的 scrollHeight 来回取值，预览就会抖动。
			const rootTop = documentElement.getBoundingClientRect().top;
			const bodyRect = body.getBoundingClientRect();
			const collapsedTop = Math.max(0, bodyRect.top - rootTop);
			let childrenBottom = 0;
			for (const child of body.children) {
				const rect = child.getBoundingClientRect();
				const marginBottom = Number.parseFloat(
					iframeWindow.getComputedStyle(child).marginBottom
				) || 0;
				childrenBottom = Math.max(
					childrenBottom,
					rect.bottom + marginBottom - rootTop
				);
			}
			const scrollHeight = Math.max(body.scrollHeight, documentElement.scrollHeight);
			const overflowingHeight = scrollHeight > iframe.clientHeight + 1
				? scrollHeight
				: 0;
			const contentHeight = Math.ceil(Math.max(
				body.offsetHeight + bodyMargins + collapsedTop,
				bodyRect.height + bodyMargins + collapsedTop,
				childrenBottom,
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
