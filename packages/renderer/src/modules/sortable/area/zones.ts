import {
	moduleIssue,
	toArrayValue,
	toLength,
	toRecord,
	toStringValue,
	validateNumberRange
} from '../../shared/utils';
import type { RendererIssue } from '../../../types';

export const AREA_ZONE_MAX = 10;
export const AREA_ZONE_MIN = 4;

export type RendererAreaHandle = 'move' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';

export const AREA_HANDLES: readonly Exclude<RendererAreaHandle, 'move'>[] = [
	'n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'
];

export interface RendererAreaZone {
	x: number;
	y: number;
	width: number;
	height: number;
	zIndex: number;
	to: string;
	label: string;
}

const UNSAFE_HREF = /^(?:data|javascript|vbscript):/iu;

export const isUnsafeAreaHref = (value: string) => UNSAFE_HREF.test(value.trim());

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * 把热区限制在图片范围内，避免拖拽后跑出画布。
 * @param zone 当前热区。
 * @returns 裁剪后的热区。
 */
export const containAreaZone = (zone: RendererAreaZone): RendererAreaZone => {
	const width = clamp(zone.width, AREA_ZONE_MIN, 100);
	const height = clamp(zone.height, AREA_ZONE_MIN, 100);
	return {
		...zone,
		width,
		height,
		x: clamp(zone.x, 0, 100 - width),
		y: clamp(zone.y, 0, 100 - height),
		zIndex: Math.max(1, Math.round(Number.isFinite(zone.zIndex) ? zone.zIndex : 1))
	};
};

/**
 * 规范化单条热区。兼容 wya-vm 的 `w/h/z/route/name` 字段名。
 * @param value 原始热区。
 * @returns 百分比坐标系下的热区。
 */
export const normalizeAreaZone = (value: unknown): RendererAreaZone => {
	const record = toRecord(value);
	return containAreaZone({
		x: toLength(record.x, 8),
		y: toLength(record.y, 8),
		width: toLength(record.width ?? record.w, 24),
		height: toLength(record.height ?? record.h, 18),
		zIndex: toLength(record.zIndex ?? record.z, 1),
		to: toStringValue(record.to ?? record.route),
		label: toStringValue(record.label ?? record.name)
	});
};

export const normalizeAreaZones = (value: unknown) => (
	toArrayValue(value, normalizeAreaZone).slice(0, AREA_ZONE_MAX)
);

/**
 * 新建一个略错开的热区，避免连续添加完全重叠。
 * @param index 当前热区数量。
 * @returns 新热区。
 */
export const createAreaZone = (index: number): RendererAreaZone => containAreaZone({
	x: 8 + (index % 4) * 6,
	y: 8 + (index % 4) * 6,
	width: 24,
	height: 18,
	zIndex: index + 1,
	to: '',
	label: ''
});

/**
 * 按控制点把指针位移（百分比）应用到热区。
 * @param zone 拖拽开始时的热区。
 * @param handle 移动或八方向缩放。
 * @param dx 横向位移，单位为画布宽度的百分比。
 * @param dy 纵向位移，单位为画布高度的百分比。
 * @returns 裁剪后的热区。
 */
export const applyAreaZoneDelta = (
	zone: RendererAreaZone,
	handle: RendererAreaHandle,
	dx: number,
	dy: number
) => {
	let { x, y, width, height } = zone;
	switch (handle) {
		case 'move':
			x += dx;
			y += dy;
			break;
		case 'n':
			y += dy;
			height -= dy;
			break;
		case 's':
			height += dy;
			break;
		case 'e':
			width += dx;
			break;
		case 'w':
			x += dx;
			width -= dx;
			break;
		case 'ne':
			y += dy;
			height -= dy;
			width += dx;
			break;
		case 'nw':
			x += dx;
			width -= dx;
			y += dy;
			height -= dy;
			break;
		case 'se':
			width += dx;
			height += dy;
			break;
		case 'sw':
			x += dx;
			width -= dx;
			height += dy;
			break;
		default:
			break;
	}
	return containAreaZone({ ...zone, x, y, width, height });
};

export const validateAreaZones = (zones: readonly RendererAreaZone[], path = '$.areas') => {
	const issues: RendererIssue[] = [];
	if (zones.length > AREA_ZONE_MAX) {
		issues.push(moduleIssue(path, 'items.max', `热区最多 ${AREA_ZONE_MAX} 个`));
	}
	zones.forEach((zone, index) => {
		const itemPath = `${path}[${index}]`;
		issues.push(
			...validateNumberRange(zone.x, `${itemPath}.x`, { min: 0, max: 100 }),
			...validateNumberRange(zone.y, `${itemPath}.y`, { min: 0, max: 100 }),
			...validateNumberRange(zone.width, `${itemPath}.width`, { min: AREA_ZONE_MIN, max: 100 }),
			...validateNumberRange(zone.height, `${itemPath}.height`, { min: AREA_ZONE_MIN, max: 100 }),
			...validateNumberRange(zone.zIndex, `${itemPath}.zIndex`, { min: 1, max: 1000, integer: true })
		);
		if (zone.to.trim() && isUnsafeAreaHref(zone.to)) {
			issues.push(moduleIssue(`${itemPath}.to`, 'area.target.unsafe', '热区链接协议不安全'));
		}
	});
	return issues;
};
