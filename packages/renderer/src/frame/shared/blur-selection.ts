interface RendererSelectionHost {
	select: (id: string | null) => void;
}

const KEEP_SELECTION_SELECTOR = [
	'[data-renderer-node-id]',
	'.docs-renderer-frame__item',
	'.docs-renderer-selection',
	'.docs-renderer-guide.is-user',
	'.docs-renderer-ruler',
	'.docs-renderer-zoom-bar',
	'.docs-renderer-thumbnail',
	'.docs-renderer-editor',
	'.docs-renderer-page',
	'.docs-renderer-right-menu'
].join(',');

/**
 * 点击落在模块、选中框、标尺或属性面板上时保持当前选中。
 * @param target 事件目标。
 * @returns 是否应继续编辑当前模块。
 */
export const shouldKeepRendererSelection = (target: EventTarget | null) => (
	target instanceof Element && Boolean(target.closest(KEEP_SELECTION_SELECTOR))
);

/**
 * 先让属性面板输入框失焦，再切回页面属性，避免未提交的输入被卸载丢掉。
 * @param store 当前 Combo / Frame 的选中会话。
 * @param event 画布空白处的指针事件。
 * @returns 是否已经取消模块选中。
 */
export const deactivateRendererSelection = (
	store: RendererSelectionHost,
	event: PointerEvent
) => {
	if (typeof event.button === 'number' && event.button !== 0) return false;
	if (shouldKeepRendererSelection(event.target)) return false;
	const active = document.activeElement;
	if (active instanceof HTMLElement && active.closest('.docs-renderer-editor')) {
		active.blur();
	}
	store.select(null);
	return true;
};
