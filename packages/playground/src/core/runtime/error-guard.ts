import { onBeforeUnmount, ref } from 'vue';
import type { Ref } from 'vue';
import { resolveSandboxContainer } from './auto-height';
import type { SandboxExposed } from './auto-height';

export const UNKNOWN_RUNTIME_ERROR = '运行时发生未知错误';
const MODULE_SPECIFIER_RE = /Failed to resolve module specifier|Error resolving module specifier/u;

export const forwardSandboxRuntimeError = (event: ErrorEvent) => {
	if (!(event instanceof ErrorEvent) || event.error != null || !event.message) return;
	event.stopImmediatePropagation();
	if (
		event.message === 'ResizeObserver loop limit exceeded'
		|| event.message === 'ResizeObserver loop completed with undelivered notifications.'
	) return;
	window.parent.postMessage({ action: 'error', value: event.message }, '*');
};

export const SANDBOX_RUNTIME_ERROR_CAPTURE_HTML = [
	'<script>',
	`window.addEventListener('error', ${forwardSandboxRuntimeError.toString()}, true);`,
	'</script>'
].join('\n');

interface RuntimeErrorMessage {
	action?: unknown;
	message?: unknown;
	value?: unknown;
}

const toRuntimeErrorMessage = (value: unknown, message: unknown) => {
	if (typeof value === 'string' && value) return value;
	if (value instanceof Error && value.message) return value.message;
	if (value && typeof value === 'object' && 'message' in value) {
		const valueMessage = (value as { message?: unknown }).message;
		if (typeof valueMessage === 'string' && valueMessage) return valueMessage;
	}
	if (typeof message === 'string' && message) return message;
	if (value !== null && value !== undefined) {
		try {
			return String(value);
		} catch {
			return UNKNOWN_RUNTIME_ERROR;
		}
	}
	return UNKNOWN_RUNTIME_ERROR;
};

export const normalizeRuntimeErrorMessage = (data: unknown) => {
	if (!data || typeof data !== 'object') return false;
	const message = data as RuntimeErrorMessage;
	if (message.action !== 'error') return false;
	message.value = toRuntimeErrorMessage(message.value, message.message);
	return true;
};

export const toErrorText = (value: unknown) => {
	if (typeof value === 'string' && value) return value;
	if (value instanceof Error && value.message) return value.message;
	return '';
};

export const formatSandboxRuntimeError = (message: string, importMapTip: string) => {
	if (!MODULE_SPECIFIER_RE.test(message)) return message;
	const cleaned = message.replace(/\. Relative references must.*$/u, '').replace(/\.$/u, '');
	return `${cleaned}.\n${importMapTip}`;
};

export const useSandboxRuntimeErrorGuard = (sandboxRef: Ref<SandboxExposed | null>) => {
	const error = ref('');
	if (typeof window === 'undefined') return error;
	const handleMessage = (event: MessageEvent) => {
		const iframe = resolveSandboxContainer(sandboxRef.value)?.querySelector('iframe');
		if (!iframe || event.source !== iframe.contentWindow) return;
		if (!normalizeRuntimeErrorMessage(event.data)) return;
		error.value = (event.data as RuntimeErrorMessage).value as string;
	};

	window.addEventListener('message', handleMessage, true);
	onBeforeUnmount(() => window.removeEventListener('message', handleMessage, true));
	return error;
};
