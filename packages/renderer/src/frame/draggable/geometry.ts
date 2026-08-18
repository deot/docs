import type { RendererPlacement, RendererResizeHandle } from '../../types';

export interface Point {
	x: number;
	y: number;
}

export interface ResizeOptions {
	minWidth?: number;
	minHeight?: number;
	maxWidth?: number;
	maxHeight?: number;
	/**
	 * 固定宽高比 `width / height`。省略则自由拉伸。
	 */
	aspectRatio?: number;
	/**
	 * 缩放吸附网格，`[x 间距, y 间距]`，画布像素。
	 */
	grid?: [number, number];
}

const HANDLE_VECTOR: Record<RendererResizeHandle, Point> = {
	n: { x: 0, y: -1 },
	ne: { x: 1, y: -1 },
	e: { x: 1, y: 0 },
	se: { x: 1, y: 1 },
	s: { x: 0, y: 1 },
	sw: { x: -1, y: 1 },
	w: { x: -1, y: 0 },
	nw: { x: -1, y: -1 }
};

const rotatePoint = (point: Point, angle: number) => {
	const radians = angle * Math.PI / 180;
	const cos = Math.cos(radians);
	const sin = Math.sin(radians);
	return {
		x: point.x * cos - point.y * sin,
		y: point.x * sin + point.y * cos
	};
};

const snap = (value: number, step = 0) => step > 0
	? Math.round(value / step) * step
	: value;

/**
 * 在元素局部坐标系计算任意角度的八方向缩放，并保持对侧锚点固定。
 * @param original 交互开始时的节点几何信息。
 * @param handle 当前拖动的八方向手柄。
 * @param pointer 画布坐标系中的实时指针位置。
 * @param options 尺寸、比例和网格限制。
 * @returns 旋转坐标系换算后的新几何信息。
 */
export const resizeRotatedPlacement = (
	original: RendererPlacement,
	handle: RendererResizeHandle,
	pointer: Point,
	options: ResizeOptions = {}
): RendererPlacement => {
	const vector = HANDLE_VECTOR[handle];
	const angle = Number(original.rotate) || 0;
	const center = {
		x: original.x + original.width / 2,
		y: original.y + original.height / 2
	};
	const fixedOffset = rotatePoint({
		x: -vector.x * original.width / 2,
		y: -vector.y * original.height / 2
	}, angle);
	const fixed = { x: center.x + fixedOffset.x, y: center.y + fixedOffset.y };
	const localDelta = rotatePoint({ x: pointer.x - fixed.x, y: pointer.y - fixed.y }, -angle);
	let width = vector.x
		? Math.max(options.minWidth || 1, snap(localDelta.x * vector.x, options.grid?.[0]))
		: original.width;
	let height = vector.y
		? Math.max(options.minHeight || 1, snap(localDelta.y * vector.y, options.grid?.[1]))
		: original.height;
	if (options.maxWidth) width = Math.min(options.maxWidth, width);
	if (options.maxHeight) height = Math.min(options.maxHeight, height);
	if (options.aspectRatio) {
		const ratio = options.aspectRatio;
		if (!vector.x) width = height * ratio;
		else if (!vector.y) height = width / ratio;
		else if (width / height > ratio) height = width / ratio;
		else width = height * ratio;
		const minimumScale = Math.max(
			options.minWidth ? options.minWidth / width : 0,
			options.minHeight ? options.minHeight / height : 0
		);
		const maximumScale = Math.min(
			options.maxWidth ? options.maxWidth / width : Number.POSITIVE_INFINITY,
			options.maxHeight ? options.maxHeight / height : Number.POSITIVE_INFINITY
		);
		const scale = minimumScale > 1
			? minimumScale
			: maximumScale < 1 ? maximumScale : 1;
		width *= scale;
		height *= scale;
	}
	const centerOffset = rotatePoint({
		x: vector.x * width / 2,
		y: vector.y * height / 2
	}, angle);
	const nextCenter = { x: fixed.x + centerOffset.x, y: fixed.y + centerOffset.y };
	return {
		...original,
		x: nextCenter.x - width / 2,
		y: nextCenter.y - height / 2,
		width,
		height
	};
};

export const transformPoint = (point: Point, matrix: DOMMatrixReadOnly): Point => {
	const result = new DOMPoint(point.x, point.y).matrixTransform(matrix.inverse());
	return { x: result.x, y: result.y };
};

