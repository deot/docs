// @vitest-environment jsdom

import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { defineComponent, reactive, ref } from 'vue';
import type { PropType } from 'vue';
import { provideLocale, resolveLocale } from '@deot/docs-locale';
import App from '../src/app.vue';
import DefaultFooter from '../src/components/layout/default-footer.vue';
import DefaultHeader from '../src/components/layout/default-header.vue';
import DefaultSidebar from '../src/components/layout/default-sidebar.vue';
import ClientIcon from '../src/components/icon';
import ThemeToggler from '../src/components/theme-toggler/index.vue';
import { Theme } from '../src/modules/settings';

const { push, route: routeState, setScrollTop } = vi.hoisted(() => ({
	push: vi.fn(),
	route: {
		fullPath: '/zh-CN/components/button?tab=api#props',
		path: '/zh-CN/components/button',
		query: { tab: 'api' } as Record<string, string>,
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
	...await original<typeof import('vue-router')>(),
	useRoute: () => route,
	useRouter: () => ({ push }),
	RouterLink: (await import('vue')).defineComponent({
		props: { to: { type: [String, Object] as PropType<string | { path?: string }>, required: true } },
		setup: (props, { slots }) => () => (
			<a href={typeof props.to === 'string' ? props.to : props.to.path}>
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

const mountFooter = (language = 'en-US') => {
	const current = ref(resolveLocale(language, window.$docs.locales));
	const Host = defineComponent({
		setup() {
			provideLocale(current);
			return () => <DefaultFooter />;
		}
	});
	return { current, wrapper: mount(Host) };
};

describe('client layout components', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		route.path = '/zh-CN/components/button';
		route.fullPath = '/zh-CN/components/button?tab=api#props';
		route.query = { tab: 'api' };
		route.hash = '#props';
		route.meta = {};
		window.$docs = {
			locales: { 'zh-CN': { label: '简体中文' }, 'en-US': { label: 'English' } },
			repository: 'https://github.com/acme/widgets/',
			routes: {}
		};
		sessionStorage.clear();
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
		expect(wrapper.find('.docs-layout--home').exists()).toBe(false);
	});

	it('drops main padding on the built-in home page', async () => {
		route.meta = { docsHome: true };
		const wrapper = mount(() => (<App />));
		expect(wrapper.find('.docs-layout').classes()).toContain('docs-layout--home');
	});

	it('uses the editor shell for the renderer editor and named demos only', () => {
		route.meta = { docsEditor: true };
		expect(mount(() => (<App />)).find('.docs-app--editor').exists()).toBe(true);

		route.meta = { docsEditorDemos: true };
		route.query = {};
		expect(mount(() => (<App />)).find('.docs-app--editor').exists()).toBe(false);

		route.query = { name: 'landing' };
		const named = mount(() => (<App />));
		expect(named.find('.docs-app--editor').exists()).toBe(true);
		expect(named.find('.docs-layout--editor').exists()).toBe(true);

		route.query = { name: 'missing' };
		expect(mount(() => (<App />)).find('.docs-app--editor').exists()).toBe(false);
	});

	it('keeps the active path when switching locale from the dropdown', async () => {
		const wrapper = mount(() => (<DefaultHeader />));
		expect(wrapper.findAll('a').map(link => link.attributes('href'))).toEqual([
			'/zh-CN',
			'/zh-CN/__docs/playground-resource',
			'/zh-CN/__docs/database'
		]);
		expect(wrapper.find('.docs-header__database').attributes('aria-label'))
			.toBe('Open resource database');
		expect(wrapper.find('.docs-header__playground-resource').attributes('aria-label'))
			.toBe('Manage Playground resources');
		expect(wrapper.find('[data-icon="database"]').exists()).toBe(true);
		expect(wrapper.find('[data-icon="playgroundResource"]').exists()).toBe(true);
		expect(wrapper.find('[data-icon="language"]').exists()).toBe(true);
		expect(wrapper.find('.docs-header__actions').element.lastElementChild?.classList)
			.toContain('docs-header__database');
		expect(wrapper.find('.docs-header__locale-trigger').attributes('aria-label'))
			.toBe('Switch language');
		const items = wrapper.findAllComponents({ name: 'DropdownItem' });
		expect(items.map(item => item.text())).toEqual(['简体中文', 'English']);
		expect(items[0].classes()).toContain('is-selected');
		await items[1].trigger('click');
		expect(push).toHaveBeenCalledWith({
			path: '/en-US/components/button',
			query: { tab: 'api' },
			hash: '#props'
		});
		expect(wrapper.text()).toContain('@deot/docs');
	});

	it('hides the language dropdown when only one locale is configured', () => {
		window.$docs = {
			locales: { 'en-US': { label: 'English' } },
			routes: {}
		};
		expect(mount(() => (<DefaultHeader />)).find('.docs-header__locales').exists()).toBe(false);
	});

	it('opens the resource database on the internal __docs route', () => {
		const wrapper = mount(() => <DefaultHeader />);
		expect(wrapper.find('.docs-header__database').attributes('href'))
			.toBe('/zh-CN/__docs/database');
		expect(wrapper.find('.docs-header__playground-resource').attributes('href'))
			.toBe('/zh-CN/__docs/playground-resource');
	});

	it('uses the utility shell for playground import map pages', () => {
		route.meta = { docsPlaygroundResource: true };
		const wrapper = mount(() => (<App />));
		expect(wrapper.find('.docs-app--database').exists()).toBe(true);
		expect(wrapper.find('.docs-layout--database').exists()).toBe(true);
	});

	it('opens the Renderer editor with the active content source', async () => {
		const markdown = vi.fn(async () => './guides/button.md');
		window.$docs.resolve = { markdown };
		route.meta = {
			docsRoute: { content: 'default', value: 'components/button' }
		};
		const wrapper = mount(() => <DefaultHeader />);
		await wrapper.find('.docs-header__editor').trigger('click');
		await flushPromises();
		expect(markdown).toHaveBeenCalled();
		expect(push).toHaveBeenLastCalledWith({
			path: '/zh-CN/__docs/renderer-editor',
			query: {
				from: '/zh-CN/components/button?tab=api#props',
				type: 'markdown',
				source: './guides/button.md'
			}
		});
	});

	it('opens configured home pages and SFC routes with their concrete editor types', async () => {
		window.$docs.home = { locales: { 'zh-CN': './pages/home.page.json' } };
		route.meta = { docsHome: true };
		const home = mount(() => <DefaultHeader />);
		await home.find('.docs-header__editor').trigger('click');
		await flushPromises();
		expect(push).toHaveBeenLastCalledWith(expect.objectContaining({
			query: expect.objectContaining({ type: 'page', source: './pages/home.page.json' })
		}));

		route.meta = { docsRoute: { content: './demo.vue' } };
		const sfc = mount(() => <DefaultHeader />);
		await sfc.find('.docs-header__editor').trigger('click');
		await flushPromises();
		expect(push).toHaveBeenLastCalledWith(expect.objectContaining({
			query: expect.objectContaining({ type: 'sfc', source: './demo.vue' })
		}));
	});

	it('opens an inline Renderer document from the current route content', async () => {
		route.meta = {
			docsRoute: {
				content: {
					schemaVersion: 2,
					meta: { id: 'campaign', title: 'Campaign' },
					layout: { mode: 'sortable', maxWidth: 1180, minHeight: 600, background: '#fff' },
					blocks: []
				}
			}
		};
		const wrapper = mount(() => <DefaultHeader />);
		await wrapper.find('.docs-header__editor').trigger('click');
		await flushPromises();
		expect(JSON.parse(sessionStorage.getItem('docs-renderer-inline-document') || '{}')).toMatchObject({
			from: '/zh-CN/components/button?tab=api#props',
			document: { meta: { title: 'Campaign' } }
		});
		expect(push).toHaveBeenLastCalledWith({
			path: '/zh-CN/__docs/renderer-editor',
			query: {
				from: '/zh-CN/components/button?tab=api#props',
				type: 'inline'
			}
		});
	});

	it('uses locale overrides for built-in header text', () => {
		const Host = defineComponent({
			setup() {
				provideLocale(resolveLocale('zh-CN', {
					'zh-CN': {
						label: '简体中文',
						client: { header: { brand: '@deot/docs 文档' } }
					}
				}));
				return () => <DefaultHeader />;
			}
		});

		expect(mount(Host).find('.docs-header__brand').text()).toBe('@deot/docs 文档');
	});

	it('uses the complete theme toggler as the transition origin', async () => {
		const toggle = vi.spyOn(Theme, 'toggle').mockResolvedValue();
		const wrapper = mount(() => <ThemeToggler />);
		await wrapper.find('.vc-switch').trigger('click', { clientX: 120, clientY: 30 });
		expect(toggle).toHaveBeenCalledWith(wrapper.find('.theme-toggler').element);
		toggle.mockRestore();
	});

	it('renders filled and outlined client icons through one component', () => {
		const language = mount(() => <ClientIcon name="language" />);
		const database = mount(() => <ClientIcon name="database" />);
		expect(language.find('svg').attributes()).toMatchObject({
			'data-icon': 'language',
			'fill': 'currentColor',
			'stroke': 'none'
		});
		expect(database.find('svg').attributes()).toMatchObject({
			'data-icon': 'database',
			'fill': 'none',
			'stroke': 'currentColor'
		});
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

	it('renders the built-in footer groups and localized provider', () => {
		const { wrapper } = mountFooter();
		expect(wrapper.findAll('.docs-footer__group')).toHaveLength(4);
		expect(wrapper.text()).toContain('Resources');
		expect(wrapper.text()).toContain('@deot/vc | Vue component library');
		expect(wrapper.text()).toContain('Powered by @deot/docs');
		expect(wrapper.findAll('a').map(link => link.attributes('href'))).toContain(
			'https://github.com/acme/widgets/releases'
		);
		const external = wrapper.find('a[href="https://deot.github.io/vc/"]');
		expect(external.attributes()).toMatchObject({
			target: '_blank',
			rel: 'noopener noreferrer'
		});
	});

	it('localizes the default footer and reacts to language changes', async () => {
		const { current, wrapper } = mountFooter('zh-CN');
		expect(wrapper.text()).toContain('资源');
		expect(wrapper.text()).toContain('反馈问题');

		current.value = resolveLocale('en-US', window.$docs.locales);
		await flushPromises();
		expect(wrapper.text()).toContain('Resources');
		expect(wrapper.text()).toContain('Report an issue');
		expect(wrapper.text()).not.toContain('反馈问题');
	});

	it('uses site locale overrides for default footer labels', () => {
		window.$docs.locales['en-US'] = {
			label: 'English',
			client: { footer: { resources: 'Dependencies' } }
		};
		const { wrapper } = mountFooter();
		expect(wrapper.text()).toContain('Dependencies');
		expect(wrapper.text()).not.toContain('Resources');
	});

	it('omits feedback when the repository is missing or invalid', () => {
		delete window.$docs.repository;
		const missing = mountFooter('zh-CN').wrapper;
		expect(missing.findAll('.docs-footer__group')).toHaveLength(3);
		expect(missing.text()).not.toContain('反馈');

		window.$docs.repository = 'https://gitlab.com/acme/widgets';
		const invalid = mountFooter('zh-CN').wrapper;
		expect(invalid.findAll('.docs-footer__group')).toHaveLength(3);
		expect(invalid.text()).not.toContain('反馈');
	});

	it('uses external footer groups without merging defaults', () => {
		window.$docs.layout = {
			footer: {
				groups: [{
					label: 'Links',
					children: [
						{ label: 'Guide', value: '/guide' },
						{ label: 'Community', value: 'https://example.com' }
					]
				}],
				poweredBy: 'Built by Docs Team'
			}
		};
		const { wrapper } = mountFooter();
		expect(wrapper.findAll('.docs-footer__group')).toHaveLength(1);
		expect(wrapper.text()).toContain('Built by Docs Team');
		expect(wrapper.text()).not.toContain('@deot/vc');
		expect(wrapper.findAll('a').map(link => link.attributes('href'))).toEqual([
			'/zh-CN/guide',
			'https://example.com'
		]);
	});

	it('selects localized external groups and falls back to the default language', () => {
		window.$docs.layout = {
			footer: {
				groups: {
					'zh_CN': [{ label: '中文链接', children: [] }],
					'en-US': [{ label: 'English links', children: [] }]
				},
				poweredBy: { 'zh-CN': '中文团队', 'en_US': 'English team' }
			}
		};
		const english = mountFooter().wrapper;
		expect(english.text()).toContain('English links');
		expect(english.text()).toContain('English team');

		window.$docs.layout = {
			footer: { groups: { 'zh-CN': [{ label: '默认语言链接' }] } }
		};
		const fallback = mountFooter().wrapper;
		expect(fallback.text()).toContain('默认语言链接');
	});

	it('keeps unmatched localized external footer values empty', () => {
		window.$docs.layout = {
			footer: {
				groups: { 'de-DE': [{ label: 'Deutsch' }] },
				poweredBy: { 'de-DE': 'Deutsches Team' }
			}
		};
		const { wrapper } = mountFooter();
		expect(wrapper.text()).toBe('');
	});

	it('supports default, omitted and hidden footer provider states', () => {
		window.$docs.layout = { footer: { groups: [], poweredBy: 'default' } };
		expect(mountFooter().wrapper.text()).toBe('Powered by @deot/docs');

		window.$docs.layout = { footer: { groups: [] } };
		expect(mountFooter().wrapper.text()).toBe('');

		window.$docs.layout = { footer: { groups: [], poweredBy: false } };
		expect(mountFooter().wrapper.text()).toBe('');
	});

	it('hides the built-in footer through the site layout configuration', () => {
		window.$docs.layout = { footer: false };
		expect(mountFooter().wrapper.find('.docs-footer').exists()).toBe(false);
	});
});
