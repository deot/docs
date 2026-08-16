import {
	RENDERER_MAX_NODES,
	RENDERER_MAX_VALUE_DEPTH,
	RENDERER_SCHEMA_VERSION
} from './types';
import type {
	RendererDraggableDocument,
	RendererIssue,
	RendererPlacement,
	RendererSortableAppearance,
	RendererSortableDocument,
	RendererValidationResult
} from './types';

export const isRendererRecord = (value: unknown): value is Record<string, unknown> => (
	Boolean(value)
	&& typeof value === 'object'
	&& !Array.isArray(value)
	&& (
		Object.getPrototypeOf(value) === Object.prototype
		|| Object.getPrototypeOf(value) === null
	)
);

const isFiniteNumber = (value: unknown): value is number => (
	typeof value === 'number' && Number.isFinite(value)
);

/**
 * 校验值是否能安全序列化为 JSON，同时限制属性树深度。该检查不会把用户键
 * 赋值到普通对象，因此 `__proto__` 等键只会被当作数据读取。
 * @param value 待校验的未知属性值。
 * @param depth 当前递归深度。
 * @param seen 当前递归链中已经访问的对象。
 * @returns 是否为无函数、无循环引用且数字有限的 JSON 安全值。
 */
export const isRendererJsonSafe = (
	value: unknown,
	depth = 0,
	seen = new Set<unknown>()
): boolean => {
	if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
	if (isFiniteNumber(value)) return true;
	if (typeof value !== 'object' || seen.has(value) || depth > RENDERER_MAX_VALUE_DEPTH) return false;
	seen.add(value);
	const valid = Array.isArray(value)
		? value.every(item => isRendererJsonSafe(item, depth + 1, seen))
		: Object.keys(value).every(key => isRendererJsonSafe(
				(value as Record<string, unknown>)[key],
				depth + 1,
				seen
			));
	seen.delete(value);
	return valid;
};

export const cloneRendererValue = <T>(value: T): T => JSON.parse(JSON.stringify(value));

export const normalizeRotation = (value = 0) => {
	if (!Number.isFinite(value)) return 0;
	const result = ((value + 180) % 360 + 360) % 360 - 180;
	return Object.is(result, -0) ? 0 : result;
};

const pushNumberIssue = (
	value: unknown,
	path: string,
	issues: RendererIssue[],
	options: { positive?: boolean; nonNegative?: boolean } = {}
) => {
	if (!isFiniteNumber(value)) {
		issues.push({ path, code: 'number.finite', message: '必须是有限数值', severity: 'error' });
		return;
	}
	if (options.positive && value <= 0) {
		issues.push({ path, code: 'number.positive', message: '必须大于 0', severity: 'error' });
	}
	if (options.nonNegative && value < 0) {
		issues.push({ path, code: 'number.nonNegative', message: '不能小于 0', severity: 'error' });
	}
};

const validateSortableLayout = (
	value: Record<string, unknown>,
	issues: RendererIssue[]
): void => {
	pushNumberIssue(value.maxWidth, '$.layout.maxWidth', issues, { positive: true });
	if (typeof value.minHeight !== 'undefined') {
		pushNumberIssue(value.minHeight, '$.layout.minHeight', issues, { nonNegative: true });
	}
	if (typeof value.background !== 'string') {
		issues.push({ path: '$.layout.background', code: 'layout.background', message: 'background 必须是字符串', severity: 'error' });
	}
};

const validateDraggableLayout = (
	value: Record<string, unknown>,
	issues: RendererIssue[]
): void => {
	pushNumberIssue(value.width, '$.layout.width', issues, { positive: true });
	pushNumberIssue(value.height, '$.layout.height', issues, { positive: true });
	if (typeof value.background !== 'string') {
		issues.push({ path: '$.layout.background', code: 'layout.background', message: 'background 必须是字符串', severity: 'error' });
	}
};

const validateCornerRadii = (
	value: Record<string, unknown>,
	path: string,
	issues: RendererIssue[]
) => {
	([
		'borderRadius',
		'borderRadiusTopLeft',
		'borderRadiusTopRight',
		'borderRadiusBottomRight',
		'borderRadiusBottomLeft'
	] as const).forEach((key) => {
		if (typeof value[key] !== 'undefined') {
			pushNumberIssue(value[key], `${path}.${key}`, issues, { nonNegative: true });
		}
	});
};

