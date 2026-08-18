import type { RouteLocationNormalizedGeneric } from 'vue-router';
import type { DocsRoute } from '../types';

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
