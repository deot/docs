import type {
	MarkdownPlaygroundConfig,
	MarkdownPlaygroundDefaults
} from './types';

const isPlainObject = (value: unknown): value is Record<string, unknown> => (
	!!value && typeof value === 'object' && !Array.isArray(value)
);

/**
 * 与 playground 的 `isPlaygroundMobile` 一致；这里重复实现以保持 playground 懒加载。
 * @param value `mobile` 配置。
 * @returns 是否开启移动端分栏。
 */
const isMobile = (value: unknown) => (
	value === true || (typeof value === 'number' && Number.isFinite(value) && value > 0)
);

const getVariableName = (value: unknown) => (
	isPlainObject(value) && typeof value.name === 'string' ? value.name : undefined
);

/**
 * 按 `name` 合并预览变量：同名项整条替换并保留位置，新名字追加在后。
 * @param base 站点默认的变量。
 * @param override 块里的变量。空数组表示清空。
 * @returns 合并后的变量。
 */
export const mergePreviewVariablesByName = (
	base: readonly unknown[] | undefined,
	override: readonly unknown[]
): unknown[] => {
	if (!override.length || !base?.length) return [...override];
	const result = [...base];
	for (const item of override) {
		const name = getVariableName(item);
		const index = name === undefined ? -1 : result.findIndex(current => getVariableName(current) === name);
		if (index >= 0) result[index] = item;
		else result.push(item);
	}
	return result;
};

/**
 * 合并站点默认值与块配置。
 * 普通默认值按键浅合并，块优先，数组整体替换。
 * 块（或站点默认值）开启 `mobile` 且没有 `styleless` 时，再合并 `mobileDefaults`。
 * @param site 站点默认值，可以带 `mobileDefaults`。
 * @param block 块里的 JSON5 配置。
 * @returns 传给 Playground 的 props，不含 `mobileDefaults`。
 */
export const resolvePlaygroundProps = (
	site: MarkdownPlaygroundDefaults | undefined,
	block: MarkdownPlaygroundConfig | undefined
): MarkdownPlaygroundConfig => {
	const { mobileDefaults, ...defaults } = isPlainObject(site) ? site as MarkdownPlaygroundDefaults : {};
	const own = isPlainObject(block) ? block as MarkdownPlaygroundConfig : {};
	const merged: MarkdownPlaygroundConfig = { ...defaults, ...own };
	if (!isPlainObject(mobileDefaults) || !isMobile(merged.mobile) || merged.styleless) return merged;
	// mobileDefaults 里的 mobile 不参与合并，开关只看块与普通默认值。
	const mobile: MarkdownPlaygroundConfig = { ...(mobileDefaults as MarkdownPlaygroundConfig) };
	delete mobile.mobile;
	const result: MarkdownPlaygroundConfig = { ...defaults, ...mobile, ...own };
	if (Array.isArray(own.previewVariables)) {
		result.previewVariables = mergePreviewVariablesByName(
			mobile.previewVariables ?? defaults.previewVariables,
			own.previewVariables
		) as MarkdownPlaygroundConfig['previewVariables'];
	}
	return result;
};
