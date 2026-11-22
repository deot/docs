import { onBeforeUnmount, watch } from 'vue';
import type { Ref } from 'vue';
import { resolveSandboxContainer } from './auto-height';
import type { SandboxExposed } from './auto-height';
import { applyPreviewRootVars } from './preview-variables';
import type { PreviewRootVars } from './preview-variables';

/**
 * 把预览变量写到 iframe 的 documentElement。local 预览由挂载根的 style 绑定负责，这里不启用。
 * @param sandboxRef 当前预览实例。
 * @param vars 要写入的变量。
 * @param enabled iframe 预览为 true。
 */
export const usePreviewRootVars = (
	sandboxRef: Ref<SandboxExposed | null>,
	vars: Ref<PreviewRootVars>,
	enabled: Ref<boolean>
) => {
	let container: HTMLElement | null = null;
	let iframe: HTMLIFrameElement | null = null;
	let observer: MutationObserver | null = null;

	const apply = () => {
		if (!enabled.value || !iframe) return;
		try {
			const root = iframe.contentDocument?.documentElement;
			if (!root) return;
			applyPreviewRootVars(root, vars.value);
		} catch {
			// 跨域 iframe 无法写入预览根变量。
		}
	};
	const handleLoad = () => apply();
	const setIframe = (next: HTMLIFrameElement | null) => {
		if (iframe === next) {
			apply();
			return;
		}
		iframe?.removeEventListener('load', handleLoad);
		iframe = next;
		iframe?.addEventListener('load', handleLoad);
		apply();
	};
	const syncIframe = () => setIframe(container?.querySelector('iframe') ?? null);
	const setContainer = (next: HTMLElement | null) => {
		if (container === next) {
			syncIframe();
			return;
		}
		observer?.disconnect();
		observer = null;
		container = next;
		setIframe(null);
		if (!container) return;
		if (typeof MutationObserver !== 'undefined') {
			observer = new MutationObserver(syncIframe);
			observer.observe(container, { childList: true, subtree: true });
		}
		syncIframe();
	};

	watch(
		() => (enabled.value ? resolveSandboxContainer(sandboxRef.value) : null),
		setContainer,
		{ flush: 'post', immediate: true }
	);
	watch(vars, apply, { deep: true });

	onBeforeUnmount(() => {
		observer?.disconnect();
		observer = null;
		iframe?.removeEventListener('load', handleLoad);
		iframe = null;
	});
};
