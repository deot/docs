import './variables.scss';

export const DOCS_THEMES = ['light', 'dark'] as const;

export type DocsTheme = typeof DOCS_THEMES[number];
export type DocsThemePreference = DocsTheme | 'system';

export const DOCS_THEME_COLOR_KEYS = [
	'color-contrast-light',
	'color-primary',
	'color-secondary',
	'color-link',
	'color-mask',
	'color-neutral-light',
	'color-shadow-fixed',
	'color-pattern',
	'color-error',
	'background-color',
	'background-color-light',
	'background-color-lighter',
	'background-color-lightest',
	'background-color-primary-light',
	'background-color-code',
	'background-color-footer',
	'background-color-tip-light',
	'background-color-warning-light',
	'background-color-error-light',
	'foreground-color',
	'foreground-color-light',
	'foreground-color-dark',
	'foreground-color-footer',
	'border-color'
] as const;

export type DocsThemeColorKey = typeof DOCS_THEME_COLOR_KEYS[number];
export type DocsThemeColor = string | { light: string; dark?: string };

export interface DocsThemeOptions {
	/**
	 * 未保存用户设置时采用的主题，默认跟随系统。
	 */
	default?: DocsThemePreference;
	/**
	 * Docs 语义色覆盖。字符串在两个主题共用；对象缺省 dark 时沿用 light。
	 */
	colors?: Partial<Record<DocsThemeColorKey, DocsThemeColor>>;
}

/**
 * 判断外部配置或持久化数据是否属于主题协议。
 * @param value 待检查的外部值。
 * @returns 是否为受支持的主题值。
 */
export const isDocsTheme = (value: unknown): value is DocsTheme =>
	DOCS_THEMES.includes(value as DocsTheme);
