// @vitest-environment jsdom

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp, defineComponent } from 'vue';
import { flushPromises } from '@vue/test-utils';
import { defineRendererModule } from '@deot/docs-renderer';
import { createDocsConfig, createDocsRuntime } from './fixtures/docs';

const {
	use,
	provide,
	mount,
	disconnectEvents,
	router,
	startIdlePrefetch,
	stopPrefetch,
	startPlaygroundResource,
	restoreLanguage,
	persistLanguage,
	stopTheme,
	stopContentWidth,
	stopLanguagePersistence
} = vi.hoisted(() => ({
	use: vi.fn(),
	provide: vi.fn(),
	mount: vi.fn(),
	disconnectEvents: vi.fn(),
	startIdlePrefetch: vi.fn(),
	stopPrefetch: vi.fn(),
	startPlaygroundResource: vi.fn(async () => () => {}),
	restoreLanguage: vi.fn(async () => undefined),
	persistLanguage: vi.fn(async () => undefined),
	stopTheme: vi.fn(),
	stopContentWidth: vi.fn(),
	stopLanguagePersistence: vi.fn(),
	router: {
		name: 'router',
		currentRoute: { value: { params: { lang: 'zh-CN' }, meta: {} as Record<string, unknown> } },
		isReady: vi.fn(async () => undefined),
		afterEach: vi.fn<(listener: (to: any) => void) => () => void>(() => stopLanguagePersistence),
		push: vi.fn(async () => undefined)
	}
}));
vi.mock('vue', async original => ({
	...await original<typeof import('vue')>(),
	createApp: vi.fn(() => ({ use, provide, mount }))
}));
vi.mock('../src/app.vue', () => ({ default: { name: 'DocsApp' } }));
vi.mock('../src/router', () => ({ createDocsRouter: vi.fn(() => router) }));
vi.mock('../src/events', () => ({ connectResourceEvents: vi.fn(() => disconnectEvents) }));
vi.mock('../src/modules/resource', () => ({
	Resource: {
		prefetch: {
			start: vi.fn((config) => {
				startIdlePrefetch(config);
				return stopPrefetch;
			})
		},
		playground: {
			start: startPlaygroundResource
		}
	}
}));
vi.mock('../src/modules/settings', () => ({
	Settings: {
		language: {
			restore: restoreLanguage,
			persist: persistLanguage
		}
	},
	ThemeRuntime: { start: vi.fn(() => stopTheme) },
	ContentWidthRuntime: { start: vi.fn(() => stopContentWidth) }
}));

