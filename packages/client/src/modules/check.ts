import type { Router } from 'vue-router';
import { Gateway } from './gateway';
import { Resource } from './resource';
import type { DocsConfig } from '../types';

export interface DocsCheckRoute {
	/** 站内路由，已带语言前缀。 */
	path: string;
	/** Markdown 源文件的逻辑地址，例如 `docs/markdown.md`。 */
	source: string;
	lang: string;
}

/**
 * 为 `doc check` 暴露路由列表和导航。只有页面加载前设置了 `window.__DOCS_CHECK__` 时生效。
 * @param router 文档路由。
 * @param config 站点配置。
 */
export const installDocsCheck = (router: Router, config: DocsConfig) => {
	const hooks = typeof window === 'undefined' ? undefined : window.__DOCS_CHECK__;
	if (!hooks || typeof hooks !== 'object') return;
	hooks.routes = async (): Promise<DocsCheckRoute[]> => {
		const records = await Gateway.list();
		const routes = await Resource.plan.collectRouteResources(config, records);
		return routes
			.filter(item => item.identity.type === 'markdown')
			.map(item => ({ path: item.path, source: item.identity.source, lang: item.identity.lang }));
	};
	// 返回路由是否变化；没变化时页面不会重新渲染，检查脚本直接读取当前示例。
	hooks.navigate = async (path: string) => {
		const before = router.currentRoute.value.fullPath;
		await router.push(path);
		return router.currentRoute.value.fullPath !== before;
	};
	hooks.ready = true;
};
