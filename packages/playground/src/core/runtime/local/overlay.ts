import type { PlaygroundOverlayOptions } from '../../../types';
import { PREVIEW_STYLE_SCOPE_ATTR } from './compile/style-scope';
import { getActivePreview } from './activity';

/** 被预览认领的 body 子节点上的标记。 */
export const PREVIEW_ADOPTED_ATTR = 'data-docs-playground-adopted';

export interface PreviewOverlayController {
	/** 调用站点适配器。返回的清理函数会在 `teardown` 时执行。 */
	setup: (modules: Readonly<Record<string, unknown>>) => void;
	/** 根变量变化时同步到认领的节点。 */
	updateVars: (vars: Record<string, string> | undefined) => void;
	/** 清理适配器、清空挂载节点，移除仍然挂在 body 上的认领节点。 */
	teardown: () => void;
	/** 停止观察 body。 */
	dispose: () => void;
}

const applyVars = (element: HTMLElement, vars: Record<string, string> | undefined, previous: Set<string>) => {
	for (const name of previous) {
		if (!vars || !(name in vars)) element.style.removeProperty(name);
	}
	for (const [name, value] of Object.entries(vars || {})) element.style.setProperty(name, value);
};

/**
 * 管理 local 移动端预览的弹层：站点适配器，以及未接入适配器的第三方弹层降级。
 * 降级只认领本预览「活跃」期间追加到 body 的节点：写入根变量与样式作用域，销毁时移除。
 * 不搬移节点，Vue Teleport 和定位库在 body 里持有锚点，搬走会出错。
 * @param options 预览信息。
 * @param options.scope 预览的样式作用域 id。
 * @param options.element 预览区内的挂载节点。
 * @param options.adapter 站点适配器。
 * @param options.onError 适配器出错时的回调。
 * @returns 控制器。
 */
export const createPreviewOverlay = (options: {
	scope: string;
	element: HTMLElement;
	adapter?: PlaygroundOverlayOptions;
	onError?: (error: unknown) => void;
}): PreviewOverlayController => {
	const { scope, element, adapter } = options;
	const adopted = new Set<HTMLElement>();
	let vars: Record<string, string> | undefined;
	let names = new Set<string>();
	let cleanup: (() => void) | undefined;

	const adopt = (node: HTMLElement) => {
		if (adopted.has(node) || node.hasAttribute(PREVIEW_ADOPTED_ATTR)) return;
		adopted.add(node);
		node.setAttribute(PREVIEW_ADOPTED_ATTR, scope);
		if (!node.hasAttribute(PREVIEW_STYLE_SCOPE_ATTR)) node.setAttribute(PREVIEW_STYLE_SCOPE_ATTR, scope);
		applyVars(node, vars, new Set());
	};

	const observer = typeof MutationObserver === 'undefined' || typeof document === 'undefined'
		? undefined
		: new MutationObserver((records) => {
				if (getActivePreview() !== scope) return;
				for (const record of records) {
					for (const node of record.addedNodes) {
						if (!(node instanceof HTMLElement) || node.tagName === 'SCRIPT' || node.tagName === 'STYLE') continue;
						// 文档站自己的弹层（搜索、示例弹窗等）不属于预览。
						if ([...node.classList].some(name => name.startsWith('docs-'))) continue;
						adopt(node);
					}
				}
			});
	observer?.observe(document.body, { childList: true });

	return {
		setup(modules) {
			if (typeof adapter?.setup !== 'function') return;
			try {
				const result = adapter.setup({ element, modules });
				cleanup = typeof result === 'function' ? result : undefined;
			} catch (error) {
				options.onError?.(error);
			}
		},
		updateVars(next) {
			for (const node of adopted) applyVars(node, next, names);
			vars = next;
			names = new Set(Object.keys(next || {}));
		},
		teardown() {
			const current = cleanup;
			cleanup = undefined;
			try {
				current?.();
			} catch (error) {
				options.onError?.(error);
			}
			element.replaceChildren();
			for (const node of adopted) node.remove();
			adopted.clear();
		},
		dispose() {
			observer?.disconnect();
		}
	};
};
