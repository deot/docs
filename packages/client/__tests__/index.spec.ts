// @vitest-environment jsdom

import { createApp } from 'vue';

const { use, mount } = vi.hoisted(() => ({ use: vi.fn(), mount: vi.fn() }));
vi.mock('vue', async original => ({
	...await original<any>(),
	createApp: vi.fn(() => ({ use, mount }))
}));
vi.mock('../src/router', () => ({ router: { name: 'router' } }));

describe('client entry', () => {
	it('creates and mounts the routed application', async () => {
		document.body.innerHTML = '<div id="app"></div>';
		await import('../src');
		expect(createApp).toHaveBeenCalledOnce();
		expect(use).toHaveBeenCalledWith({ name: 'router' });
		expect(mount).toHaveBeenCalledWith('#app');

		const render = vi.mocked(createApp).mock.calls[0][0] as () => any[];
		const views = render();
		expect(views).toHaveLength(5);
		expect(views.map(view => view.props?.name)).toEqual(['header', 'sidebar', undefined, 'footer', 'extra']);
	});
});
