// @vitest-environment jsdom

import { createApp, defineComponent } from 'vue';
import { defineRendererModule } from '@deot/docs-renderer';
import { createDocsConfig, createDocsRuntime } from './fixtures/docs';

const { use, provide, mount, disconnectEvents, router, startIdlePrefetch, stopPrefetch, startPlaygroundResource } = vi.hoisted(() => ({
	use: vi.fn(),
	provide: vi.fn(),
	mount: vi.fn(),
	disconnectEvents: vi.fn(),
	startIdlePrefetch: vi.fn(),
	stopPrefetch: vi.fn(),
	startPlaygroundResource: vi.fn(async () => () => {}),
	router: {
		name: 'router',
		currentRoute: { value: { params: { lang: 'zh-CN' } } },
		isReady: vi.fn(async () => undefined)
	}
}));
vi.mock('vue', async original => ({
	...await original<typeof import('vue')>(),
	createApp: vi.fn(() => ({ use, provide, mount }))
}));
vi.mock('../src/app.vue', () => ({ default: { name: 'DocsApp' } }));
vi.mock('../src/router', () => ({ createDocsRouter: vi.fn(() => router) }));
vi.mock('../src/events', () => ({ connectResourceEvents: vi.fn(() => disconnectEvents) }));
vi.mock('../src/modules/idle-prefetch', () => ({
	IdlePrefetch: {
		start: vi.fn((config) => {
			startIdlePrefetch(config);
			return stopPrefetch;
		})
	}
}));
vi.mock('../src/modules/playground-resource', () => ({
	PlaygroundResource: {
		start: startPlaygroundResource
	},
	PlaygroundResourceCache: class {}
}));

describe('client entry', () => {
	it('normalizes runtime and mounts the configured application', async () => {
		document.body.innerHTML = '<div id="app"></div>';
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
		expect(startPlaygroundResource).toHaveBeenCalled();

		const explicit = createDocsConfig({ locales: { en: { label: 'English' } } });
		router.currentRoute.value.params.lang = 'en';
		const instance = await client.bootstrap(explicit);
		await Promise.resolve();
		expect(window.$docs).toBe(explicit);
		expect(explicit.runtime).toEqual({ mode: 'development', workspace: '/site/' });
		expect(startIdlePrefetch).toHaveBeenCalledWith(explicit);
		expect(document.documentElement.lang).toBe('en-US');
		instance.disconnect();
		instance.disconnect();
		expect(disconnectEvents).toHaveBeenCalled();
		expect(stopPrefetch).toHaveBeenCalled();
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
