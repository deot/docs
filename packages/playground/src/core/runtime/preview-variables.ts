import type {
	PlaygroundPreviewVariable,
	PlaygroundPreviewVariableLink,
	PlaygroundPreviewVariableLinks
} from '../../types';
import { LOCAL_MOBILE_VC_REM } from './mobile';

export interface PreviewVariableSelection {
	name: string;
	value: string;
}

/** 写到预览根上的声明。`remove` 里的属性会从内联样式删掉。 */
export interface PreviewRootVars {
	set: Record<string, string>;
	remove: string[];
}

export interface NormalizedPreviewVariableOption {
	label: string;
	value: string;
}

export interface NormalizedPreviewVariable {
	name: `--${string}`;
	label: string;
	values: string[];
	options: NormalizedPreviewVariableOption[];
	value: string;
}

/** 默认联动：`--rem` 改写 vc 的 `--vc-rem`，local 移动端的 `auto` 按预览列宽度计算。 */
export const DEFAULT_PREVIEW_VARIABLE_LINKS: readonly PlaygroundPreviewVariableLink[] = Object.freeze([{
	source: '--rem',
	target: '--vc-rem',
	auto: LOCAL_MOBILE_VC_REM
}]);

const CUSTOM_PROPERTY_NAME = /^--[A-Za-z_][\w-]*$/u;

/**
 * @param name 待检查的属性名。
 * @returns 是否是可注入的自定义属性名。
 */
export const isPreviewVariableName = (name: string): name is `--${string}` => (
	CUSTOM_PROPERTY_NAME.test(name)
);

/**
 * @param value 原始值项：字符串，或 `{ label, value }`。
 * @returns 统一后的选项；非法项返回 `undefined`。
 */
const normalizeOption = (value: unknown): NormalizedPreviewVariableOption | undefined => {
	if (typeof value === 'string') return value.trim() ? { label: value, value } : undefined;
	if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
	const record = value as Partial<NormalizedPreviewVariableOption>;
	if (typeof record.value !== 'string' || !record.value.trim()) return undefined;
	const label = typeof record.label === 'string' && record.label.trim() ? record.label.trim() : record.value;
	return { label, value: record.value };
};

/**
 * 把底栏选项收成可渲染的变量。非法项跳过，不打断预览。
 * @param source 组件收到的原始配置。
 * @returns 可渲染的变量列表。
 */
export const normalizePreviewVariables = (
	source: readonly unknown[] | undefined
): NormalizedPreviewVariable[] => {
	if (!Array.isArray(source)) return [];
	const normalized: NormalizedPreviewVariable[] = [];
	const seen = new Set<string>();
	for (const item of source) {
		if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
		const record = item as Partial<PlaygroundPreviewVariable>;
		if (typeof record.name !== 'string' || !isPreviewVariableName(record.name)) continue;
		if (seen.has(record.name) || !Array.isArray(record.values)) continue;
		const options: NormalizedPreviewVariableOption[] = [];
		for (const value of record.values) {
			const option = normalizeOption(value);
			if (!option || options.some(current => current.value === option.value)) continue;
			options.push(option);
		}
		if (!options.length) continue;
		seen.add(record.name);
		const values = options.map(option => option.value);
		const preferred = typeof record.default === 'string' && values.includes(record.default)
			? record.default
			: values[0];
		const label = typeof record.label === 'string' && record.label.trim()
			? record.label.trim()
			: record.name.slice(2);
		normalized.push({
			name: record.name,
			label,
			values,
			options,
			value: preferred
		});
	}
	return normalized;
};

/**
 * @param source 组件收到的联动配置。`undefined` 使用默认值，`false` 关闭。
 * @returns 合法的联动列表。
 */
export const normalizePreviewVariableLinks = (
	source: PlaygroundPreviewVariableLinks | undefined
): readonly PlaygroundPreviewVariableLink[] => {
	if (source === undefined) return DEFAULT_PREVIEW_VARIABLE_LINKS;
	if (!Array.isArray(source)) return [];
	return source.filter((item): item is PlaygroundPreviewVariableLink => (
		!!item && typeof item === 'object'
		&& typeof item.source === 'string' && isPreviewVariableName(item.source)
		&& typeof item.target === 'string' && isPreviewVariableName(item.target)
		&& item.source !== item.target
		&& (item.auto === undefined || (typeof item.auto === 'string' && !!item.auto.trim()))
	));
};

/**
 * 计算要写到预览根上的 CSS 变量。
 * 联动的 `target` 要在同一节点重写，因为库的默认公式通常定义在 `:root`，子节点只设 `source` 不会改变计算结果。
 * local 的移动端 `auto` 按联动的 `auto` 计算；iframe 的 `auto` 不改写，iframe 自己的 `100vw` 就是列宽。
 * @param selections 当前选中的变量。
 * @param options 预览挂载方式。
 * @param options.local 是否直接渲染在当前文档。
 * @param options.mobile 是否处于移动端分栏。
 * @param options.links 变量联动，缺省为 `--rem` → `--vc-rem`。
 * @returns 需要写入和移除的自定义属性。
 */
export const resolvePreviewRootVars = (
	selections: readonly PreviewVariableSelection[],
	options: { local: boolean; mobile: boolean; links?: readonly PlaygroundPreviewVariableLink[] }
): PreviewRootVars => {
	const set: Record<string, string> = {};
	const managed = new Set<string>();
	const values = new Map<string, string>();

	for (const item of selections) {
		if (!isPreviewVariableName(item.name)) continue;
		values.set(item.name, item.value);
		managed.add(item.name);
		if (item.value !== 'auto') set[item.name] = item.value;
	}

	for (const link of options.links ?? DEFAULT_PREVIEW_VARIABLE_LINKS) {
		const target = values.get(link.target);
		const source = values.get(link.source);
		if (target !== undefined && target !== 'auto') continue;
		if (source !== undefined && source !== 'auto') {
			set[link.target] = `var(${link.source})`;
			managed.add(link.target);
		} else if (options.local && options.mobile && link.auto) {
			set[link.target] = link.auto;
			managed.add(link.target);
		} else if (source !== undefined) {
			managed.add(link.target);
		}
	}

	return {
		set,
		remove: [...managed].filter(name => !(name in set))
	};
};

export const applyPreviewRootVars = (element: HTMLElement, vars: PreviewRootVars) => {
	for (const name of vars.remove) element.style.removeProperty(name);
	for (const [name, value] of Object.entries(vars.set)) element.style.setProperty(name, value);
};
