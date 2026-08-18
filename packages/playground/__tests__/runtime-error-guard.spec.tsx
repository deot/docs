// @vitest-environment jsdom

import {
	defineComponent,
	nextTick,
	shallowRef
} from 'vue';
import type { Ref } from 'vue';
import { mount } from '@vue/test-utils';
import type { SandboxExposed } from '../src/core/runtime/auto-height';
import {
	SANDBOX_RUNTIME_ERROR_CAPTURE_HTML,
	UNKNOWN_RUNTIME_ERROR,
	formatSandboxRuntimeError,
	forwardSandboxRuntimeError,
	normalizeRuntimeErrorMessage,
	toErrorText,
	useSandboxRuntimeErrorGuard
} from '../src/core/runtime/error-guard';

describe('runtime error guard', () => {
	it('forwards the browser message when ErrorEvent loses its error value', () => {
		const postMessage = vi.spyOn(window.parent, 'postMessage').mockImplementation(() => {});
		const missingError = new ErrorEvent('error', {
			error: null,
			message: 'Uncaught null'
		});
		const stopImmediatePropagation = vi.spyOn(missingError, 'stopImmediatePropagation');

		forwardSandboxRuntimeError(missingError);
		expect(stopImmediatePropagation).toHaveBeenCalledTimes(1);
		expect(postMessage).toHaveBeenCalledWith({
			action: 'error',
			value: 'Uncaught null'
		}, '*');
		expect(SANDBOX_RUNTIME_ERROR_CAPTURE_HTML).toContain('addEventListener');

		postMessage.mockClear();
		const resizeObserverWarning = new ErrorEvent('error', {
			error: null,
			message: 'ResizeObserver loop completed with undelivered notifications.'
		});
		const stopResizeObserverWarning = vi.spyOn(
			resizeObserverWarning,
			'stopImmediatePropagation'
		);
		forwardSandboxRuntimeError(resizeObserverWarning);
		expect(stopResizeObserverWarning).toHaveBeenCalledTimes(1);
		expect(postMessage).not.toHaveBeenCalled();

		forwardSandboxRuntimeError(new ErrorEvent('error', {
			error: new Error('render failed'),
			message: 'Uncaught Error: render failed'
		}));
		expect(postMessage).not.toHaveBeenCalled();
		postMessage.mockRestore();
	});

	it('normalizes invalid runtime error values', () => {
		const empty = { action: 'error', value: null };
		const objectError = { action: 'error', value: { message: 'render failed' } };
		const fallbackMessage = { action: 'error', value: null, message: 'script failed' };
		const unprintableError = {
			action: 'error',
			value: { toString: () => { throw new Error('stringify failed'); } }
		};

		expect(normalizeRuntimeErrorMessage(empty)).toBe(true);
		expect(empty.value).toBe(UNKNOWN_RUNTIME_ERROR);
		normalizeRuntimeErrorMessage(objectError);
		expect(objectError.value).toBe('render failed');
		normalizeRuntimeErrorMessage(fallbackMessage);
		expect(fallbackMessage.value).toBe('script failed');
		normalizeRuntimeErrorMessage(unprintableError);
		expect(unprintableError.value).toBe(UNKNOWN_RUNTIME_ERROR);
		expect(normalizeRuntimeErrorMessage({ action: 'console', value: null })).toBe(false);
		expect(toErrorText('compile failed')).toBe('compile failed');
		expect(toErrorText(new Error('parse failed'))).toBe('parse failed');
		expect(toErrorText(null)).toBe('');
		expect(formatSandboxRuntimeError(
			'Failed to resolve module specifier "lodash". Relative references must start with "/", "./" or "../".',
			'Check the import path.'
		)).toBe('Failed to resolve module specifier "lodash".\nCheck the import path.');
		expect(formatSandboxRuntimeError('Uncaught TypeError: x is not a function', 'unused'))
			.toBe('Uncaught TypeError: x is not a function');
	});

	it('guards only messages from the current sandbox and releases the listener', async () => {
		let sandboxRef!: Ref<SandboxExposed | null>;
		let runtimeError!: Ref<string>;
		const Harness = defineComponent({
			setup() {
				sandboxRef = shallowRef<SandboxExposed | null>(null);
				runtimeError = useSandboxRuntimeErrorGuard(sandboxRef);
				return () => <div />;
			}
		});
		const wrapper = mount(Harness);
		const container = document.createElement('div');
		const iframe = document.createElement('iframe');
		container.appendChild(iframe);
		document.body.appendChild(container);
		sandboxRef.value = { container };
		await nextTick();

		const currentError = { action: 'error', value: null };
		const replHandler = vi.fn((event: MessageEvent) => {
			if (event.source !== iframe.contentWindow) return;
			expect((event.data.value as string).includes('module specifier')).toBe(false);
		});
		window.addEventListener('message', replHandler);
		expect(() => window.dispatchEvent(new MessageEvent('message', {
			data: currentError,
			source: iframe.contentWindow
		}))).not.toThrow();
		expect(currentError.value).toBe(UNKNOWN_RUNTIME_ERROR);
		expect(runtimeError.value).toBe(UNKNOWN_RUNTIME_ERROR);
		expect(replHandler).toHaveBeenCalledTimes(1);
		window.removeEventListener('message', replHandler);

		const unrelatedError = { action: 'error', value: null };
		window.dispatchEvent(new MessageEvent('message', { data: unrelatedError }));
		expect(unrelatedError.value).toBeNull();

		wrapper.unmount();
		const afterUnmount = { action: 'error', value: null };
		window.dispatchEvent(new MessageEvent('message', {
			data: afterUnmount,
			source: iframe.contentWindow
		}));
		expect(afterUnmount.value).toBeNull();
		container.remove();
	});
});
