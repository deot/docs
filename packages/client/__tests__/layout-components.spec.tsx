// @vitest-environment jsdom

import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { defineComponent, provide, reactive, ref } from 'vue';
import type { PropType } from 'vue';
import { provideLocale, resolveLocale } from '@deot/docs-locale';
import App from '../src/app.vue';
import DefaultFooter from '../src/components/layout/default-footer.vue';
import DefaultHeader from '../src/components/layout/default-header.vue';
import DefaultSidebar from '../src/components/layout/default-sidebar.vue';
import ClientIcon from '../src/components/icon';
import ThemeToggler from '../src/components/theme-toggler/index.vue';
import { ContentWidth, Theme } from '../src/modules/settings';
import { setSidebarItems } from '../src/modules/sidebar';
import PageHeader from '../src/components/layout/page-header.vue';
import PageFooter from '../src/components/layout/page-footer.vue';
import PageOutline from '../src/components/layout/page-outline.vue';

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
		route.params.lang = 'zh-CN';
		route.meta = {};
		window.$docs = {
			locales: { 'zh-CN': { label: '简体中文' }, 'en-US': { label: 'English' } },
			repository: 'https://github.com/acme/widgets/',
			routes: {}
		};
		sessionStorage.clear();
		void ContentWidth.set('regular');
		setSidebarItems(null);
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
		expect(wrapper.find('.docs-layout__rail--start').exists()).toBe(true);
		expect(wrapper.find('.docs-layout__rail--end').exists()).toBe(true);
		expect(wrapper.find('.docs-layout--home').exists()).toBe(false);
	});

	it('opens and closes the mobile sidebar without changing utility routes', async () => {
		const wrapper = mount(() => (<App />));
		const toggle = wrapper.find('.docs-app__sidebar-toggle');
		expect(toggle.attributes('aria-expanded')).toBe('false');

		await toggle.trigger('click');
		expect(wrapper.find('.docs-app').classes()).toContain('docs-app--mobile-sidebar-open');
		expect(toggle.attributes('aria-expanded')).toBe('true');

		await wrapper.find('.docs-layout__sidebar-mask').trigger('click');
		expect(wrapper.find('.docs-app').classes()).not.toContain('docs-app--mobile-sidebar-open');

		await toggle.trigger('click');
		route.path = '/zh-CN/components/input';
		await flushPromises();
		expect(wrapper.find('.docs-app').classes()).not.toContain('docs-app--mobile-sidebar-open');
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
			'https://github.com/acme/widgets/'
		]);
		expect(wrapper.find('.docs-header__repository').attributes()).toMatchObject({
			'href': 'https://github.com/acme/widgets/',
			'target': '_blank',
			'rel': 'noopener noreferrer',
			'aria-label': 'Open repository'
		});
		expect(wrapper.find('[data-icon="github"]').exists()).toBe(true);
		expect(wrapper.find('.docs-header__tools-trigger').attributes('aria-label'))
			.toBe('Tools');
		expect(wrapper.findAll('.docs-header__tools-option').map(item => item.text())).toEqual([
			'Customize this page',
			'Manage Playground resources',
			'Open resource database'
		]);
		expect(wrapper.find('[data-icon="more"]').exists()).toBe(true);
		expect(wrapper.find('[data-icon="database"]').exists()).toBe(true);
		expect(wrapper.find('[data-icon="playgroundResource"]').exists()).toBe(true);
		expect(wrapper.find('[data-icon="editor"]').exists()).toBe(true);
		expect(wrapper.find('[data-icon="language"]').exists()).toBe(true);
		expect(wrapper.find('.docs-header__actions').element.lastElementChild?.classList)
			.toContain('docs-header__tools');
		expect(wrapper.find('.docs-header__locale-trigger').attributes('aria-label'))
			.toBe('Switch language');
		const items = wrapper.findAll('.docs-header__locale-option');
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

	it('opens a non-GitHub repository with the generic icon', () => {
		window.$docs.repository = 'https://gitlab.com/acme/widgets';
		const link = mount(() => (<DefaultHeader />)).find('.docs-header__repository');
		expect(link.attributes()).toMatchObject({
			href: 'https://gitlab.com/acme/widgets',
			target: '_blank',
			rel: 'noopener noreferrer'
		});
		expect(link.find('[data-icon="repository"]').exists()).toBe(true);
		expect(link.find('[data-icon="github"]').exists()).toBe(false);
	});

	it('hides the repository action when the address is missing or invalid', () => {
		delete window.$docs.repository;
		expect(mount(() => (<DefaultHeader />)).find('.docs-header__repository').exists()).toBe(false);

		window.$docs.repository = 'javascript:alert(1)';
		expect(mount(() => (<DefaultHeader />)).find('.docs-header__repository').exists()).toBe(false);
	});

	it('opens the resource database on the internal __docs route', async () => {
		const wrapper = mount(() => <DefaultHeader />);
		const tools = wrapper.findAllComponents({ name: 'DropdownItem' })
			.filter(item => item.classes().includes('docs-header__tools-option'));
		await tools[1].trigger('click');
		expect(push).toHaveBeenCalledWith('/zh-CN/__docs/playground-resource');
		await tools[2].trigger('click');
		expect(push).toHaveBeenCalledWith('/zh-CN/__docs/database');
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
		await wrapper.findAllComponents({ name: 'DropdownItem' })
			.find(item => item.props('value') === 'editor')!
			.trigger('click');
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
		window.$docs.routes['/'] = { content: { 'zh-CN': './pages/home.page.json' } };
		route.meta = { docsHome: true };
		const home = mount(() => <DefaultHeader />);
		await home.findAllComponents({ name: 'DropdownItem' })
			.find(item => item.props('value') === 'editor')!
			.trigger('click');
		await flushPromises();
		expect(push).toHaveBeenLastCalledWith(expect.objectContaining({
			query: expect.objectContaining({ type: 'page', source: './pages/home.page.json' })
		}));

		route.meta = { docsRoute: { content: './demo.vue' } };
		const sfc = mount(() => <DefaultHeader />);
		await sfc.findAllComponents({ name: 'DropdownItem' })
			.find(item => item.props('value') === 'editor')!
			.trigger('click');
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
		await wrapper.findAllComponents({ name: 'DropdownItem' })
			.find(item => item.props('value') === 'editor')!
			.trigger('click');
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

	it('falls back to namespace and the built-in brand text', () => {
		window.$docs.namespace = 'docs';
		const namespaceBrand = mount(() => <DefaultHeader />).find('.docs-header__brand');
		expect(namespaceBrand.text()).toBe('docs');
		expect(namespaceBrand.attributes('href')).toBe('/zh-CN');

		delete window.$docs.namespace;
		const defaultBrand = mount(() => <DefaultHeader />).find('.docs-header__brand');
		expect(defaultBrand.text()).toBe('@deot/docs');
	});

	it('localizes configured brand text and internal links', () => {
		window.$docs.layout = {
			header: {
				brand: {
					logo: { 'zh-CN': '/logo-zh.svg', 'en-US': '/logo-en.svg' },
					label: { 'zh-CN': '组件文档', 'en-US': 'Component Docs' },
					value: '/guide?tab=start#intro'
				}
			}
		};
		let brand = mount(() => <DefaultHeader />).find('.docs-header__brand');
		expect(brand.text()).toBe('组件文档');
		expect(brand.attributes('href')).toBe('/zh-CN/guide?tab=start#intro');
		expect(brand.find('.docs-header__brand-logo').attributes()).toMatchObject({
			src: '/logo-zh.svg',
			alt: ''
		});

		window.$docs.layout.header!.brand!.value = '/en-US/guide';
		brand = mount(() => <DefaultHeader />).find('.docs-header__brand');
		expect(brand.attributes('href')).toBe('/en-US/guide');
	});

	it('falls back to the default language brand and renders external links safely', () => {
		route.params.lang = 'en-US';
		window.$docs.layout = {
			header: {
				brand: {
					label: { 'zh-CN': '默认品牌' },
					value: { 'zh-CN': 'https://example.com/docs' }
				}
			}
		};
		const brand = mount(() => <DefaultHeader />).find('.docs-header__brand');
		expect(brand.text()).toBe('默认品牌');
		expect(brand.attributes()).toMatchObject({
			href: 'https://example.com/docs',
			target: '_blank',
			rel: 'noopener noreferrer'
		});
	});

	it('does not render header nav when it is not configured', () => {
		expect(mount(() => <DefaultHeader />).find('.docs-header__nav').exists()).toBe(false);
	});

	it('renders header nav after search with localized and external links', () => {
		window.$docs.layout = {
			header: {
				nav: [
					{ label: 'Guide', value: '/guide' },
					{ label: 'GitHub', value: 'https://github.com/deot/docs' },
					{ label: 'Plain' }
				]
			}
		};
		const wrapper = mount(() => <DefaultHeader />);
		const nav = wrapper.find('.docs-header__nav');
		expect(wrapper.find('.docs-header__search').element.nextElementSibling).toBe(nav.element);
		expect(nav.attributes('aria-label')).toBe('Navigation');
		expect(nav.findAll('.docs-header__nav-item').map(item => item.text())).toEqual([
			'Guide',
			'GitHub',
			'Plain'
		]);
		expect(nav.findAll('a').map(link => link.attributes('href'))).toEqual([
			'/zh-CN/guide',
			'https://github.com/deot/docs'
		]);
		expect(nav.find('a[href="https://github.com/deot/docs"]').attributes()).toMatchObject({
			target: '_blank',
			rel: 'noopener noreferrer'
		});
		expect(nav.find('span.docs-header__nav-item').text()).toBe('Plain');
	});

	it('selects localized header nav and falls back to the default language', () => {
		window.$docs.layout = {
			header: {
				nav: {
					'zh_CN': [{ label: '中文导航', value: '/guide' }],
					'en-US': [{ label: 'English nav', value: '/guide' }]
				}
			}
		};
		expect(mount(() => <DefaultHeader />).find('.docs-header__nav-item').text())
			.toBe('中文导航');

		window.$docs.layout = {
			header: { nav: { 'zh-CN': [{ label: '默认语言导航', value: '/guide' }] } }
		};
		route.params.lang = 'en-US';
		expect(mount(() => <DefaultHeader />).find('.docs-header__nav-item').text())
			.toBe('默认语言导航');
	});

	it('renders header nav children as a dropdown', () => {
		window.$docs.layout = {
			header: {
				nav: [{
					label: 'Ecosystem',
					children: [
						{ label: 'Guide', value: '/guide' },
						{ label: 'GitHub', value: 'https://github.com/deot/docs' }
					]
				}]
			}
		};
		const wrapper = mount(() => <DefaultHeader />);
		expect(wrapper.find('.docs-header__nav-trigger').text()).toBe('Ecosystem');
		expect(wrapper.findAll('.docs-header__nav-option a').map(link => link.attributes('href')))
			.toEqual([
				'/zh-CN/guide',
				'https://github.com/deot/docs'
			]);
	});

	it('marks the current header nav item as active', () => {
		window.$docs.layout = {
			header: {
				nav: [
					{ label: 'Guide', value: '/guide' },
					{ label: 'Components', value: '/components' },
					{
						label: 'Ecosystem',
						children: [{ label: 'Button', value: '/components/button' }]
					}
				]
			}
		};
		const wrapper = mount(() => <DefaultHeader />);
		expect(wrapper.findAll('.docs-header__nav-item').map(item => [
			item.text(),
			item.classes().includes('is-active')
		])).toEqual([
			['Guide', false],
			['Components', true],
			['Ecosystem', true]
		]);
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

	it('applies the size prop as pixel dimensions', () => {
		const sized = mount(() => <ClientIcon name="github" size={24} />);
		expect(sized.element.style.width).toBe('24px');
		expect(sized.element.style.height).toBe('24px');
		expect(mount(() => <ClientIcon name="more" />).element.getAttribute('style'))
			.toBeNull();
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

	it('renders sidebar icons and tags for url, type and selected tuple', () => {
		route.path = '/zh-CN/guide';
		const wrapper = mount(() => (
			<DefaultSidebar
				items={[
					{
						label: 'Guide',
						value: '/guide',
						icon: ['book', 'book-fill'] as [string, string],
						tag: 'NEW'
					},
					{
						label: 'Logo',
						value: '/logo',
						icon: 'https://example.com/logo.svg'
					},
					{
						label: 'Docs',
						value: '/docs',
						icon: 'folder'
					}
				]}
			/>
		));
		expect(wrapper.find('.docs-sidebar__tag').text()).toBe('NEW');
		expect(wrapper.find('.vc-icon[data-type="book-fill"]').exists()).toBe(true);
		expect(wrapper.find('.docs-sidebar__media').attributes('src'))
			.toBe('https://example.com/logo.svg');
		expect(wrapper.find('.vc-icon[data-type="folder"]').exists()).toBe(true);
		expect(wrapper.find('.docs-sidebar__link.is-active').text()).toContain('Guide');
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

	it('aligns the site footer inner width with the markdown content width', async () => {
		setSidebarItems([
			{ label: 'Guide', value: '/packages/guide' }
		]);
		const { wrapper } = mountFooter();
		expect(wrapper.find('.docs-footer').attributes('data-content-width')).toBe('regular');
		await ContentWidth.set('wide');
		await flushPromises();
		expect(wrapper.find('.docs-footer').attributes('data-content-width')).toBe('wide');
		await ContentWidth.set('full');
		await flushPromises();
		// Full article can bleed; footer CSS still caps inner/bar at the wide 1200px column.
		expect(wrapper.find('.docs-footer').attributes('data-content-width')).toBe('full');
	});

	it('locks the site footer to the wide column when no sidebar is present', async () => {
		setSidebarItems(null);
		const { wrapper } = mountFooter();
		await ContentWidth.set('regular');
		await flushPromises();
		expect(wrapper.find('.docs-footer').attributes('data-content-width')).toBe('wide');
		await ContentWidth.set('full');
		await flushPromises();
		expect(wrapper.find('.docs-footer').attributes('data-content-width')).toBe('wide');
		setSidebarItems([
			{ label: 'Guide', value: '/packages/guide' }
		]);
		await flushPromises();
		expect(wrapper.find('.docs-footer').attributes('data-content-width')).toBe('full');
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

		window.$docs.repository = 'https://github.com/acme/widgets/tree/main';
		expect(mountFooter('zh-CN').wrapper.findAll('.docs-footer__group')).toHaveLength(3);

		window.$docs.repository = 'not a url';
		expect(mountFooter('zh-CN').wrapper.findAll('.docs-footer__group')).toHaveLength(3);
	});

	it('uses external footer groups without merging defaults', () => {
		window.$docs.layout = {
			footer: {
				nav: [{
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
		expect(wrapper.findAll('.docs-footer__links a').map(link => link.attributes('href'))).toEqual([
			'/zh-CN/guide',
			'https://example.com'
		]);
	});

	it('renders protocol-relative links and groups without children', () => {
		window.$docs.layout = {
			footer: {
				nav: [
					{ label: 'Empty' },
					{
						label: 'Links',
						children: [
							{ label: 'Plain' },
							{ label: 'CDN', value: '//cdn.example.com' }
						]
					}
				]
			}
		};
		const { wrapper } = mountFooter();
		expect(wrapper.findAll('.docs-footer__group')).toHaveLength(2);
		expect(wrapper.find('.docs-footer__links a').attributes('href')).toBe('//cdn.example.com');
		expect(wrapper.text()).toContain('Plain');
	});

	it('places the header brand on the footer bar', () => {
		window.$docs.namespace = 'acme-docs';
		window.$docs.layout = {
			header: {
				brand: {
					label: 'Acme Docs',
					logo: 'https://example.com/logo.svg',
					value: 'https://example.com'
				}
			},
			footer: { nav: [], poweredBy: 'Built by Docs Team' }
		};
		const { wrapper } = mountFooter();
		const brand = wrapper.find('.docs-footer__brand');
		expect(brand.text()).toBe('Acme Docs');
		expect(brand.attributes()).toMatchObject({
			href: 'https://example.com',
			target: '_blank',
			rel: 'noopener noreferrer'
		});
		expect(wrapper.find('.docs-footer__brand-logo').attributes('src'))
			.toBe('https://example.com/logo.svg');
		expect(wrapper.find('.docs-footer__powered-by').text()).toBe('Built by Docs Team');
	});

	it('places an internal header brand with a logo on the footer bar', () => {
		window.$docs.layout = {
			header: {
				brand: {
					label: 'Docs Home',
					logo: '/logo.svg',
					value: '/'
				}
			},
			footer: { nav: [], poweredBy: false }
		};
		const { wrapper } = mountFooter();
		expect(wrapper.find('.docs-footer__brand').attributes('href')).toBe('/en-US');
		expect(wrapper.find('.docs-footer__brand-logo').attributes('src')).toBe('/logo.svg');
	});

	it('selects localized external groups and falls back to the default language', () => {
		window.$docs.layout = {
			footer: {
				nav: {
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
			footer: { nav: { 'zh-CN': [{ label: '默认语言链接' }] } }
		};
		const fallback = mountFooter().wrapper;
		expect(fallback.text()).toContain('默认语言链接');
	});

	it('keeps unmatched localized external footer values empty', () => {
		window.$docs.layout = {
			footer: {
				nav: { 'de-DE': [{ label: 'Deutsch' }] },
				poweredBy: { 'de-DE': 'Deutsches Team' }
			}
		};
		const { wrapper } = mountFooter();
		expect(wrapper.findAll('.docs-footer__group')).toHaveLength(0);
		expect(wrapper.find('.docs-footer__powered-by').exists()).toBe(false);
		expect(wrapper.find('.docs-footer__brand').text()).toBe('@deot/docs');
	});

	it('supports default, omitted and hidden footer provider states', () => {
		window.$docs.layout = { footer: { nav: [], poweredBy: 'default' } };
		expect(mountFooter().wrapper.find('.docs-footer__powered-by').text())
			.toBe('Powered by @deot/docs');

		window.$docs.layout = { footer: { nav: [] } };
		const omitted = mountFooter().wrapper;
		expect(omitted.find('.docs-footer__powered-by').exists()).toBe(false);
		expect(omitted.find('.docs-footer__brand').exists()).toBe(true);

		window.$docs.layout = { footer: { nav: [], poweredBy: false } };
		expect(mountFooter().wrapper.find('.docs-footer__powered-by').exists()).toBe(false);
	});

	it('hides the built-in footer through the site layout configuration', () => {
		window.$docs.layout = { footer: false };
		expect(mountFooter().wrapper.find('.docs-footer').exists()).toBe(false);
	});

	it('renders a markdown page header eyebrow from the sidebar section', () => {
		setSidebarItems([
			{ label: 'Introduction', value: '/packages/guide' },
			{
				label: 'Packages',
				children: [{ label: 'Client', value: '/packages/client' }]
			}
		]);
		route.path = '/zh-CN/packages/client';
		const wrapper = mount(() => <PageHeader />);
		expect(wrapper.find('.docs-page-header__eyebrow').text()).toBe('Packages');
		expect(wrapper.find('.docs-content-width').exists()).toBe(true);
		expect(wrapper.find('[aria-checked="true"]').attributes('aria-label')).toBe('Regular');

		route.path = '/zh-CN/packages/guide';
		const topLevel = mount(() => <PageHeader />);
		expect(topLevel.find('.docs-page-header').exists()).toBe(true);
		expect(topLevel.find('.docs-page-header__eyebrow').exists()).toBe(false);
		expect(topLevel.find('.docs-content-width').exists()).toBe(true);
	});

	it('switches markdown content width from the page header pill', async () => {
		const wrapper = mount(() => <PageHeader />);
		const options = wrapper.findAll('.docs-content-width__option');
		expect(options).toHaveLength(3);
		await options[1]!.trigger('click');
		expect(wrapper.find('[aria-checked="true"]').attributes('aria-label')).toBe('Wide');
		expect(ContentWidth.current.value).toBe('wide');

		await wrapper.find('.docs-content-width').trigger('keydown', { key: 'ArrowRight' });
		expect(wrapper.find('[aria-checked="true"]').attributes('aria-label')).toBe('Full');
		await wrapper.find('.docs-content-width').trigger('keydown', { key: 'ArrowLeft' });
		expect(wrapper.find('[aria-checked="true"]').attributes('aria-label')).toBe('Wide');
		await wrapper.find('.docs-content-width').trigger('keydown', { key: 'ArrowUp' });
		expect(wrapper.find('[aria-checked="true"]').attributes('aria-label')).toBe('Regular');
		await wrapper.find('.docs-content-width').trigger('keydown', { key: 'Enter' });
		expect(wrapper.find('[aria-checked="true"]').attributes('aria-label')).toBe('Regular');
	});

	it('renders markdown page footer neighbors from the sidebar order', () => {
		setSidebarItems([
			{ label: 'Introduction', value: '/packages/guide' },
			{
				label: 'Packages',
				children: [
					{ label: 'Client', value: '/packages/client' },
					{ label: 'CLI', value: '/packages/cli' }
				]
			}
		]);
		route.path = '/zh-CN/packages/client';
		const wrapper = mount(() => <PageFooter />);
		expect(wrapper.find('.docs-page-footer__link--previous').text()).toBe('Introduction');
		expect(wrapper.find('.docs-page-footer__link--previous').attributes('href'))
			.toBe('/zh-CN/packages/guide');
		expect(wrapper.find('.docs-page-footer__link--next').text()).toBe('CLI');
		expect(wrapper.find('.docs-page-footer__link--next').attributes('href'))
			.toBe('/zh-CN/packages/cli');

		route.path = '/zh-CN/packages/guide';
		const first = mount(() => <PageFooter />);
		expect(first.find('.docs-page-footer__link--previous').exists()).toBe(false);
		expect(first.find('.docs-page-footer__link--next').text()).toBe('Client');

		route.path = '/zh-CN/missing';
		expect(mount(() => <PageFooter />).find('.docs-page-footer').exists()).toBe(false);
	});

	it('hides the page outline when markdown has no headings', async () => {
		const host = document.createElement('div');
		const wrapper = mount(() => <PageOutline target={host} />);
		await flushPromises();
		expect(wrapper.find('.docs-page-outline').exists()).toBe(false);
	});

	it('renders nested outline links and navigates to the heading hash', async () => {
		const host = document.createElement('div');
		host.innerHTML = [
			'<h2 id="pseudo"><a class="header-anchor" href="#pseudo">#</a> Pseudo-classes</h2>',
			'<h3 id="hover">:hover</h3>'
		].join('');
		document.body.appendChild(host);
		const wrapper = mount(() => <PageOutline target={host} />);
		await vi.waitFor(() => expect(wrapper.find('.docs-page-outline__link').exists()).toBe(true));
		expect(wrapper.find('.docs-page-outline__title').text()).toBe('On this page');
		expect(wrapper.get('.docs-page-outline__title').element.tagName).toBe('P');
		const links = wrapper.findAll('.docs-page-outline__link');
		expect(links.map(link => link.text())).toEqual(['Pseudo-classes', ':hover']);
		expect(links[1]!.classes()).toContain('docs-page-outline__link--nested');
		await links[1]!.trigger('click');
		expect(push).toHaveBeenCalledWith(expect.objectContaining({ hash: '#hover' }));
		host.remove();
	});

	it('uses 大纲 as the chinese outline title', async () => {
		const host = document.createElement('div');
		host.innerHTML = '<h2 id="one">One</h2>';
		const current = ref(resolveLocale('zh-CN', window.$docs.locales));
		const Host = defineComponent({
			setup() {
				provideLocale(current);
				return () => <PageOutline target={host} />;
			}
		});
		const wrapper = mount(Host);
		await vi.waitFor(() => expect(wrapper.find('.docs-page-outline__title').text()).toBe('大纲'));
	});

	it('stays hidden when the outline has no article target', async () => {
		const wrapper = mount(() => <PageOutline />);
		await flushPromises();
		expect(wrapper.find('.docs-page-outline').exists()).toBe(false);
		route.hash = '#gone';
		await flushPromises();
		expect(wrapper.find('.docs-page-outline').exists()).toBe(false);
	});

	it('scrolls the article scroller and follows encoded outline hashes', async () => {
		const main = document.createElement('div');
		main.className = 'docs-layout__main-scroller';
		const scroller = document.createElement('div');
		scroller.className = 'vc-scroller__wrapper';
		Object.defineProperty(scroller, 'scrollTop', { value: 24, writable: true });
		const host = document.createElement('div');
		host.innerHTML = '<h2 id="one">One</h2><h2 id="%E">Broken</h2>';
		scroller.append(host);
		main.append(scroller);
		document.body.append(main);
		const wrapper = mount(() => <PageOutline target={host} />);
		await vi.waitFor(() => expect(wrapper.findAll('.docs-page-outline__link')).toHaveLength(2));
		await wrapper.findAll('.docs-page-outline__link')[1]!.trigger('click');
		expect(push).toHaveBeenCalledWith(expect.objectContaining({ hash: '#%E' }));
		route.hash = '#one';
		await flushPromises();
		expect(wrapper.find('[aria-current="location"]').text()).toBe('One');
		window.dispatchEvent(new Event('scroll'));
		window.dispatchEvent(new Event('resize'));
		main.remove();
	});

	it('tracks the parent scroller and refreshes when headings change', async () => {
		class ResizeObserverMock {
			observe = vi.fn();
			disconnect = vi.fn();
			unobserve = vi.fn();
		}
		vi.stubGlobal('ResizeObserver', ResizeObserverMock);
		vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
			cb(0);
			return 1;
		});
		vi.stubGlobal('cancelAnimationFrame', vi.fn());
		const host = document.createElement('div');
		host.innerHTML = '<h2 id="one">One</h2>';
		document.body.append(host);
		const scrollerEl = document.createElement('div');
		const on = vi.fn();
		const off = vi.fn();
		const Host = defineComponent({
			setup() {
				provide('vc-scroller', {
					on,
					off,
					wrapper: scrollerEl,
					clientHeight: 600,
					scrollHeight: 2000,
					scrollTop: 1400
				});
				return () => <PageOutline target={host} />;
			}
		});
		const wrapper = mount(Host);
		await vi.waitFor(() => expect(wrapper.find('.docs-page-outline__link').exists()).toBe(true));
		expect(on).toHaveBeenCalled();
		host.insertAdjacentHTML('beforeend', '<h2 id="two">Two</h2>');
		await vi.waitFor(() => expect(wrapper.findAll('.docs-page-outline__link')).toHaveLength(2));
		wrapper.unmount();
		expect(off).toHaveBeenCalled();
		host.remove();
		vi.unstubAllGlobals();
	});

	it('falls back to window scrolling when the parent scroller cannot subscribe', async () => {
		const host = document.createElement('div');
		host.innerHTML = '<h2 id="one">One</h2>';
		document.body.append(host);
		const Host = defineComponent({
			setup() {
				provide('vc-scroller', {
					on: () => {
						throw new Error('unavailable');
					}
				});
				return () => <PageOutline target={host} />;
			}
		});
		const wrapper = mount(Host);
		await vi.waitFor(() => expect(wrapper.find('.docs-page-outline__link').exists()).toBe(true));
		wrapper.unmount();
		host.remove();
	});
});
