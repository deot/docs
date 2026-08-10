import type { RouteLocationNormalized } from 'vue-router';
import type { DocsRoute } from '../types';

/**
 * 按显式 value、动态参数和路径末段的顺序确定当前文档值。
 * 该纯函数独立于 Router 注册模块，避免布局组件反向导入 Router 时形成循环依赖。
 * @param route 当前标准化路由。
 * @param config 当前路由的文档配置。
 * @returns Markdown Resolver 使用的逻辑文档值。
 */
export const getRouteValue = (route: RouteLocationNormalized, config: DocsRoute) => {
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
