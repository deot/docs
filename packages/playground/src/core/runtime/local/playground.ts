import type { Ref } from 'vue';

type PreviewVue = Pick<typeof import('vue'), 'isRef'>;

/**
 * 直接渲染与页面同文档，弹层不需要临时撑高。
 * `run` 仍返回可调用函数，但不会申请高度，也不会改动预览尺寸。
 * @param vue 当前预览的 Vue，只用其中的 `isRef`。
 * @param context 预览信息。
 * @param context.overlay 预览区内的弹层挂载节点。只有移动端分栏提供，其余为 null。
 * @returns 注入给预览的 `docs:playground`。
 */
export const createLocalPlayground = (vue: PreviewVue, context: { overlay?: HTMLElement | null } = {}) => {
	const run = (
		_height?: number,
		optionsOrHandler?: unknown,
		lastHandler?: unknown
	) => {
		const options = typeof optionsOrHandler === 'function' || optionsOrHandler == null
			? {}
			: optionsOrHandler as { visible?: Ref<boolean> | (() => boolean) };
		const visible = options.visible;
		const handler = typeof optionsOrHandler === 'function'
			? optionsOrHandler as (...args: unknown[]) => unknown
			: typeof lastHandler === 'function'
				? lastHandler as (...args: unknown[]) => unknown
				: vue.isRef(visible)
					? () => { visible.value = true; }
					: undefined;
		return (...args: unknown[]) => {
			if (typeof handler !== 'function') return undefined;
			return handler(...args);
		};
	};

	return {
		overlay: context.overlay ?? null,
		enable: () => Promise.resolve(true),
		disable() {},
		dispose() {},
		run
	};
};
