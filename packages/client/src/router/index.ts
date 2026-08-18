import { createRouter, createWebHistory } from 'vue-router';
import type { RouteLocationNormalized, RouteRecordRaw } from 'vue-router';
import { ResourceSlot } from '../components/layout';
import DatabasePage from '../pages/database/index.vue';
import EditorDemosPage from '../pages/renderer-editor-demos/index.vue';
import EditorPage from '../pages/renderer-editor/index.vue';
import HomePage from '../pages/home/index.vue';
import {
	getDefaultLanguage,
	getDocsDeploymentBase
} from '../utils/resolver';
import { isExternalLink } from '../utils/link';
import { localizeRoutePath } from '../utils/route';
import type { DocsConfig, DocsRouteConfig } from '../types';

export { getRouteValue } from '../utils/route';

const slotComponents = {
	default: ResourceSlot,
	extra: ResourceSlot
};

const slotProps = {
	default: { name: 'content' },
	extra: { name: 'extra' }
};

const hasConfiguredLanguage = (config: DocsConfig, language: string) => (
	Object.prototype.hasOwnProperty.call(config.locales, language)
);

const hasLanguage = (config: DocsConfig, path: string) => {
	const pathname = path.split(/[?#]/u, 1)[0];
	const language = pathname.split('/').filter(Boolean)[0];
	const configuredLanguages = Object.keys(config.locales);
	return Boolean(language && (
		hasConfiguredLanguage(config, language)
		|| (!configuredLanguages.length && language === getDefaultLanguage(config))
	));
};

const matchesConfiguredPath = (config: DocsConfig, pathname: string) => {
	const target = pathname.split('/').filter(Boolean);
	return Object.keys(config.routes).some((path) => {
		if (path === '/' || path === '*') return false;
		const parts = path.split('/').filter(Boolean);
		return parts.length === target.length && parts.every((part, index) => (
			part.startsWith(':') || part === target[index]
		));
	});
};

type RoutePathTarget = Pick<RouteLocationNormalized, 'path' | 'query' | 'hash'>;

const replaceLanguage = (defaultLanguage: string, to: RoutePathTarget) => {
	const segments = to.path.split('/').filter(Boolean);
	segments[0] = defaultLanguage;
	return {
		path: `/${segments.join('/')}`,
		query: to.query,
		hash: to.hash
	};
};

/*
 * 单段路径会与 `/:lang` 产生歧义。如果它同时也是已配置的内容路由
 * （例如 `/:name`），则视为缺少语言并补上默认语言；否则将其视为
 * 非法语言根路径并替换。多段本地化路由始终可以安全替换第一段。
 */
const normalizeInvalidLanguage = (
	config: DocsConfig,
	defaultLanguage: string,
	to: RoutePathTarget,
	languageRoot = false
) => {
	if (languageRoot && matchesConfiguredPath(config, to.path)) {
		return {
			path: `/${defaultLanguage}${to.path}`,
			query: to.query,
			hash: to.hash
		};
	}
	return replaceLanguage(defaultLanguage, to);
};

// 内部重定向只补一次语言前缀，显式语言路径和外部 URL 保持不变。
export const localizePath = (config: DocsConfig, lang: string, target: string) => {
	if (isExternalLink(target) || hasLanguage(config, target)) {
		return target;
	}
	return localizeRoutePath(lang, target);
};

const resolveRedirect = (
	config: DocsConfig,
	target: string | ((to: RouteLocationNormalized) => string),
	to: any
) => localizePath(config, String(to.params.lang || getDefaultLanguage(config)), (
	typeof target === 'function' ? target(to as RouteLocationNormalized) : target
));

const createRouteRecord = (
	config: DocsConfig,
	path: string,
	routeConfig: DocsRouteConfig,
	options: { localized?: boolean; languageRoot?: boolean } = {}
): RouteRecordRaw => {
	if (typeof routeConfig === 'string' || typeof routeConfig === 'function') {
		return {
			path,
			redirect: (to) => {
				const lang = String(to.params.lang || '');
				if (options.localized && !hasConfiguredLanguage(config, lang)) {
					return normalizeInvalidLanguage(
						config,
						getDefaultLanguage(config),
						to,
						options.languageRoot
					);
				}
				return resolveRedirect(config, routeConfig, to);
			}
		};
	}
	return {
		path,
		components: slotComponents,
		props: slotProps,
		meta: {
			docsRoute: routeConfig,
			docsLocalized: options.localized,
			docsLanguageRoot: options.languageRoot
		}
	};
};

export const createDocsRouter = (config: DocsConfig) => {
	const defaultLanguage = getDefaultLanguage(config);
	const hasConfiguredRoot = Object.prototype.hasOwnProperty.call(config.routes, '/');
	const hasConfiguredEditorRoute = Object.keys(config.routes).some(path => (
		(path.startsWith('/') ? path : `/${path}`) === '/renderer-editor'
	));
	const hasConfiguredDemosRoute = Object.keys(config.routes).some(path => (
		(path.startsWith('/') ? path : `/${path}`) === '/renderer-editor-demos'
	));
	const isDevelopment = config.runtime?.mode === 'development';
	const routes: RouteRecordRaw[] = [
		{
			path: '/:lang/__docs/database',
			component: DatabasePage,
			meta: { docsDatabase: true, docsLocalized: true }
		},
		{
			path: '/:lang/__docs/renderer-editor',
			component: EditorPage,
			meta: { docsEditor: true, docsLocalized: true }
		}
	];
	if (isDevelopment) routes.push({
		path: '/:lang/__docs/renderer-editor-demos',
		component: EditorDemosPage,
		meta: { docsEditorDemos: true, docsLocalized: true }
	});
	if (!hasConfiguredEditorRoute) routes.push(
		{
			path: '/renderer-editor',
			redirect: to => ({ path: `/${defaultLanguage}/renderer-editor`, query: to.query, hash: to.hash })
		},
		{
			path: '/:lang/renderer-editor',
			component: EditorPage,
			meta: { docsEditor: true, docsLocalized: true }
		}
	);
	if (isDevelopment && !hasConfiguredDemosRoute) routes.push(
		{
			path: '/renderer-editor-demos',
			redirect: to => ({
				path: `/${defaultLanguage}/renderer-editor-demos`,
				query: to.query,
				hash: to.hash
			})
		},
		{
			path: '/:lang/renderer-editor-demos',
			component: EditorDemosPage,
			meta: { docsEditorDemos: true, docsLocalized: true }
		}
	);
	routes.push({
		path: '/',
		redirect: `/${defaultLanguage}`
	});
	if (hasConfiguredRoot) {
		routes.push(createRouteRecord(
			config,
			'/:lang',
			config.routes['/'],
			{ localized: true, languageRoot: true }
		));
	} else {
		routes.push({
			path: '/:lang',
			component: HomePage,
			meta: {
				docsHome: true,
				docsLocalized: true,
				docsLanguageRoot: true,
				docsRoute: {
					content: null,
					sidebar: null,
					header: 'default',
					footer: 'default',
					extra: null
				}
			}
		});
	}

	Object.entries(config.routes).forEach(([path, routeConfig]) => {
		if (path === '/' || path === '*') return;
		const normalized = path.startsWith('/') ? path : `/${path}`;
		routes.push({
			path: normalized,
			redirect: to => `/${defaultLanguage}${to.fullPath}`
		});
		routes.push(createRouteRecord(
			config,
			`/:lang${normalized}`,
			routeConfig,
			{ localized: true }
		));
	});

	const fallback = config.routes['*'];
	if (fallback) {
		routes.push(createRouteRecord(
			config,
			'/:lang/:pathMatch(.*)*',
			fallback,
			{ localized: true }
		));
	} else {
		routes.push({
			path: '/:lang/:pathMatch(.*)*',
			redirect: to => `/${String(to.params.lang || defaultLanguage)}`
		});
	}

	const deploymentBase = getDocsDeploymentBase(config);
	const historyBase = new URL(deploymentBase).pathname;
	const router = createRouter({ history: createWebHistory(historyBase), routes });
	router.beforeEach((to) => {
		const lang = String(to.params.lang || '');
		const configuredLanguages = Object.keys(config.locales);
		if (lang && (
			hasConfiguredLanguage(config, lang)
			|| (!configuredLanguages.length && lang === defaultLanguage)
		)) {
			return true;
		}
		if (to.meta.docsLocalized) {
			return normalizeInvalidLanguage(
				config,
				defaultLanguage,
				to,
				Boolean(to.meta.docsLanguageRoot)
			);
		}
		return {
			path: `/${defaultLanguage}${to.path === '/' ? '' : to.path}`,
			query: to.query,
			hash: to.hash
		};
	});
	return router;
};
