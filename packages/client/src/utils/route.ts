import type { RouteLocationNormalizedGeneric } from 'vue-router';
import { isExternalLink } from './link';
import type { DocsConfig, DocsRoute } from '../types';

/**
 * 保证路径以单个斜杠开头。
 * @param value 原始路径。
 * @returns 以 `/` 开头的路径。
 */
export const ensureLeadingSlash = (value: string) => (value.startsWith('/') ? value : `/${value}`);

/**
 * 去掉空段后重新拼接路径。
 * @param value 可能含多余斜杠的路径。
 * @returns 规范化后的绝对路径。
 */
export const normalizePathname = (value: string) => `/${value.split('/').filter(Boolean).join('/')}`;

/**
 * 给无语言前缀的路径补上 `/${lang}`。
 * @param lang 当前语言。
 * @param pathname 已规范化或相对的路径。
 * @returns 带语言前缀的站内路径。
 */
export const localizeRoutePath = (lang: string, pathname: string) => {
	const normalized = ensureLeadingSlash(pathname);
	return `/${lang}${normalized === '/' ? '' : normalized}`;
};

/**
 * 给站内地址补语言前缀；外链和已带已配置语言的地址保持不变。
 * @param config 文档配置，用于识别语言路径段。
 * @param lang 当前语言。
 * @param target 原始跳转地址。
 * @returns 可直接交给 RouterLink 的地址。
 */
export const localizePath = (config: DocsConfig, lang: string, target: string) => {
	const pathname = target.split(/[?#]/u, 1)[0];
	const language = pathname.split('/').filter(Boolean)[0];
	const configuredLanguages = Object.keys(config.locales);
	const hasLanguage = Boolean(language && (
		Object.prototype.hasOwnProperty.call(config.locales, language)
		|| (!configuredLanguages.length && language === lang)
	));
	return isExternalLink(target) || hasLanguage
		? target
		: localizeRoutePath(lang, target);
};

/**
 * 按显式 value、动态参数和路径末段的顺序确定当前文档值。
 * 该纯函数独立于 Router 注册模块，避免布局组件反向导入 Router 时形成循环依赖。
 * @param route 当前标准化路由，或资源计划合成的等价 route shape。
 * @param config 当前路由的文档配置。
 * @returns Markdown Resolver 使用的逻辑文档值。
 */
export const getRouteValue = (route: RouteLocationNormalizedGeneric, config: DocsRoute) => {
	if (typeof config.value === 'function') return config.value(route);
	if (typeof config.value === 'string') return config.value;
	const params = Object.entries(route.params)
		.filter(([key]) => key !== 'lang')
		.flatMap(([, value]) => value)
		.filter(Boolean);
	const segments = route.path.split('/').filter(Boolean);
	if (segments[0] === String(route.params.lang || '')) segments.shift();
	return String(params.at(-1) || segments.at(-1) || 'index');
};
