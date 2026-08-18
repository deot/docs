import type { Language } from '@deot/docs-locale';
import type {
	RendererIssue,
	RendererLocaleText
} from '../../types';

export const localeText = (english: string, chinese: string): RendererLocaleText => ({
	'en-US': english,
	'zh-CN': chinese
});

export const resolveLocaleText = (
	value: RendererLocaleText,
	context?: { locale?: Pick<Language, 'name'> }
) => {
	if (typeof value === 'string') return value;
	const name = context?.locale?.name || 'en-US';
	return value[name] || value['en-US'] || Object.values(value)[0] || '';
};

export const toRecord = (value: unknown): Record<string, unknown> => (
	value && typeof value === 'object' && !Array.isArray(value)
		? value as Record<string, unknown>
		: {}
);

export const toLength = (value: unknown, fallback: number) => {
	const number = Number(value);
	return Number.isFinite(number) ? number : fallback;
};

export const toStringValue = (value: unknown, fallback = '') => (
	typeof value === 'string' ? value : fallback
);

export const toBooleanValue = (value: unknown, fallback = false) => (
	typeof value === 'boolean' ? value : fallback
);

export const toArrayValue = <T>(
	value: unknown,
	normalize: (item: unknown, index: number) => T
): T[] => (
	Array.isArray(value) ? value.map(normalize) : []
);

export const SECTION_ALIGNMENTS = ['left', 'center'] as const;
export const TEXT_ALIGNMENTS = ['left', 'center', 'right'] as const;

const UNSAFE_HREF = /^(?:data|javascript|vbscript):/iu;

/**
 * 判断链接是否使用了可执行脚本的协议。
 * @param value 用户填写的链接。
 * @returns 协议是否不安全。
 */
export const isUnsafeHref = (value: string) => UNSAFE_HREF.test(value.trim());

export const toEnumValue = <T extends string>(
	value: unknown,
	values: readonly T[],
	fallback: T
): T => values.includes(value as T) ? value as T : fallback;

/** hero / cta / features / steps / faq 共用的区块标题组。 */
export interface RendererSectionHeader {
	/**
	 * 标题上方的短标签，可空。
	 */
	eyebrow: string;
	title: string;
	description: string;
	/**
	 * 标题组水平对齐。区块内正文对齐走各自 props。
	 */
	align: typeof SECTION_ALIGNMENTS[number];
}

/**
 * 规范化区块标题组。
 * @param record 已转成对象的原始 props。
 * @param fallbackAlign 对齐方式缺省值，首屏默认左对齐、其余居中。
 * @returns 补齐后的标题组。
 */
export const normalizeSectionHeader = (
	record: Record<string, unknown>,
	fallbackAlign: RendererSectionHeader['align']
): RendererSectionHeader => ({
	eyebrow: toStringValue(record.eyebrow),
	title: toStringValue(record.title),
	description: toStringValue(record.description),
	align: toEnumValue(record.align, SECTION_ALIGNMENTS, fallbackAlign)
});

export const moduleIssue = (
	path: string,
	code: string,
	message: string
): RendererIssue => ({ path, code, message, severity: 'error' });

export const validateNumberRange = (
	value: unknown,
	path: string,
	options: { min?: number; max?: number; integer?: boolean }
): RendererIssue[] => {
	if (typeof value !== 'number' || !Number.isFinite(value)) {
		return [moduleIssue(path, 'number.finite', '必须是有限数值')];
	}
	if (options.integer && !Number.isInteger(value)) {
		return [moduleIssue(path, 'number.integer', '必须是整数')];
	}
	if (typeof options.min === 'number' && value < options.min) {
		return [moduleIssue(path, 'number.min', `不能小于 ${options.min}`)];
	}
	if (typeof options.max === 'number' && value > options.max) {
		return [moduleIssue(path, 'number.max', `不能大于 ${options.max}`)];
	}
	return [];
};

export const validateEnum = <T extends string>(
	value: unknown,
	path: string,
	values: readonly T[]
): RendererIssue[] => values.includes(value as T)
	? []
	: [moduleIssue(path, 'value.enum', `必须是 ${values.join('、')} 之一`)];

export interface RendererActionValue {
	label: string;
	/**
	 * 跳转目标。站内路径或 http(s) 地址，不是 Vue Router name。
	 */
	to: string;
	variant: RendererActionVariant;
	size: RendererActionSize;
	/**
	 * 按钮填充色，CSS 颜色；空字符串用主题默认。
	 */
	color: string;
	/**
	 * 按钮文字色；空字符串用主题默认。
	 */
	textColor: string;
	target?: '_blank';
}

export const ACTION_VARIANTS = ['solid', 'outline', 'ghost', 'link'] as const;
export const ACTION_SIZES = ['small', 'medium', 'large'] as const;
export type RendererActionVariant = typeof ACTION_VARIANTS[number];
export type RendererActionSize = typeof ACTION_SIZES[number];

const LEGACY_ACTION_VARIANTS: Record<string, RendererActionVariant> = {
	primary: 'solid',
	default: 'outline'
};

export const normalizeActionVariant = (value: unknown): RendererActionVariant => {
	if (typeof value === 'string' && value in LEGACY_ACTION_VARIANTS) {
		return LEGACY_ACTION_VARIANTS[value];
	}
	return toEnumValue(value, ACTION_VARIANTS, 'solid');
};

export const normalizeActionValues = (value: unknown): RendererActionValue[] => (
	toArrayValue(value, (item) => {
		const record = toRecord(item);
		return {
			label: toStringValue(record.label),
			to: toStringValue(record.to),
			variant: normalizeActionVariant(record.variant),
			size: toEnumValue(record.size, ACTION_SIZES, 'medium'),
			color: toStringValue(record.color),
			textColor: toStringValue(record.textColor),
			...(record.target === '_blank' ? { target: '_blank' as const } : {})
		};
	})
);

export const validateActionValues = (
	value: readonly RendererActionValue[],
	path = '$.items'
): RendererIssue[] => value.flatMap((item, index) => {
	const itemPath = `${path}[${index}]`;
	return [
		...(item.label.trim()
			? []
			: [moduleIssue(`${itemPath}.label`, 'action.label.required', '操作文案不能为空')]),
		...(item.to.trim()
			? []
			: [moduleIssue(`${itemPath}.to`, 'action.target.required', '操作目标不能为空')]),
		...(isUnsafeHref(item.to)
			? [moduleIssue(`${itemPath}.to`, 'action.target.unsafe', '操作目标协议不安全')]
			: []),
		...validateEnum(item.variant, `${itemPath}.variant`, ACTION_VARIANTS),
		...validateEnum(item.size, `${itemPath}.size`, ACTION_SIZES)
	];
});