const validateAppearance = (
	value: unknown,
	path: string,
	issues: RendererIssue[]
): value is RendererSortableAppearance => {
	if (!isRendererRecord(value)) {
		issues.push({ path, code: 'appearance.type', message: 'appearance 必须是对象', severity: 'error' });
		return false;
	}
	(['marginTop', 'marginBottom', 'paddingTop', 'paddingBottom'] as const).forEach((key) => {
		pushNumberIssue(value[key], `${path}.${key}`, issues, { nonNegative: true });
	});
	(['paddingLeft', 'paddingRight'] as const).forEach((key) => {
		if (typeof value[key] !== 'undefined') {
			pushNumberIssue(value[key], `${path}.${key}`, issues, { nonNegative: true });
		}
	});
	validateCornerRadii(value, path, issues);
	if (typeof value.fullWidth !== 'undefined' && typeof value.fullWidth !== 'boolean') {
		issues.push({
			path: `${path}.fullWidth`,
			code: 'appearance.fullWidth',
			message: 'fullWidth 必须是布尔值',
			severity: 'error'
		});
	}
	if (typeof value.maxWidth !== 'undefined') {
		pushNumberIssue(value.maxWidth, `${path}.maxWidth`, issues, { nonNegative: true });
	}
	return true;
};

const validatePlacement = (
	value: unknown,
	path: string,
	issues: RendererIssue[]
): value is RendererPlacement => {
	if (!isRendererRecord(value)) {
		issues.push({ path, code: 'placement.type', message: 'placement 必须是对象', severity: 'error' });
		return false;
	}
	pushNumberIssue(value.x, `${path}.x`, issues);
	pushNumberIssue(value.y, `${path}.y`, issues);
	pushNumberIssue(value.width, `${path}.width`, issues, { positive: true });
	pushNumberIssue(value.height, `${path}.height`, issues, { positive: true });
	pushNumberIssue(value.rotate, `${path}.rotate`, issues);
	pushNumberIssue(value.zIndex, `${path}.zIndex`, issues);
	validateCornerRadii(value, path, issues);
	return true;
};

const isSortableDocument = (value: unknown): value is RendererSortableDocument => (
	isRendererRecord(value)
	&& value.schemaVersion === RENDERER_SCHEMA_VERSION
	&& isRendererRecord(value.meta)
	&& typeof value.meta.id === 'string'
	&& isRendererRecord(value.layout)
	&& value.layout.mode === 'sortable'
	&& Array.isArray(value.blocks)
);

const isDraggableDocument = (value: unknown): value is RendererDraggableDocument => (
	isRendererRecord(value)
	&& value.schemaVersion === RENDERER_SCHEMA_VERSION
	&& isRendererRecord(value.meta)
	&& typeof value.meta.id === 'string'
	&& isRendererRecord(value.layout)
	&& value.layout.mode === 'draggable'
	&& Array.isArray(value.blocks)
);

