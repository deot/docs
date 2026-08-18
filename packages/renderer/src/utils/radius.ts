import type { RendererCornerRadii } from '../types';

export const RENDERER_CORNER_RADIUS_KEYS = [
	'borderRadiusTopLeft',
	'borderRadiusTopRight',
	'borderRadiusBottomLeft',
	'borderRadiusBottomRight'
] as const;

export type RendererCornerRadiusKey = typeof RENDERER_CORNER_RADIUS_KEYS[number];

const clampRadius = (value: unknown, fallback = 0) => {
	const number = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
	return Math.max(0, number);
};

/**
 * 从 appearance / placement 中挑出已写入的圆角字段，切换 Frame 时用来保留圆角。
 * @param value 当前节点上的圆角来源，允许混入其他字段。
 * @returns 只包含有效数值的圆角补丁。
 */
export const pickRendererCornerRadii = (
	value?: unknown
): RendererCornerRadii => {
	const next: RendererCornerRadii = {};
	if (!value || typeof value !== 'object') return next;
	const record = value as Record<string, unknown>;
	if (typeof record.borderRadius === 'number' && Number.isFinite(record.borderRadius)) {
		next.borderRadius = record.borderRadius;
	}
	RENDERER_CORNER_RADIUS_KEYS.forEach((key) => {
		const radius = record[key];
		if (typeof radius === 'number' && Number.isFinite(radius)) next[key] = radius;
	});
	return next;
};

/**
 * 是否已经拆成独立四角。
 * @param value 当前圆角数据。
 * @returns 四个独立圆角中是否有已写入的数值。
 */
export const hasIndependentRendererCorners = (value?: RendererCornerRadii | null) => (
	Boolean(value && RENDERER_CORNER_RADIUS_KEYS.some(key => typeof value[key] === 'number'))
);

/**
 * 把统一圆角和独立四角收敛成 CSS 可用的四个数值。
 * @param value 当前圆角数据。
 * @returns 顺时针四角的像素值。
 */
export const resolveRendererCornerRadii = (value?: RendererCornerRadii | null) => {
	const uniform = clampRadius(value?.borderRadius);
	return {
		topLeft: clampRadius(value?.borderRadiusTopLeft, uniform),
		topRight: clampRadius(value?.borderRadiusTopRight, uniform),
		bottomRight: clampRadius(value?.borderRadiusBottomRight, uniform),
		bottomLeft: clampRadius(value?.borderRadiusBottomLeft, uniform)
	};
};

/**
 * 生成节点盒模型上的 border-radius / overflow。全 0 时不写样式，避免干扰旧文档。
 * @param value 当前圆角数据。
 * @returns 可直接铺到节点 style 上的圆角与裁剪。
 */
export const rendererBorderRadiusStyle = (value?: RendererCornerRadii | null) => {
	const { topLeft, topRight, bottomRight, bottomLeft } = resolveRendererCornerRadii(value);
	const hasRadius = topLeft > 0 || topRight > 0 || bottomRight > 0 || bottomLeft > 0;
	if (!hasRadius) return {};
	const borderRadius = topLeft === topRight && topRight === bottomRight && bottomRight === bottomLeft
		? `${topLeft}px`
		: `${topLeft}px ${topRight}px ${bottomRight}px ${bottomLeft}px`;
	return {
		borderRadius,
		overflow: 'hidden' as const
	};
};