describe('client entry', () => {
	it('does not import markdown / playground / renderer styles from workspace', () => {
		const dir = path.dirname(fileURLToPath(import.meta.url));
		const entry = fs.readFileSync(path.resolve(dir, '../src/index.ts'), 'utf8');
		expect(entry).not.toContain('markdown/src/style.scss');
		expect(entry).not.toContain('playground/src/bundle.scss');
		expect(entry).not.toContain('renderer/src/styles/style.scss');
	});

	it('does not auto-bootstrap again when a CDN chunk reevaluates the entry', async () => {
		document.body.innerHTML = '<div id="app" data-v-app></div>';
		vi.resetModules();
		try {
			await import('../src');
			expect(createApp).not.toHaveBeenCalled();
			expect(startPlaygroundResource).not.toHaveBeenCalled();
		} finally {
			vi.resetModules();
		}
	});

	it('normalizes runtime and mounts the configured application', async () => {
		document.body.innerHTML = '<div id="app"></div>';
		sessionStorage.removeItem('@deot/docs:redirect');
		window.$docs = createDocsConfig({ locales: { 'zh-CN': { label: '简体中文' } } });
		window.__DOCS_RUNTIME__ = createDocsRuntime({ workspace: '/site/' });
		const client = await import('../src');
		await vi.waitFor(() => expect(createApp).toHaveBeenCalled());
		expect(window.$docs.runtime).toEqual({ mode: 'development', workspace: '/site/' });
		expect(createApp).toHaveBeenCalledOnce();
		expect(use).toHaveBeenCalledWith(router);
		expect(mount).toHaveBeenCalledWith('#app');
		expect(document.documentElement.lang).toBe('zh-CN');
		expect(provide.mock.calls.find(call => call[1]?.value?.name === 'zh-CN')).toBeDefined();
		expect(client.bootstrap).toBeTypeOf('function');
		expect(client.Network).toBeDefined();
		expect(client.Gateway).toBeInstanceOf(client.ResourceGateway);
		expect(client).not.toHaveProperty('ResourcePlan');
		expect(client).not.toHaveProperty('IdlePrefetch');
		expect(client).not.toHaveProperty('Resource');
		expect(startPlaygroundResource).toHaveBeenCalled();

		const explicit = createDocsConfig({ locales: { en: { label: 'English' } } });
		router.currentRoute.value.params.lang = 'en';
		const instance = await client.bootstrap(explicit);
		expect(window.$docs).toBe(explicit);
		expect(explicit.runtime).toEqual({ mode: 'development', workspace: '/site/' });
		await vi.waitFor(() => expect(startIdlePrefetch).toHaveBeenCalledWith(explicit));
		expect(document.documentElement.lang).toBe('en-US');
		expect(router.push).not.toHaveBeenCalled();
		instance.disconnect();
		instance.disconnect();
		expect(disconnectEvents).toHaveBeenCalled();
		expect(stopLanguagePersistence).toHaveBeenCalledTimes(2);
		expect(stopPrefetch).toHaveBeenCalled();
	});

	it.each(['docsPreview', 'docsPreviewConfigGenerate'])('pauses site prefetch on %s and resumes on document routes', async (flag) => {
		const client = await import('../src');
		startIdlePrefetch.mockClear();
		stopPrefetch.mockClear();
		router.afterEach.mockClear();
		router.currentRoute.value.meta = { [flag]: true };
		const explicit = createDocsConfig();
		const instance = await client.bootstrap(explicit);
		try {
			await flushPromises();
			expect(startIdlePrefetch).not.toHaveBeenCalled();
			const navigate = (meta: Record<string, unknown>) => {
				router.currentRoute.value.meta = meta;
				router.afterEach.mock.calls.forEach(([listener]) => listener(router.currentRoute.value));
			};
			navigate({});
			navigate({});
			expect(startIdlePrefetch).toHaveBeenCalledExactlyOnceWith(explicit);
			navigate({ [flag]: true });
			expect(stopPrefetch).toHaveBeenCalledOnce();
			navigate({});
			expect(startIdlePrefetch).toHaveBeenCalledTimes(2);
		} finally {
			instance.disconnect();
			router.currentRoute.value.meta = {};
		}
		expect(stopPrefetch).toHaveBeenCalledTimes(2);
	});

	it('skips site prefetch after restoring a preview deep link', async () => {
		const previous = `${location.pathname}${location.search}${location.hash}`;
		window.history.replaceState({}, '', '/docs/');
		sessionStorage.setItem('@deot/docs:redirect', '/docs/__docs/preview?url=demo.vue');
		startIdlePrefetch.mockClear();
		router.afterEach.mockClear();
		router.push.mockImplementationOnce(async () => {
			router.currentRoute.value.meta = { docsPreview: true };
		});
		const client = await import('../src');
		const instance = await client.bootstrap(createDocsConfig());
		try {
			await flushPromises();
			expect(startIdlePrefetch).not.toHaveBeenCalled();
			expect(sessionStorage.getItem('@deot/docs:redirect')).toBeNull();
		} finally {
			instance.disconnect();
			router.currentRoute.value.meta = {};
			sessionStorage.removeItem('@deot/docs:redirect');
			window.history.replaceState({}, '', previous || '/');
		}
	});

	it('consumes the @deot/docs:redirect session convention', async () => {
		const previous = `${location.pathname}${location.search}${location.hash}`;
		window.history.replaceState({}, '', '/docs/');
		sessionStorage.setItem('@deot/docs:redirect', '/docs/zh-CN/guide?tab=api#install');
		router.push.mockClear();
		try {
			const client = await import('../src');
			const explicit = createDocsConfig({ locales: { 'zh-CN': { label: '简体中文' } } });
			const instance = await client.bootstrap(explicit);
			await vi.waitFor(() => expect(router.push).toHaveBeenCalledWith('/zh-CN/guide?tab=api#install'));
			expect(sessionStorage.getItem('@deot/docs:redirect')).toBeNull();
			instance.disconnect();
		} finally {
			sessionStorage.removeItem('@deot/docs:redirect');
			window.history.replaceState({}, '', previous || '/');
		}
	});

	it('ignores stored redirects that are not inside the deployment directory', async () => {
		const previous = `${location.pathname}${location.search}${location.hash}`;
		window.history.replaceState({}, '', '/docs/');
		router.push.mockClear();
		try {
			const client = await import('../src');
			const explicit = createDocsConfig({ locales: { 'zh-CN': { label: '简体中文' } } });
			sessionStorage.setItem('@deot/docs:redirect', '//evil.example/docs/hijack');
			let instance = await client.bootstrap(explicit);
			await vi.waitFor(() => expect(startIdlePrefetch).toHaveBeenCalledWith(explicit));
			expect(router.push).not.toHaveBeenCalled();
			expect(sessionStorage.getItem('@deot/docs:redirect')).toBeNull();
			instance.disconnect();

			sessionStorage.setItem('@deot/docs:redirect', '/other/zh-CN/guide');
			instance = await client.bootstrap(explicit);
			await vi.waitFor(() => expect(sessionStorage.getItem('@deot/docs:redirect')).toBeNull());
			expect(router.push).not.toHaveBeenCalled();
			instance.disconnect();
		} finally {
			sessionStorage.removeItem('@deot/docs:redirect');
			window.history.replaceState({}, '', previous || '/');
		}
	});

	it('provides business renderer modules without a global registry', async () => {
		const client = await import('../src');
		const component = defineComponent(() => () => null);
		const explicit = createDocsConfig({
			locales: { 'en-US': { label: 'English' } },
			renderers: [defineRendererModule({
				identity: { type: 'company:banner', version: 1, label: 'Banner', category: 'Company' },
				widget: { visible: true },
				data: { create: () => ({}) },
				viewer: component,
				editor: component,
				frames: { sortable: {} }
			})]
		});
		await client.bootstrap(explicit);
		const rendererProvision = provide.mock.calls.find(call => (
			Array.isArray(call[1]) && call[1].some((item: { identity?: { type?: string } }) => item.identity?.type === 'company:banner')
		));
		expect(rendererProvision).toBeDefined();
		await Promise.resolve();
	});
});
