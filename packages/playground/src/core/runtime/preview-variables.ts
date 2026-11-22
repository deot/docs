import type { PlaygroundPreviewVariable } from '../../types';
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

export interface NormalizedPreviewVariable {
	name: `--${string}`;
	label: string;
	values: string[];
	value: string;
}

const CUSTOM_PROPERTY_NAME = /^--[A-Za-z_][\w-]*$/u;

/**
 * @param name 待检查的属性名。
 * @returns 是否是可注入的自定义属性名。
 */
export const isPreviewVariableName = (name: string): name is `--${string}` => (
	CUSTOM_PROPERTY_NAME.test(name)
);

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
		const values: string[] = [];
		for (const value of record.values) {
			if (typeof value !== 'string' || !value.trim() || values.includes(value)) continue;
			values.push(value);
		}
		if (!values.length) continue;
		seen.add(record.name);
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
			value: preferred
		});
	}
	return normalized;
};

/**
 * 计算要写到预览根上的 CSS 变量。
 * `--rem` 会在同一节点重写 `--vc-rem`，因为库的默认公式定义在 `:root`，子节点只设 `--rem` 不会改变计算结果。
 * local 的移动端 `auto` 按预览列宽度计算；iframe 的 `auto` 不改写，iframe 自己的 `100vw` 就是列宽。
 * @param selections 当前选中的变量。
 * @param options 预览挂载方式。
 * @param options.local 是否直接渲染在当前文档。
 * @param options.mobile 是否处于移动端分栏。
 * @returns 需要写入和移除的自定义属性。
 */
export const resolvePreviewRootVars = (
	selections: readonly PreviewVariableSelection[],
	options: { local: boolean; mobile: boolean }
): PreviewRootVars => {
	const set: Record<string, string> = {};
	const managed = new Set<string>();
	let rem: string | undefined;
	let vcRem: string | undefined;

	for (const item of selections) {
		if (!isPreviewVariableName(item.name)) continue;
		if (item.name === '--rem') {
			rem = item.value;
			managed.add('--rem');
			continue;
		}
		if (item.name === '--vc-rem') {
			vcRem = item.value;
			managed.add('--vc-rem');
			continue;
		}
		managed.add(item.name);
		if (item.value === 'auto') continue;
		set[item.name] = item.value;
	}

	if (rem && rem !== 'auto') set['--rem'] = rem;

	if (vcRem && vcRem !== 'auto') {
		set['--vc-rem'] = vcRem;
		managed.add('--vc-rem');
	} else if (rem && rem !== 'auto') {
		set['--vc-rem'] = 'var(--rem)';
		managed.add('--vc-rem');
	} else if (options.local && options.mobile) {
		set['--vc-rem'] = LOCAL_MOBILE_VC_REM;
		managed.add('--vc-rem');
	} else if (rem !== undefined || vcRem === 'auto') {
		managed.add('--vc-rem');
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
