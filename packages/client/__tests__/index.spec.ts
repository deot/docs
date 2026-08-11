// @vitest-environment jsdom

import { createApp } from 'vue';
import type { DocsConfig } from '../src/types';

const { use, mount, disconnectEvents, router, startIdlePrefetch, stopPrefetch } = vi.hoisted(() => ({
	use: vi.fn(),
	mount: vi.fn(),
	disconnectEvents: vi.fn(),
	startIdlePrefetch: vi.fn(),
	stopPrefetch: vi.fn(),
	router: { name: 'router', isReady: vi.fn(async () => undefined) }
}));
vi.mock('vue', async original => ({
	...await original<any>(),
	createApp: vi.fn(() => ({ use, mount }))
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
		window.$docs = { locales: { 'zh-CN': '简体中文' }, routes: {} };
		window.__DOCS_RUNTIME__ = { mode: 'development', workspace: '/site/' };
		const client = await import('../src');
		await Promise.resolve();
		expect(window.$docs.runtime).toEqual({ mode: 'development', workspace: '/site/' });
		expect(createApp).toHaveBeenCalledOnce();
		expect(use).toHaveBeenCalledWith(router);
		expect(mount).toHaveBeenCalledWith('#app');
		expect(client.bootstrap).toBeTypeOf('function');
		expect(client.Network).toBeDefined();
		expect(client.Gateway).toBeInstanceOf(client.ResourceGateway);

		const explicit: DocsConfig = { locales: { en: 'English' }, routes: {} };
		const instance = client.bootstrap(explicit);
		await Promise.resolve();
		expect(window.$docs).toBe(explicit);
		expect(explicit.runtime).toEqual({ mode: 'development', workspace: '/site/' });
		expect(startIdlePrefetch).toHaveBeenCalledWith(explicit);
		instance.disconnect();
		expect(disconnectEvents).toHaveBeenCalled();
		expect(stopPrefetch).toHaveBeenCalled();
	});
});
