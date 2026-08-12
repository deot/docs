import { onBeforeUnmount, watch } from 'vue';
import type { Ref } from 'vue';
import { resolveSandboxContainer } from './auto-height';
import type { SandboxExposed } from './auto-height';

type SandboxTheme = 'light' | 'dark';

const resolveElementTheme = (element: Element | null): SandboxTheme | null => {
	const vcTheme = element?.getAttribute('data-vc-theme');
	if (vcTheme === 'light' || vcTheme === 'dark') return vcTheme;
	const docsTheme = element?.getAttribute('data-doc-theme');
	return docsTheme === 'light' || docsTheme === 'dark' ? docsTheme : null;
};

const resolveHostTheme = (container: HTMLElement | null): SandboxTheme | null => {
	let current: Element | null = container;
	while (current) {
		const theme = resolveElementTheme(current);
		if (theme) return theme;
		current = current.parentElement;
	}
	return typeof document === 'undefined'
		? null
		: resolveElementTheme(document.body) || resolveElementTheme(document.documentElement);
};

export const syncSandboxTheme = (
	iframe: HTMLIFrameElement | null,
	theme: SandboxTheme | null
) => {
	if (!iframe) return;
	try {
		const iframeDocument = iframe.contentDocument;
		if (!iframeDocument?.body) return;
		if (!theme) {
			iframeDocument.body.removeAttribute('data-doc-theme');
			iframeDocument.body.removeAttribute('data-vc-theme');
			iframeDocument.documentElement.removeAttribute('data-doc-theme');
			iframeDocument.documentElement.removeAttribute('data-vc-theme');
			iframeDocument.documentElement.style.removeProperty('color-scheme');
			return;
		}
		iframeDocument.body.setAttribute('data-doc-theme', theme);
		iframeDocument.body.setAttribute('data-vc-theme', theme);
		iframeDocument.documentElement.setAttribute('data-doc-theme', theme);
		iframeDocument.documentElement.setAttribute('data-vc-theme', theme);
		iframeDocument.documentElement.style.colorScheme = theme;
	} catch {
		// 跨域 iframe 无法访问文档时保留预览自身的主题行为。
	}
};

export const useSandboxTheme = (sandboxRef: Ref<SandboxExposed | null>) => {
	let container: HTMLElement | null = null;
	let iframe: HTMLIFrameElement | null = null;
	let containerObserver: MutationObserver | null = null;
	let themeObserver: MutationObserver | null = null;

	const syncTheme = () => syncSandboxTheme(iframe, resolveHostTheme(container));
	const handleIframeLoad = () => syncTheme();

	const setIframe = (nextIframe: HTMLIFrameElement | null) => {
		if (iframe === nextIframe) {
			syncTheme();
			return;
		}
		iframe?.removeEventListener('load', handleIframeLoad);
		iframe = nextIframe;
		iframe?.addEventListener('load', handleIframeLoad);
		syncTheme();
	};

	const syncIframe = () => setIframe(container?.querySelector('iframe') || null);
	const setContainer = (nextContainer: HTMLElement | null) => {
		if (container === nextContainer) {
			syncIframe();
			return;
		}
		containerObserver?.disconnect();
		containerObserver = null;
		container = nextContainer;
		setIframe(null);
		if (!container) return;
		if (typeof MutationObserver !== 'undefined') {
			containerObserver = new MutationObserver(syncIframe);
			containerObserver.observe(container, { childList: true, subtree: true });
		}
		syncIframe();
	};

	watch(
		() => resolveSandboxContainer(sandboxRef.value),
		setContainer,
		{ flush: 'post', immediate: true }
	);

	if (typeof document !== 'undefined' && typeof MutationObserver !== 'undefined') {
		themeObserver = new MutationObserver(syncTheme);
		// 主题可以声明在 Playground 的任意祖先节点，观察根子树才能在覆盖被移除时
		// 重新回退到 body 或 html 的主题，而不会让 iframe 留在旧状态。
		themeObserver.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ['data-doc-theme', 'data-vc-theme'],
			subtree: true
		});
	}

	onBeforeUnmount(() => {
		themeObserver?.disconnect();
		themeObserver = null;
		setContainer(null);
	});
};
