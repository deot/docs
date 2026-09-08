export interface IndicatorBox {
	height: number;
	left: number;
	right: number;
	width: number;
}

/** 指示器与斜纹轨内侧的间距，避免完全贴死。 */
export const INDICATOR_RAIL_GAP = 8;

/**
 * 指示器高度不能超过正文实际高度，也不能超出当前滚动容器可视区域。
 * 与文档壳大纲的封顶规则一致。
 * @param articleHeight 正文高度。
 * @param viewportHeight 主滚动容器可视高度。
 * @returns 指示器最大高度，单位 px。
 */
export const capIndicatorMaxHeight = (articleHeight: number, viewportHeight: number) => {
	const article = Math.max(0, articleHeight);
	const viewport = Math.max(0, viewportHeight);
	if (!article) return viewport;
	if (!viewport) return article;
	return Math.min(article, viewport);
};

/**
 * 滑轨高度再受 sticky 父级剩余空间约束，避免滚到文末盖住 footer。
 * @param cap 正文/视口封顶后的高度。
 * @param available 指示器顶部到父级底部的剩余像素；非有限值表示不额外约束。
 * @returns 最终高度，单位 px。
 */
export const capStickyAvailableHeight = (cap: number, available: number) => {
	const limited = Math.max(0, cap);
	if (!Number.isFinite(available)) return limited;
	return Math.min(limited, Math.max(0, available));
};

/**
 * 把主滚动位置映射成小地图可视窗口（相对轨道的 0–1 比例）。
 * @param scrollTop 当前滚动偏移。
 * @param clientHeight 滚动容器可视高度。
 * @param scrollHeight 滚动内容总高度。
 * @returns 窗口顶部与高度比例。
 */
export const getMinimapWindow = (
	scrollTop: number,
	clientHeight: number,
	scrollHeight: number
) => {
	const total = Math.max(0, scrollHeight);
	if (!total) return { height: 1, top: 0 };
	const height = Math.min(1, Math.max(0, clientHeight / total));
	const maxTop = Math.max(0, 1 - height);
	const top = maxTop <= 0 ? 0 : Math.min(maxTop, Math.max(0, scrollTop / total));
	return { height, top };
};

/**
 * 按小地图窗口顶部选出当前阅读刻度：最后一个仍不晚于窗口顶的块。
 * 滚到末屏时固定最后一条，避免末块永远到不了窗口顶。
 * @param ratios 刻度在正文中的 0–1 比例，按出现顺序。
 * @param windowTop 可视窗口顶部比例。
 * @param windowHeight 可视窗口高度比例。
 * @returns 当前刻度序号；没有刻度时为 -1。
 */
export const findActiveMinimapIndex = (
	ratios: number[],
	windowTop: number,
	windowHeight: number
) => {
	if (!ratios.length) return -1;
	if (windowTop + windowHeight >= 1 - 0.001) return ratios.length - 1;
	let active = 0;
	for (let index = 0; index < ratios.length; index++) {
		if ((ratios[index] || 0) <= windowTop) active = index;
	}
	return active;
};

/**
 * 判断刻度是否落在当前可视窗口内。
 * @param ratio 刻度比例。
 * @param windowTop 可视窗口顶部比例。
 * @param windowHeight 可视窗口高度比例。
 * @returns 是否位于窗口内。
 */
export const isMinimapMarkerInView = (
	ratio: number,
	windowTop: number,
	windowHeight: number
) => {
	const top = Math.max(0, windowTop);
	const bottom = top + Math.max(0, windowHeight);
	return ratio >= top && ratio <= bottom;
};

/**
 * 把指针纵坐标映射成轨道上的 0–1 比例。
 * @param clientY 指针视口纵坐标。
 * @param trackTop 轨道顶部。
 * @param trackHeight 轨道高度。
 * @returns 夹紧后的比例。
 */
export const getMinimapPointerRatio = (
	clientY: number,
	trackTop: number,
	trackHeight: number
) => {
	if (trackHeight <= 0) return 0;
	return Math.min(1, Math.max(0, (clientY - trackTop) / trackHeight));
};

/**
 * 把指示器刻度对齐到文档壳斜纹轨的内侧，并留出 `INDICATOR_RAIL_GAP`。
 * 左侧靠近 `rail--start` 的右缘，右侧靠近 `rail--end` 的左缘。
 * 没有可见轨道时返回 undefined，由样式回退到正文边缘。
 * @param root 指示器根节点相对视口的盒子。
 * @param rail 当前侧斜纹轨的盒子。
 * @param side 指示器所在侧。
 * @param viewportWidth 刻度轨道宽度。
 * @returns 相对指示器根节点的 left 偏移，单位 px。
 */
export const getIndicatorInlineOffset = (
	root: IndicatorBox,
	rail: IndicatorBox | undefined,
	side: 'left' | 'right',
	viewportWidth: number
) => {
	if (!rail || rail.width <= 0 || rail.height <= 0) return;
	if (side === 'left') return rail.right - root.left + INDICATOR_RAIL_GAP;
	return rail.left - root.left - viewportWidth - INDICATOR_RAIL_GAP;
};
