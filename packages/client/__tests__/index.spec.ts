// @vitest-environment jsdom

import { createApp } from 'vue';
import type { DocsConfig } from '../src/types';

const { use, mount, disconnect, router } = vi.hoisted(() => ({
	use: vi.fn(),
	mount: vi.fn(),
	disconnect: vi.fn(),
	router: { name: 'router' }
}));
vi.mock('vue', async original => ({
	...await original<any>(),
	createApp: vi.fn(() => ({ use, mount }))
}));
vi.mock('../src/app.vue', () => ({ default: { name: 'DocsApp' } }));
vi.mock('../src/router', () => ({ createDocsRouter: vi.fn(() => router) }));
vi.mock('../src/events', () => ({ connectResourceEvents: vi.fn(() => disconnect) }));

describe('client entry', () => {
	it('normalizes runtime and mounts the configured application', async () => {
		document.body.innerHTML = '<div id="app"></div>';
		window.$docs = { locales: { 'zh-CN': '简体中文' }, routes: {} };
		window.__DOCS_RUNTIME__ = { mode: 'development', workspace: '/site/' };
		const client = await import('../src');
		expect(window.$docs.runtime).toEqual({ mode: 'development', workspace: '/site/' });
		expect(createApp).toHaveBeenCalledOnce();
		expect(use).toHaveBeenCalledWith(router);
		expect(mount).toHaveBeenCalledWith('#app');
		expect(client.bootstrap).toBeTypeOf('function');
		expect(client.Network).toBeDefined();
		expect(client.Gateway).toBeInstanceOf(client.ResourceGateway);

		const explicit: DocsConfig = { locales: { en: 'English' }, routes: {} };
		client.bootstrap(explicit);
		expect(window.$docs).toBe(explicit);
		expect(explicit.runtime).toEqual({ mode: 'development', workspace: '/site/' });
	});
});
