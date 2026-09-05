import type { PlaygroundViewport } from '../../../types';
import { getViewportHeight, getViewportWidth } from '../viewport';

/** 弹窗相对屏幕边缘的上下留白；左右为该值的 2 倍。 */
export const PLAYGROUND_POPUP_SCREEN_GAP = 40;

/** 弹窗工具栏高度，画布铺满时从壳层高度中扣除。 */
export const PLAYGROUND_POPUP_HEADER_HEIGHT = 44;

const resolvePopupScreenInset = (gap = PLAYGROUND_POPUP_SCREEN_GAP) => {
	const safeGap = Number.isFinite(gap) ? Math.max(0, gap) : PLAYGROUND_POPUP_SCREEN_GAP;
	return {
		x: safeGap * 2,
		y: safeGap
	};
};

export const getWindowInnerSize = () => {
	if (typeof window === 'undefined') {
		return { width: 0, height: 0 };
	}
	return {
		width: window.innerWidth,
		height: window.innerHeight
	};
};

export const resolvePopupRequestedSize = (
	viewport: PlaygroundViewport,
	screen = getWindowInnerSize(),
	gap = PLAYGROUND_POPUP_SCREEN_GAP
) => {
	const inset = resolvePopupScreenInset(gap);
	const maxWidth = Math.max(0, Math.round(
		(Number.isFinite(screen.width) ? screen.width : 0) - inset.x
	));
	const maxHeight = Math.max(0, Math.round(
		(Number.isFinite(screen.height) ? screen.height : 0) - inset.y
	));
	const viewportWidth = getViewportWidth(viewport);
	const viewportHeight = getViewportHeight(viewport);
	return {
		width: viewportWidth ?? maxWidth,
		height: viewportHeight ?? maxHeight,
		maxWidth,
		maxHeight
	};
};

/**
 * 壳层封顶到 `screen.width - gap * 2`、`screen.height - gap`。
 * 未设 viewport 边时，画布铺满工具栏以下区域；请求尺寸大于可用区域时由 Scroller 处理溢出。
 * @param viewport 当前 playground 视口配置。
 * @param screen 屏幕可用宽高，默认取 `window.inner*`。
 * @param gap 相对屏幕上下边缘的留白；左右为该值的 2 倍。
 * @returns 壳层、内容区与画布尺寸，以及是否需要滚动。
 */
export const resolvePopupLayout = (
	viewport: PlaygroundViewport,
	screen = getWindowInnerSize(),
	gap = PLAYGROUND_POPUP_SCREEN_GAP
) => {
	const requested = resolvePopupRequestedSize(viewport, screen, gap);
	const shellWidth = Math.min(requested.width, requested.maxWidth);
	const shellHeight = Math.min(requested.height, requested.maxHeight);
	const bodyHeight = Math.max(0, shellHeight - PLAYGROUND_POPUP_HEADER_HEIGHT);
	const canvasWidth = getViewportWidth(viewport) ?? shellWidth;
	const canvasHeight = getViewportHeight(viewport) ?? bodyHeight;
	return {
		shellWidth,
		shellHeight,
		bodyHeight,
		canvasWidth,
		canvasHeight,
		needsScrollX: canvasWidth > shellWidth,
		needsScrollY: canvasHeight > bodyHeight
	};
};
