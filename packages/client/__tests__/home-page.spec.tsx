// @vitest-environment jsdom

import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, reactive } from 'vue';
import { provideLocale, resolveLocale } from '@deot/docs-locale';
import HomePage from '../src/pages/home/index.vue';
import { ResourcePlan } from '../src/modules/resource-plan';

const route = reactive({ params: { lang: 'zh-CN' } });

vi.mock('vue-router', async original => ({
	...await original<any>(),
	useRoute: () => route,
	RouterLink: (await import('vue')).defineComponent({
		props: { to: { type: String, required: true } },
		setup: (props, { slots }) => () => <a href={props.to}>{slots.default?.()}</a>
	})
}));

describe('built-in home page', () => {
	beforeEach(() => {
		route.params.lang = 'zh-CN';
		window.$docs = {
			locales: { 'zh-CN': { label: '简体中文' }, 'en-US': { label: 'English' } },
			routes: {}
		};
	});
	afterEach(() => vi.restoreAllMocks());

	it('renders localized copy and links to the resolved business entry', async () => {
		vi.spyOn(ResourcePlan, 'resolveHomeEntry')
			.mockResolvedValue('/zh-CN/components/button');
		const Host = defineComponent({
			setup() {
				provideLocale(resolveLocale('zh-CN', {
					'zh-CN': { label: '简体中文' }
				}));
				return () => <HomePage />;
			}
		});
		const wrapper = mount(Host);
		await flushPromises();

		expect(wrapper.find('.docs-home__title').text())
			.toBe('你好 @deot/docs - 开始使用');
		expect(wrapper.find('.docs-home__entry').attributes('href'))
			.toBe('/zh-CN/components/button');
	});

	it('keeps a static title when no route can be instantiated', async () => {
		route.params.lang = 'en-US';
		vi.spyOn(ResourcePlan, 'resolveHomeEntry').mockResolvedValue(null);
		const wrapper = mount(HomePage);
		await flushPromises();

		expect(wrapper.find('.docs-home__title').text())
			.toBe('Hello @deot/docs - Quick Start');
		expect(wrapper.find('.docs-home__entry').exists()).toBe(false);
	});
});
