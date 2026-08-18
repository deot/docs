import { clamp } from '../../utils/number';
import type { Point } from '../draggable/geometry';

interface ZoomAnchorSnapshot {
	/**
	 * 选中节点存在时保存节点自身，否则保存画布上的逻辑位置。
	 */
	target: HTMLElement;
	ratio?: Point;
	screen: Point;
}

const centerOf = (rect: DOMRect) => ({
	x: rect.left + rect.width / 2,
	y: rect.top + rect.height / 2
});

/**
 * 记录缩放前的视觉锚点。选中节点优先保持自身中心；没有选中节点时，
 * 保存视口中心对应的画布逻辑位置，避免缩放时画布向左上角跳动。
 * @param wrapper Scroller 的真实滚动层。
 * @param canvas 当前 Frame 的画布元素。
 * @param selected 当前主选中节点，没有选中节点时为 null。
 * @returns 可用于缩放后恢复位置的锚点快照。
 */
export const captureZoomAnchor = (
	wrapper: HTMLElement | null,
	canvas: HTMLElement | null,
	selected: HTMLElement | null
): ZoomAnchorSnapshot | null => {
	if (!wrapper || !canvas) return null;
	if (selected) {
		return {
			target: selected,
			screen: centerOf(selected.getBoundingClientRect())
		};
	}

	const wrapperRect = wrapper.getBoundingClientRect();
	const canvasRect = canvas.getBoundingClientRect();
	if (!canvasRect.width || !canvasRect.height) return null;
	const viewportCenter = centerOf(wrapperRect);
	const screen = {
		x: clamp(viewportCenter.x, canvasRect.left, canvasRect.right),
		y: clamp(viewportCenter.y, canvasRect.top, canvasRect.bottom)
	};
	return {
		target: canvas,
		ratio: {
			x: (screen.x - canvasRect.left) / canvasRect.width,
			y: (screen.y - canvasRect.top) / canvasRect.height
		},
		screen
	};
};

/**
 * 根据缩放后的真实 DOM 位置补偿 Scroller。这里只修正滚动量，不修改
 * Store 中的 scale，因而 Select、Slider 与自动适配可以共用同一行为。
 * @param wrapper Scroller 的真实滚动层。
 * @param snapshot 缩放前记录的锚点快照。
 */
export const restoreZoomAnchor = (
	wrapper: HTMLElement | null,
	snapshot: ZoomAnchorSnapshot | null
) => {
	if (!wrapper || !snapshot || !snapshot.target.isConnected) return;
	const rect = snapshot.target.getBoundingClientRect();
	const current = snapshot.ratio
		? {
				x: rect.left + rect.width * snapshot.ratio.x,
				y: rect.top + rect.height * snapshot.ratio.y
			}
		: centerOf(rect);
	wrapper.scrollLeft += current.x - snapshot.screen.x;
	wrapper.scrollTop += current.y - snapshot.screen.y;
};
