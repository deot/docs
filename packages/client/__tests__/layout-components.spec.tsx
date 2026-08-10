// @vitest-environment jsdom

import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { reactive } from 'vue';
import App from '../src/app.vue';
import DefaultFooter from '../src/components/layout/default-footer.vue';
import DefaultHeader from '../src/components/layout/default-header.vue';
import DefaultSidebar from '../src/components/layout/default-sidebar.vue';

const { route: routeState, setScrollTop } = vi.hoisted(() => ({
	route: {
		path: '/zh-CN/components/button',
		query: { tab: 'api' },
		hash: '#props',
		params: { lang: 'zh-CN' },
		meta: {}
	},
	setScrollTop: vi.fn()
}));
const route = reactive(routeState);
enableAutoUnmount(afterEach);

vi.mock('../src/components/layout', async () => ({
	ResourceSlot: (await import('vue')).defineComponent({
		props: { name: String },
		setup: props => () => <div data-fixed-slot={props.name} />
	})
}));

vi.mock('vue-router', async original => ({
	...await original<any>(),
	useRoute: () => route,
	RouterLink: (await import('vue')).defineComponent({
		props: { to: { type: [String, Object], required: true } },
		setup: (props, { slots }) => () => (
			<a href={typeof props.to === 'string' ? props.to : (props.to as any).path}>
				{slots.default?.()}
			</a>
		)
	}),
	RouterView: (await import('vue')).defineComponent({
		props: { name: String },
		setup: props => () => <div data-view={props.name || 'default'} />
	})
}));

vi.mock('@deot/vc', async () => {
	const { createVcStubs } = await import('./fixtures/vc');
	return createVcStubs({ setScrollTop });
});

describe('client layout components', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		route.path = '/zh-CN/components/button';
		route.query = { tab: 'api' };
		route.hash = '#props';
		window.$docs = {
			locales: { 'zh-CN': '简体中文', 'en-US': 'English' },
			routes: {}
		};
	});

	it('resets the custom document scroller for route content changes', async () => {
		mount(() => (<App />));
		expect(setScrollTop).not.toHaveBeenCalled();

		route.path = '/zh-CN/components/input';
		await flushPromises();
		expect(setScrollTop).toHaveBeenLastCalledWith(0);

		setScrollTop.mockClear();
		route.hash = '#events';
		await flushPromises();
		expect(setScrollTop).not.toHaveBeenCalled();

		route.query = { tab: 'examples' };
		await flushPromises();
		expect(setScrollTop).toHaveBeenLastCalledWith(0);
	});

	it('renders all application slots', () => {
		const wrapper = mount(() => (<App />));
		expect(wrapper.findAll('[data-view]')).toHaveLength(2);
		expect(wrapper.findAll('[data-fixed-slot]')).toHaveLength(3);
		expect(wrapper.findAllComponents({ name: 'Scroller' })).toHaveLength(2);
		expect(wrapper.find('.docs-app__header > [data-fixed-slot="header"]').exists()).toBe(true);
		expect(wrapper.find('.docs-layout__sidebar-scroller [data-fixed-slot="sidebar"]').exists())
			.toBe(true);
		expect(wrapper.find('.docs-layout__main-scroller [data-view="default"]').exists())
			.toBe(true);
		expect(wrapper.find('.docs-layout__main-scroller [data-fixed-slot="footer"]').exists())
			.toBe(true);
		expect(wrapper.find('.docs-layout__main-scroller [data-fixed-slot="header"]').exists())
			.toBe(false);
	});

	it('keeps the active path when switching locale', () => {
		const wrapper = mount(() => (<DefaultHeader />));
		const links = wrapper.findAll('a');
		expect(links.map(link => link.attributes('href'))).toEqual([
			'/zh-CN',
			'/zh-CN/components/button',
			'/en-US/components/button'
		]);
		expect(wrapper.text()).toContain('@deot/docs');
	});

	it('renders recursive sidebar items and preserves external links', () => {
		const wrapper = mount(() => (
			<DefaultSidebar
				items={[
					{ label: 'Group', children: [{ label: 'Guide', value: '/guide' }] },
					{ label: 'External', value: 'https://example.com/docs' },
					{ label: 'Email', value: 'mailto:docs@example.com' }
				]}
			/>
		));
		expect(wrapper.findAll('ul')).toHaveLength(2);
		expect(wrapper.findAll('a').map(link => link.attributes('href'))).toEqual([
			'/zh-CN/guide',
			'https://example.com/docs',
			'mailto:docs@example.com'
		]);
	});

	it('renders the built-in footer', () => {
		expect(mount(() => (<DefaultFooter />)).text()).toBe('Powered by @deot/docs');
	});
});
