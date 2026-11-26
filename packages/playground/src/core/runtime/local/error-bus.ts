import { getActivePreview } from './activity';
import { formatPlaygroundErrorArgument, formatPlaygroundRuntimeError } from './format-error';
import { PLAYGROUND_SOURCE_URL_PREFIX } from './linker';

/**
 * local 预览与页面同文档，未处理的 Promise 拒绝、全局错误和 console.error 都发生在宿主 window 上。
 * 这里统一监听，按调用栈里的 sourceURL 或「刚刚操作过的预览」归属，再交给对应预览显示。
 * 不阻止默认行为：错误仍然出现在控制台。
 */

type Report = (message: string) => void;

const reporters = new Map<string, Report>();
let uninstall: (() => void) | undefined;

const stackOf = (value: unknown) => (
	value && typeof value === 'object' && typeof (value as { stack?: unknown }).stack === 'string'
		? (value as { stack: string }).stack
		: ''
);

const scopeFromStack = (stack: string) => {
	if (!stack) return undefined;
	for (const scope of reporters.keys()) {
		if (stack.includes(`${PLAYGROUND_SOURCE_URL_PREFIX}${scope}/`)) return scope;
	}
	return undefined;
};

const resolveScope = (stack: string) => {
	const scope = scopeFromStack(stack) ?? getActivePreview();
	return scope && reporters.has(scope) ? scope : undefined;
};

/**
 * @param stack 用于归属的调用栈。
 * @param message 要显示的文本。
 */
const dispatch = (stack: string, message: string) => {
	if (!message) return;
	const scope = resolveScope(stack);
	if (scope) reporters.get(scope)?.(message);
};

const install = () => {
	if (typeof window === 'undefined') return undefined;
	const handleRejection = (event: PromiseRejectionEvent) => {
		const text = formatPlaygroundRuntimeError(event.reason);
		if (text) dispatch(stackOf(event.reason), `Unhandled rejection: ${text}`);
	};
	const handleError = (event: ErrorEvent) => {
		const text = formatPlaygroundRuntimeError(event.error ?? event.message);
		const stack = `${stackOf(event.error)}\n${event.filename || ''}`;
		if (text) dispatch(stack, text);
	};
	const original = console.error;
	const wrapped = function (this: Console, ...args: unknown[]) {
		original.apply(this, args);
		const text = args.map(formatPlaygroundErrorArgument).filter(Boolean).join(' ');
		const stack = [new Error('console.error').stack || '', ...args.map(stackOf)].join('\n');
		dispatch(stack, `console.error: ${text}`);
	};
	console.error = wrapped;
	window.addEventListener('unhandledrejection', handleRejection);
	window.addEventListener('error', handleError);
	return () => {
		if (console.error === wrapped) console.error = original;
		window.removeEventListener('unhandledrejection', handleRejection);
		window.removeEventListener('error', handleError);
	};
};

/**
 * 注册一个 local 预览，接收归属到它的运行时错误。
 * @param scope 预览的作用域 id。
 * @param report 收到错误时的回调。
 * @returns 取消注册；最后一个预览取消时恢复 console.error 并移除监听。
 */
export const registerPreviewErrors = (scope: string, report: Report) => {
	reporters.set(scope, report);
	uninstall ??= install();
	return () => {
		reporters.delete(scope);
		if (reporters.size) return;
		uninstall?.();
		uninstall = undefined;
	};
};