export const validateRendererDocument = (value: unknown): RendererValidationResult => {
	const issues: RendererIssue[] = [];
	if (!isRendererRecord(value)) {
		return {
			valid: false,
			issues: [{ path: '$', code: 'document.type', message: '页面文档必须是对象', severity: 'error' }]
		};
	}
	if (!isRendererJsonSafe(value)) {
		issues.push({
			path: '$',
			code: 'document.json',
			message: '页面文档必须是有限深度的 JSON-safe 数据',
			severity: 'error'
		});
	}
	if (value.schemaVersion !== RENDERER_SCHEMA_VERSION) {
		issues.push({
			path: '$.schemaVersion',
			code: 'document.version',
			message: `仅支持 schemaVersion ${RENDERER_SCHEMA_VERSION}`,
			severity: 'error'
		});
	}
	const meta = value.meta;
	if (!isRendererRecord(meta) || typeof meta.id !== 'string' || !meta.id) {
		issues.push({ path: '$.meta.id', code: 'document.id', message: '页面 meta.id 必须是非空字符串', severity: 'error' });
	} else {
		(['title', 'description'] as const).forEach((key) => {
			if (typeof meta[key] !== 'undefined' && typeof meta[key] !== 'string') {
				issues.push({
					path: `$.meta.${key}`,
					code: `document.${key}`,
					message: `${key} 必须是字符串`,
					severity: 'error'
				});
			}
		});
		(['createdAt', 'updatedAt'] as const).forEach((key) => {
			if (typeof meta[key] !== 'undefined') {
				pushNumberIssue(meta[key], `$.meta.${key}`, issues, { nonNegative: true });
			}
		});
	}
	if (!isRendererRecord(value.layout)) {
		issues.push({ path: '$.layout', code: 'layout.type', message: 'layout 必须是对象', severity: 'error' });
	} else if (value.layout.mode === 'sortable') {
		validateSortableLayout(value.layout, issues);
	} else if (value.layout.mode === 'draggable') {
		validateDraggableLayout(value.layout, issues);
	} else {
		issues.push({ path: '$.layout.mode', code: 'layout.mode', message: 'mode 必须是 sortable 或 draggable', severity: 'error' });
	}
	const layoutMode = isRendererRecord(value.layout) ? value.layout.mode : undefined;
	if (!Array.isArray(value.blocks)) {
		issues.push({ path: '$.blocks', code: 'document.blocks', message: 'blocks 必须是数组', severity: 'error' });
		return { valid: false, issues };
	}
	if (value.blocks.length > RENDERER_MAX_NODES) {
		issues.push({ path: '$.blocks', code: 'document.nodes', message: `页面节点不能超过 ${RENDERER_MAX_NODES} 个`, severity: 'error' });
	}

	const ids = new Set<string>();
	value.blocks.slice(0, RENDERER_MAX_NODES + 1).forEach((node, index) => {
		const path = `$.blocks[${index}]`;
		if (!isRendererRecord(node)) {
			issues.push({ path, code: 'node.type', message: '节点必须是对象', severity: 'error' });
			return;
		}
		if (typeof node.id !== 'string' || !node.id) {
			issues.push({ path: `${path}.id`, code: 'node.id', message: '节点 id 必须是非空字符串', severity: 'error' });
		} else if (ids.has(node.id)) {
			issues.push({ path: `${path}.id`, code: 'node.id.duplicate', message: `节点 id 重复：${node.id}`, severity: 'error' });
		} else ids.add(node.id);
		if (!isRendererRecord(node.module)) {
			issues.push({ path: `${path}.module`, code: 'module.type', message: 'module 必须是对象', severity: 'error' });
			return;
		}
		if (typeof node.module.type !== 'string' || !node.module.type) {
			issues.push({ path: `${path}.module.type`, code: 'module.name', message: '模块 type 必须是非空字符串', severity: 'error' });
		}
		if (!Number.isInteger(node.module.version) || Number(node.module.version) < 1) {
			issues.push({ path: `${path}.module.version`, code: 'module.version', message: '模块 version 必须是正整数', severity: 'error' });
		}
		if (!isRendererRecord(node.module.props) || !isRendererJsonSafe(node.module.props)) {
			issues.push({ path: `${path}.module.props`, code: 'module.props', message: '模块 props 必须是有限深度的 JSON-safe 对象', severity: 'error' });
		}
		if (typeof node.locked !== 'undefined' && typeof node.locked !== 'boolean') {
			issues.push({ path: `${path}.locked`, code: 'node.locked', message: 'locked 必须是布尔值', severity: 'error' });
		}
		if (typeof node.children !== 'undefined') {
			issues.push({ path: `${path}.children`, code: 'node.children.unsupported', message: 'V2 文档不支持 children', severity: 'error' });
		}
		if (layoutMode === 'sortable') {
			validateAppearance(node.appearance, `${path}.appearance`, issues);
			if (typeof node.placement !== 'undefined') {
				issues.push({
					path: `${path}.placement`,
					code: 'placement.unsupported',
					message: 'sortable 节点不能包含 placement',
					severity: 'error'
				});
			}
		} else if (layoutMode === 'draggable') {
			validatePlacement(node.placement, `${path}.placement`, issues);
			if (typeof node.appearance !== 'undefined') {
				issues.push({
					path: `${path}.appearance`,
					code: 'appearance.unsupported',
					message: 'draggable 节点不能包含 appearance',
					severity: 'error'
				});
			}
		}
	});
	const valid = !issues.some(issue => issue.severity === 'error');
	if (!valid) return { valid, issues };
	if (isSortableDocument(value)) return { valid, issues, document: value };
	if (isDraggableDocument(value)) return { valid, issues, document: value };
	return { valid: false, issues };
};