export const rotatedBounds = (placement: RendererPlacement) => {
	const center = {
		x: placement.x + placement.width / 2,
		y: placement.y + placement.height / 2
	};
	const corners = [
		{ x: -placement.width / 2, y: -placement.height / 2 },
		{ x: placement.width / 2, y: -placement.height / 2 },
		{ x: placement.width / 2, y: placement.height / 2 },
		{ x: -placement.width / 2, y: placement.height / 2 }
	].map(point => rotatePoint(point, placement.rotate));
	const xs = corners.map(point => point.x + center.x);
	const ys = corners.map(point => point.y + center.y);
	return {
		left: Math.min(...xs),
		top: Math.min(...ys),
		right: Math.max(...xs),
		bottom: Math.max(...ys)
	};
};

/**
 * 用同一个位移约束一组选中节点，避免逐个回收边界后破坏节点间的相对位置。
 * @param placements 需要遵守画布边界的原始节点。
 * @param delta 指针计算出的候选位移。
 * @param width 画布宽度。
 * @param height 画布高度。
 * @returns 在所有节点允许区间交集内的统一位移。
 */
export const containGroupTranslation = (
	placements: readonly RendererPlacement[],
	delta: Point,
	width: number,
	height: number
): Point => {
	if (!placements.length) return delta;
	let minimumX = Number.NEGATIVE_INFINITY;
	let maximumX = Number.POSITIVE_INFINITY;
	let minimumY = Number.NEGATIVE_INFINITY;
	let maximumY = Number.POSITIVE_INFINITY;
	placements.forEach((placement) => {
		const bounds = rotatedBounds(placement);
		minimumX = Math.max(minimumX, -bounds.left);
		maximumX = Math.min(maximumX, width - bounds.right);
		minimumY = Math.max(minimumY, -bounds.top);
		maximumY = Math.min(maximumY, height - bounds.bottom);
	});
	return {
		x: minimumX <= maximumX
			? Math.min(maximumX, Math.max(minimumX, delta.x))
			: 0,
		y: minimumY <= maximumY
			? Math.min(maximumY, Math.max(minimumY, delta.y))
			: 0
	};
};

/**
 * 按旋转后的真实外包围盒将节点收回画布。节点本身大于画布时以画布中心
 * 对齐，避免左右或上下边界来回覆盖产生不稳定位置。
 * @param placement 待约束的节点几何信息。
 * @param width 画布宽度。
 * @param height 画布高度。
 * @returns 保留尺寸与旋转、仅修正坐标的几何信息。
 */
export const containRotatedPlacement = (
	placement: RendererPlacement,
	width: number,
	height: number
): RendererPlacement => {
	const bounds = rotatedBounds(placement);
	const boundsWidth = bounds.right - bounds.left;
	const boundsHeight = bounds.bottom - bounds.top;
	const dx = boundsWidth > width
		? width / 2 - (bounds.left + bounds.right) / 2
		: bounds.left < 0
			? -bounds.left
			: bounds.right > width ? width - bounds.right : 0;
	const dy = boundsHeight > height
		? height / 2 - (bounds.top + bounds.bottom) / 2
		: bounds.top < 0
			? -bounds.top
			: bounds.bottom > height ? height - bounds.bottom : 0;
	return { ...placement, x: placement.x + dx, y: placement.y + dy };
};

export interface AlignmentSnapResult {
	dx: number;
	dy: number;
	/**
	 * 本次吸附命中的垂直参考线，画布 X。会话辅助线见 `RendererViewportState.guideX`。
	 */
	guideX: number[];
	/**
	 * 本次吸附命中的水平参考线，画布 Y。
	 */
	guideY: number[];
}

/**
 * 将节点左/中/右与上/中/下边对齐到目标参考线（其他节点、用户辅助线、画布边与中线）。
 * @param placement
 * @param targetsX
 * @param targetsY
 * @param threshold
 */
export const snapPlacementToGuides = (
	placement: RendererPlacement,
	targetsX: readonly number[],
	targetsY: readonly number[],
	threshold: number
): AlignmentSnapResult => {
	const xValues = [placement.x, placement.x + placement.width / 2, placement.x + placement.width];
	const yValues = [placement.y, placement.y + placement.height / 2, placement.y + placement.height];
	let dx = 0;
	let dy = 0;
	const guideX: number[] = [];
	const guideY: number[] = [];
	for (const current of xValues) for (const target of targetsX) {
		if (Math.abs(current + dx - target) <= threshold) {
			dx = target - current;
			guideX.splice(0, guideX.length, target);
		}
	}
	for (const current of yValues) for (const target of targetsY) {
		if (Math.abs(current + dy - target) <= threshold) {
			dy = target - current;
			guideY.splice(0, guideY.length, target);
		}
	}
	return { dx, dy, guideX, guideY };
};
