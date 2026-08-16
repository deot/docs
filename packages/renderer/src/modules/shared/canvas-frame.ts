import type { RendererDraggableCapability, RendererSortableCapability } from '../../types';
import { RENDERER_SORTABLE_CONTENT_WIDTH } from '../../types';

/**
 * 落地模块的排序流能力。未铺满时新建节点默认内容宽 1200；Hero / CTA 传入 `fullWidth`，默认不写最大宽。
 * 渲染时 `0` / 未填写仍表示不限制，不会回退到这个默认值。
 * @param options 通栏和内容最大宽。
 * @param options.fullWidth 新建节点是否通栏。
 * @param options.maxWidth 新建节点默认内容最大宽；通栏时省略表示不写。
 * @returns sortable Frame 能力声明。
 */
export const sectionSortableFrame = (
	options: { fullWidth?: boolean; maxWidth?: number } = {}
): RendererSortableCapability => {
	const fullWidth = Boolean(options.fullWidth);
	const maxWidth = options.maxWidth ?? (fullWidth ? undefined : RENDERER_SORTABLE_CONTENT_WIDTH);
	return {
		insertion: 'any',
		movable: true,
		deletable: true,
		fullWidth,
		...(typeof maxWidth === 'number' ? { maxWidth } : {}),
		create: () => ({
			appearance: {
				fullWidth,
				...(typeof maxWidth === 'number' ? { maxWidth } : {})
			}
		})
	};
};

/**
 * 双 Frame 模块的默认自由布局能力。Sortable 专属的 `space` 不使用该配置，
 * 以便切换画布时仍有可丢弃的不兼容节点作为对照。
 * @param width 默认宽度。
 * @param height 默认高度。
 * @param limits 覆盖默认最小宽高；落地大块沿用 240×80，标题/正文等小块传入更小值。
 * @param limits.minWidth 覆盖默认最小宽。
 * @param limits.minHeight 覆盖默认最小高。
 * @returns draggable Frame 能力声明。
 */
export const sectionDraggableFrame = (
	width: number,
	height: number,
	limits: { minWidth?: number; minHeight?: number } = {}
): RendererDraggableCapability => ({
	initialPlacement: () => ({
		x: 40,
		y: 40,
		width,
		height,
		rotate: 0,
		zIndex: 1
	}),
	minWidth: limits.minWidth ?? Math.min(240, width),
	minHeight: limits.minHeight ?? Math.min(80, height),
	movable: true,
	resizable: true,
	rotatable: true,
	deletable: true,
	containment: 'canvas'
});
