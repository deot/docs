import { nextTick, onBeforeUnmount, ref, watch } from 'vue';
import type { Ref } from 'vue';
import { resolveSandboxContainer } from './auto-height';
import type { SandboxExposed } from './auto-height';

/**
 * 只接收本宿主当前 iframe 的高度请求，应用重评时切换会话。
 * @param sandbox 预览容器。
 * @param maxHeight 当前可用高度，普通预览默认不限制。
 * @returns 所有有效请求的最大高度。
 */
export function usePreviewHeightBridge(
	sandbox: Ref<SandboxExposed | null>,
	maxHeight: () => number = () => Infinity
) {
	const height = ref(0);
	const requests = new Map<number, number>();
	let source: Window | null = null;
	let session = '';
	let disposed = false;
	const sync = () => { height.value = Math.max(0, ...requests.values()); };
	const reset = () => {
		requests.clear();
		session = '';
		source = null;
		sync();
	};
	const handleMessage = async (event: MessageEvent) => {
		const iframe = resolveSandboxContainer(sandbox.value)?.querySelector('iframe');
		const data = event.data;
		if (!iframe?.contentWindow || event.source !== iframe.contentWindow
			|| data?.action !== 'docs:height' || typeof data.session !== 'string') return;
		if (data.operation === 'start') {
			reset();
			source = iframe.contentWindow;
			session = data.session;
			return;
		}
		if (source !== iframe.contentWindow || session !== data.session) return;
		if (data.operation === 'stop') {
			reset();
			return;
		}
		if (!Number.isSafeInteger(data.id) || data.id <= 0) return;
		if (data.operation === 'release') {
			requests.delete(data.id);
			sync();
			return;
		}
		if (data.operation !== 'enable' || !Number.isFinite(data.height) || data.height <= 0) return;
		const accepted = data.height <= maxHeight();
		if (accepted) requests.set(data.id, data.height);
		sync();
		const receiver = source;
		await nextTick();
		if (disposed || source !== receiver || session !== data.session) return;
		receiver?.postMessage({
			action: 'docs:height:applied',
			session,
			id: data.id,
			accepted
		}, '*');
	};
	watch(() => resolveSandboxContainer(sandbox.value), reset, { flush: 'sync' });
	if (typeof window !== 'undefined') window.addEventListener('message', handleMessage);
	onBeforeUnmount(() => {
		disposed = true;
		if (typeof window !== 'undefined') window.removeEventListener('message', handleMessage);
		reset();
	});
	return height;
}
