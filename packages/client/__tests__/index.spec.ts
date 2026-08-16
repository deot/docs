// @vitest-environment jsdom

import { createApp, defineComponent } from 'vue';
import { defineRendererModule } from '@deot/docs-renderer';
import type { DocsConfig } from '../src/types';

const { use, provide, mount, disconnectEvents, router, startIdlePrefetch, stopPrefetch } = vi.hoisted(() => ({
	use: vi.fn(),
	provide: vi.fn(),
	mount: vi.fn(),
	disconnectEvents: vi.fn(),
	startIdlePrefetch: vi.fn(),
	stopPrefetch: vi.fn(),
	router: {
		name: 'router',
		currentRoute: { value: { params: { lang: 'zh-CN' } } },
		isReady: vi.fn(async () => undefined)
	}
}));
vi.mock('vue', async original => ({
	...await original<any>(),
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

describe('client entry', () => {
	it('normalizes runtime and mounts the configured application', async () => {
		document.body.innerHTML = '<div id="app"></div>';
		window.$docs = { locales: { 'zh-CN': { label: '简体中文' } }, routes: {} };
		window.__DOCS_RUNTIME__ = { mode: 'development', workspace: '/site/' };
		const client = await import('../src');
		await Promise.resolve();
		expect(window.$docs.runtime).toEqual({ mode: 'development', workspace: '/site/' });
		expect(createApp).toHaveBeenCalledOnce();
		expect(use).toHaveBeenCalledWith(router);
		expect(mount).toHaveBeenCalledWith('#app');
		expect(document.documentElement.lang).toBe('zh-CN');
		expect(provide.mock.calls.find(call => call[1]?.value?.name === 'zh-CN')).toBeDefined();
		expect(client.bootstrap).toBeTypeOf('function');
		expect(client.Network).toBeDefined();
		expect(client.Gateway).toBeInstanceOf(client.ResourceGateway);

		const explicit: DocsConfig = { locales: { en: { label: 'English' } }, routes: {} };
		router.currentRoute.value.params.lang = 'en';
		const instance = client.bootstrap(explicit);
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
		const explicit: DocsConfig = {
			locales: { 'en-US': { label: 'English' } },
			routes: {},
			renderers: [defineRendererModule({
				identity: { type: 'company:banner', version: 1, label: 'Banner', category: 'Company' },
				widget: { visible: true },
				data: { create: () => ({}) },
				viewer: component,
				editor: component,
				frames: { sortable: {} }
			})]
		};
		const instance = client.bootstrap(explicit);
		const rendererProvision = provide.mock.calls.find(call => (
			Array.isArray(call[1]) && call[1].some((item: { identity?: { type?: string } }) => item.identity?.type === 'company:banner')
		));
		expect(rendererProvision).toBeDefined();
		await Promise.resolve();
		instance.disconnect();
	});
});
