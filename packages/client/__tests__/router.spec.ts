// @vitest-environment jsdom

vi.mock('../src/components/layout', () => ({ ResourceSlot: { name: 'ResourceSlot' } }));

import { createDocsRouter, getRouteValue, localizePath } from '../src/router';
import type { DocsConfig } from '../src/types';
import { createRouteShape } from './fixtures/docs';

const config: DocsConfig = {
	locales: { 'zh-CN': { label: '简体中文' }, 'en-US': { label: 'English' } },
	routes: {
		'/': '/index',
		'/index': { content: './components/index.vue' },
		'/components/:name': { content: 'default' },
		'*': '/index'
	}
};

describe('docs router', () => {
	it('adds the default language and preserves explicit languages', async () => {
		const router = createDocsRouter(config);
		await router.push('/');
		await router.isReady();
		expect(router.currentRoute.value.path).toBe('/zh-CN/index');
		await router.push('/en-US/components/button');
		expect(router.currentRoute.value.params).toMatchObject({ lang: 'en-US', name: 'button' });
		expect(localizePath(config, 'zh-CN', '/quickstart')).toBe('/zh-CN/quickstart');
		expect(localizePath(config, 'zh-CN', '/en-US/index')).toBe('/en-US/index');
		expect(localizePath(config, 'zh-CN', '/en-US?tab=api#title'))
			.toBe('/en-US?tab=api#title');
		expect(localizePath(config, 'zh-CN', 'quickstart')).toBe('/zh-CN/quickstart');
		expect(localizePath(config, 'zh-CN', '/')).toBe('/zh-CN');
		expect(localizePath(config, 'zh-CN', 'https://example.com/docs')).toBe('https://example.com/docs');
		expect(localizePath(config, 'zh-CN', 'mailto:docs@example.com')).toBe('mailto:docs@example.com');

		await router.push('/components/button');
		expect(router.currentRoute.value.path).toBe('/zh-CN/components/button');

		await router.push('/zh-CN/__docs/database?tab=cache#records');
		expect(router.currentRoute.value.fullPath).toBe('/zh-CN/__docs/database?tab=cache#records');
		expect(router.currentRoute.value.meta.docsDatabase).toBe(true);
		await router.push('/en-US/__docs/database');
		expect(router.currentRoute.value.params.lang).toBe('en-US');
		expect(router.currentRoute.value.meta.docsDatabase).toBe(true);
		await router.push('/fr-FR/__docs/database');
		expect(router.currentRoute.value.path).toBe('/zh-CN/__docs/database');
	});

	it('derives content values from explicit config, params and path', async () => {
		const router = createDocsRouter(config);
		await router.push('/zh-CN/components/button');
		const route = router.currentRoute.value;
		expect(getRouteValue(route, {})).toBe('button');
		expect(getRouteValue(route, { value: 'fixed' })).toBe('fixed');
		expect(getRouteValue(route, { value: to => String(to.params.lang) })).toBe('zh-CN');
	});

	it('supports route functions, object roots and an internal default fallback', async () => {
		const functionConfig: DocsConfig = {
			locales: { en: { label: 'English' } },
			routes: {
				'/': { content: 'default' },
				'/guide': to => `/target-${String(to.params.lang)}`,
				'/target-:locale': { content: null }
			}
		};
		const router = createDocsRouter(functionConfig);
		await router.push('/');
		expect(router.currentRoute.value.path).toBe('/en');
		expect(getRouteValue(router.currentRoute.value, {})).toBe('index');
		await router.push('/en/guide');
		expect(router.currentRoute.value.path).toBe('/en/target-en');
		await router.push('/en/missing');
		expect(router.currentRoute.value.path).toBe('/en');
		expect(getRouteValue(createRouteShape('/en/static', { lang: 'en' }), {})).toBe('static');
	});

	it('keeps the database page on the internal __docs route', async () => {
		const dbRoute = { content: null };
		const router = createDocsRouter({
			...config,
			routes: { ...config.routes, '/db': dbRoute }
		});
		await router.push('/zh-CN/db');
		expect(router.currentRoute.value.meta.docsRoute).toBe(dbRoute);
		expect(router.currentRoute.value.meta.docsDatabase).toBeUndefined();

		await router.push('/en-US/__docs/database');
		expect(router.currentRoute.value.meta.docsDatabase).toBe(true);
		expect(router.currentRoute.value.params.lang).toBe('en-US');
	});

	it('keeps renderer demos on a query-driven catalog route', async () => {
		const router = createDocsRouter({
			locales: { 'zh-CN': { label: '简体中文' }, 'en-US': { label: 'English' } },
			routes: { '/renderer-editor': { content: './owned.md' } },
			runtime: { mode: 'development' }
		});
		await router.push('/zh-CN/__docs/renderer-editor');
		expect(router.currentRoute.value.meta.docsEditor).toBe(true);
		await router.push('/renderer-editor-demos?name=combo');
		expect(router.currentRoute.value.fullPath).toBe('/zh-CN/renderer-editor-demos?name=combo');
		await router.push('/zh-CN/renderer-editor-demos?name=landing');
		expect(router.currentRoute.value.meta.docsEditorDemos).toBe(true);
		expect(router.currentRoute.value.query.name).toBe('landing');
		await router.push('/en-US/__docs/renderer-editor-demos?name=selection');
		expect(router.currentRoute.value.fullPath).toBe('/en-US/__docs/renderer-editor-demos?name=selection');
	});

	it('keeps an explicitly configured /renderer-editor-demos document route available', async () => {
		const demosRoute = { content: null };
		const router = createDocsRouter({
			locales: { 'zh-CN': { label: '简体中文' } },
			routes: { '/renderer-editor-demos': demosRoute },
			runtime: { mode: 'development' }
		});
		await router.push('/zh-CN/renderer-editor-demos');
		expect(router.currentRoute.value.meta.docsRoute).toBe(demosRoute);
		await router.push('/zh-CN/__docs/renderer-editor-demos?name=promo');
		expect(router.currentRoute.value.meta.docsEditorDemos).toBe(true);
		expect(router.currentRoute.value.query.name).toBe('promo');
	});

	it('does not inject renderer demos outside development', async () => {
		const router = createDocsRouter({
			locales: { 'zh-CN': { label: '简体中文' } },
			routes: {}
		});
		await router.push('/zh-CN/renderer-editor-demos?name=landing');
		expect(router.currentRoute.value.meta.docsEditorDemos).toBeUndefined();
		expect(router.currentRoute.value.path).toBe('/zh-CN');
		await router.push('/zh-CN/__docs/renderer-editor-demos?name=promo');
		expect(router.currentRoute.value.meta.docsEditorDemos).toBeUndefined();
		expect(router.currentRoute.value.path).toBe('/zh-CN');
	});

	it('normalizes route keys and invalid languages without a configured root', async () => {
		const minimal: DocsConfig = {
			locales: { en: { label: 'English' } },
			routes: {
				'guide': '/en/target',
				'/target': { content: 'default' }
			}
		};
		const router = createDocsRouter(minimal);
		await router.push('/');
		expect(router.currentRoute.value.path).toBe('/en');
		expect(router.currentRoute.value.meta.docsHome).toBe(true);
		expect(router.currentRoute.value.meta.docsRoute).toMatchObject({
			content: null,
			sidebar: null,
			header: 'default',
			footer: 'default'
		});
		await router.push('/fr/guide?tab=api#title');
		expect(router.currentRoute.value.fullPath).toBe('/en/target?tab=api#title');
		await router.push('/guide');
		expect(router.currentRoute.value.path).toBe('/en/target');
		expect(getRouteValue(createRouteShape('/'), {})).toBe('index');

		const noLocales = createDocsRouter({ locales: {}, routes: {} });
		await noLocales.push('/');
		expect(noLocales.currentRoute.value.path).toBe('/zh-CN');
		expect(localizePath({ locales: {}, routes: {} }, 'zh-CN', '/zh-CN?tab=api'))
			.toBe('/zh-CN?tab=api');
	});

	it('lets any explicit root configuration override the built-in home', async () => {
		const roots: DocsConfig['routes'][] = [
			{ '/': { content: null } },
			{ '/': '/guide', '/guide': { content: null } },
			{ '/': () => '/guide', '/guide': { content: null } }
		];
		for (const routes of roots) {
			const router = createDocsRouter({
				locales: { 'en-US': { label: 'English' } },
				routes
			});
			await router.push('/');
			expect(router.currentRoute.value.meta.docsHome).toBeUndefined();
		}
	});

	it('distinguishes a missing language slug from an invalid localized route', async () => {
		const dynamic: DocsConfig = {
			locales: { 'zh-CN': { label: '简体中文' }, 'en-US': { label: 'English' } },
			routes: {
				'/': '/index',
				'/index': { content: 'default' },
				'/:name': { content: 'default' },
				'*': '/index'
			}
		};
		const router = createDocsRouter(dynamic);
		await router.push('/installation?tab=api#title');
		expect(router.currentRoute.value.fullPath)
			.toBe('/zh-CN/installation?tab=api#title');
		await router.push('/fr/installation?tab=api#title');
		expect(router.currentRoute.value.fullPath)
			.toBe('/zh-CN/installation?tab=api#title');
	});

	it('keeps the page subpath independent from the resource base', () => {
		const previous = location.pathname;
		window.history.replaceState({}, '', '/docs/site/zh-CN/index');
		try {
			const external = createDocsRouter({
				...config,
				base: 'https://cdn.example.com/docs/'
			});
			expect(external.resolve('/zh-CN/index').href)
				.toBe('/docs/site/zh-CN/index');

			const sameOriginResources = createDocsRouter({
				...config,
				base: `${location.origin}/assets/docs/`
			});
			expect(sameOriginResources.resolve('/zh-CN/index').href)
				.toBe('/docs/site/zh-CN/index');
		} finally {
			window.history.replaceState({}, '', previous || '/');
		}
	});

	it('recognizes configured language keys even when their labels are empty', async () => {
		const router = createDocsRouter({
			locales: { en: { label: '' } },
			routes: { '/': { content: null } }
		});
		await router.push('/en');
		expect(router.currentRoute.value.path).toBe('/en');
		expect(localizePath({ locales: { en: { label: '' } }, routes: {} }, 'en', '/en/guide'))
			.toBe('/en/guide');
	});
});
