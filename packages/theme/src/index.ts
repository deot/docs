import './variables.scss';

export const DOCS_THEMES = ['light', 'dark'] as const;

export type DocsTheme = typeof DOCS_THEMES[number];
export type DocsThemePreference = DocsTheme | 'system';

export interface DocsThemeOptions {
	/** 未保存用户设置时采用的主题，默认跟随系统。 */
	default?: DocsThemePreference;
}

/**
 * 判断外部配置或持久化数据是否属于主题协议。
 * @param value 待检查的外部值。
 * @returns 是否为受支持的主题值。
 */
export const isDocsTheme = (value: unknown): value is DocsTheme =>
	DOCS_THEMES.includes(value as DocsTheme);
