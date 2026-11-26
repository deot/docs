/**
 * Playground 配置的非致命警告：写错的键、mobile 下不生效的键。
 * 错误（整块替换为 `PLAYGROUND: …`）仍由 markdown.ts 的校验负责，这里只补充提示，不阻止渲染。
 */

/** 块里可以写的键，对齐 `MarkdownPlaygroundConfig`。 */
export const PLAYGROUND_CONFIG_KEYS: readonly string[] = Object.freeze([
	'entry',
	'title',
	'id',
	'views',
	'viewport',
	'viewportOptions',
	'styleless',
	'options',
	'previewInset',
	'expandable',
	'previewScroller',
	'local',
	'mobile',
	'previewVariables',
	'previewVariableLinks',
	'previewOptions'
]);

/** 只能写在站点配置 `components.playground` 里的键。 */
export const PLAYGROUND_SITE_ONLY_KEYS: readonly string[] = Object.freeze(['mobileDefaults']);

/** 站点默认值里不该出现的实例字段。 */
const PLAYGROUND_INSTANCE_KEYS = new Set(['entry', 'title', 'id']);

/**
 * @param a 第一个字符串。
 * @param b 第二个字符串。
 * @returns 两者的编辑距离。
 */
const distance = (a: string, b: string) => {
	const row = Array.from({ length: b.length + 1 }, (_, index) => index);
	for (let i = 1; i <= a.length; i += 1) {
		let previous = row[0];
		row[0] = i;
		for (let j = 1; j <= b.length; j += 1) {
			const current = row[j];
			row[j] = Math.min(
				row[j] + 1,
				row[j - 1] + 1,
				previous + (a[i - 1] === b[j - 1] ? 0 : 1)
			);
			previous = current;
		}
	}
	return row[b.length];
};

/**
 * @param key 写错的键。
 * @param candidates 可选的键。
 * @returns 最接近的已知键；差得太远时返回空串。
 */
export const suggestPlaygroundKey = (key: string, candidates: readonly string[] = PLAYGROUND_CONFIG_KEYS) => {
	const lower = key.toLowerCase();
	let best = '';
	let bestDistance = Infinity;
	for (const candidate of candidates) {
		const value = candidate.toLowerCase() === lower ? 0 : distance(lower, candidate.toLowerCase());
		if (value < bestDistance) {
			best = candidate;
			bestDistance = value;
		}
	}
	return bestDistance <= Math.max(2, Math.floor(key.length / 4)) ? best : '';
};

const formatUnknownKey = (key: string, candidates: readonly string[]) => {
	const suggestion = suggestPlaygroundKey(key, candidates);
	return suggestion
		? `未知配置 ${key}，是否想写 ${suggestion}？`
		: `未知配置 ${key}，该键会被忽略`;
};

const isMobile = (value: unknown) => (
	value === true || (typeof value === 'number' && Number.isFinite(value) && value > 0)
);

/**
 * 检查块里显式写的配置。只看块本身：站点默认值里的同名键不会触发 mobile 警告。
 * @param propsData 块的 JSON5 配置。
 * @returns 警告文本列表。
 */
export const collectPlaygroundWarnings = (propsData: Record<string, unknown>): string[] => {
	const warnings: string[] = [];
	for (const key of Object.keys(propsData)) {
		if (key === 'view') continue; // 已经作为错误报告。
		if (PLAYGROUND_SITE_ONLY_KEYS.includes(key)) {
			warnings.push(`${key} 只能写在站点配置 components.playground 里，块内会被忽略`);
		} else if (!PLAYGROUND_CONFIG_KEYS.includes(key)) {
			warnings.push(formatUnknownKey(key, PLAYGROUND_CONFIG_KEYS));
		}
	}

	if (!isMobile(propsData.mobile)) return warnings;
	if (propsData.styleless === true) {
		warnings.push('styleless 下 mobile 不生效');
		return warnings;
	}
	if ('views' in propsData) warnings.push('mobile 下 views 不生效，始终分栏显示代码和预览');
	if ('expandable' in propsData) warnings.push('mobile 下 expandable 不生效，分栏高度固定');
	if (propsData.previewScroller === false) {
		warnings.push('mobile 下预览始终使用 Scroller，previewScroller: false 不生效');
	}
	if (propsData.viewport === 'auto') {
		warnings.push('mobile 下 viewport: \'auto\' 等同 375px 宽的预览列');
	}
	if (Array.isArray(propsData.viewportOptions) && propsData.viewportOptions.includes('auto')) {
		warnings.push('mobile 下 viewportOptions 的 \'auto\' 等同 375px 宽的预览列');
	}
	return warnings;
};

/**
 * 检查站点默认值 `components.playground` 的键。
 * @param defaults 站点默认值。
 * @returns 警告文本列表。
 */
export const collectPlaygroundDefaultsWarnings = (defaults: Record<string, unknown>): string[] => {
	const warnings: string[] = [];
	const siteKeys = [...PLAYGROUND_CONFIG_KEYS.filter(key => !PLAYGROUND_INSTANCE_KEYS.has(key)), ...PLAYGROUND_SITE_ONLY_KEYS];
	for (const key of Object.keys(defaults)) {
		if (PLAYGROUND_INSTANCE_KEYS.has(key)) {
			warnings.push(`components.playground.${key} 是单个示例的字段，站点默认值里会被忽略`);
		} else if (!siteKeys.includes(key)) {
			warnings.push(`components.playground: ${formatUnknownKey(key, siteKeys)}`);
		}
	}
	const mobile = defaults.mobileDefaults;
	if (mobile !== undefined) {
		if (!mobile || typeof mobile !== 'object' || Array.isArray(mobile)) {
			warnings.push('components.playground.mobileDefaults 必须是对象');
		} else {
			const mobileKeys = siteKeys.filter(key => key !== 'mobile' && key !== 'mobileDefaults');
			for (const key of Object.keys(mobile)) {
				if (key === 'mobile' || key === 'mobileDefaults' || PLAYGROUND_INSTANCE_KEYS.has(key)) {
					warnings.push(`components.playground.mobileDefaults.${key} 不生效`);
				} else if (!mobileKeys.includes(key)) {
					warnings.push(`components.playground.mobileDefaults: ${formatUnknownKey(key, mobileKeys)}`);
				}
			}
		}
	}
	return warnings;
};
