// @vitest-environment jsdom

import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, reactive } from 'vue';
import { provideLocale, resolveLocale } from '@deot/docs-locale';
import { Renderer } from '@deot/docs-renderer';
import HomePage from '../src/pages/home/index.vue';
import { Gateway } from '../src/modules';
import type { RendererDocument } from '@deot/docs-renderer';
import { createContentRecord, invalid } from './fixtures/docs';
import type { ResourceContentRecord } from '../src/modules/gateway';

const route = reactive({ params: { lang: 'zh-CN' } });
const routerPush = vi.fn();
const appearance = { marginTop: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 };
const layout = { mode: 'sortable' as const, maxWidth: 1180, minHeight: 600, background: '#fff' };

vi.mock('vue-router', async original => ({
	...await original<typeof import('vue-router')>(),
	useRoute: () => route,
	useRouter: () => ({
		resolve: (target: string) => ({ href: target }),
		push: routerPush
	}),
	RouterLink: (await import('vue')).defineComponent({
		props: { to: { type: String, required: true } },
		setup: (props, { slots }) => () => <a href={props.to}>{slots.default?.()}</a>
	})
}));

describe('built-in home page', () => {
	beforeEach(() => {
		routerPush.mockClear();
		route.params.lang = 'zh-CN';
		window.$docs = {
			locales: { 'zh-CN': { label: '简体中文' }, 'en-US': { label: 'English' } },
			routes: {}
		};
	});
	afterEach(() => vi.restoreAllMocks());

	it('keeps the canvas empty when no home document is configured', async () => {
		const wrapper = mount(HomePage);
		await flushPromises();
		expect(wrapper.find('.docs-renderer').exists()).toBe(false);
		expect(wrapper.find('.docs-home__loading').exists()).toBe(false);
		expect(wrapper.find('.docs-home__error').exists()).toBe(false);
	});

	it('renders inline and cached page documents', async () => {
		const page: RendererDocument = {
			schemaVersion: 2,
			meta: { id: 'custom-home', title: 'Custom' },
			layout,
			blocks: [
				{ id: 'title', module: { type: 'title', version: 1, props: { text: 'Custom home' } }, appearance },
				{ id: 'image', module: { type: 'image', version: 1, props: { src: './cover.png' } }, appearance },
				{ id: 'actions', module: { type: 'actions', version: 1, props: {
					items: [{ label: 'Open', to: '/zh-CN/guide' }]
				} }, appearance }
			]
		};
		window.$docs.routes['/'] = { content: { 'zh-CN': page } };
		const Host = defineComponent({
			setup() {
				provideLocale(resolveLocale('zh-CN', {
					'zh-CN': { label: '简体中文' }
				}));
				return () => <HomePage />;
			}
		});
		const inline = mount(Host);
		await vi.waitFor(() => expect(inline.text()).toContain('Custom home'));
		expect(inline.findComponent(Renderer).props('context')).toMatchObject({ theme: 'light' });
		await vi.waitFor(() => expect(inline.find('img').attributes('src')).toContain('/zh-CN/cover.png'));
		await inline.find('.docs-renderer-actions a').trigger('click', { button: 0 });
		expect(routerPush).toHaveBeenCalledWith('/zh-CN/guide');
		inline.unmount();

		window.$docs.routes['/'] = { content: { 'zh-CN': './home.page.json' } };
		vi.spyOn(Gateway, 'subscribe').mockReturnValue(vi.fn());
		vi.spyOn(Gateway, 'load').mockResolvedValue(createContentRecord({
			content: JSON.stringify(page)
		}));
		const cached = mount(HomePage);
		await vi.waitFor(() => expect(cached.text()).toContain('Custom home'));
		expect(Gateway.load).toHaveBeenCalledWith(expect.objectContaining({ type: 'page' }), expect.objectContaining({
			priority: 100
		}));
	});

	it('applies valid cached updates and keeps the previous page after an invalid update', async () => {
		window.$docs.routes['/'] = { content: { 'zh-CN': './home.page.json' } };
		let listener: Parameters<typeof Gateway.subscribe>[1] | undefined;
		vi.spyOn(Gateway, 'subscribe').mockImplementation((_identity, callback) => {
			listener = callback;
			return vi.fn();
		});
		vi.spyOn(Gateway, 'load').mockResolvedValue(createContentRecord({
			content: JSON.stringify({
				schemaVersion: 2,
				meta: { id: 'home' },
				layout,
				blocks: [{ id: 'title', module: { type: 'title', version: 1, props: { text: 'Initial' } }, appearance }]
			})
		}));
		const wrapper = mount(HomePage);
		await vi.waitFor(() => expect(wrapper.text()).toContain('Initial'));
		listener?.(createContentRecord({
			content: JSON.stringify({
				schemaVersion: 2,
				meta: { id: 'home' },
				layout,
				blocks: [{ id: 'title', module: { type: 'title', version: 1, props: { text: 'Updated' } }, appearance }]
			})
		}));
		await vi.waitFor(() => expect(wrapper.text()).toContain('Updated'));
		listener?.(invalid<ResourceContentRecord>({ content: '{invalid' }));
		await flushPromises();
		expect(wrapper.text()).toContain('Updated');
		expect(wrapper.find('.docs-home__error').exists()).toBe(true);
	});

	it('reports an invalid inline document', async () => {
		window.$docs.routes['/'] = {
			content: { 'zh-CN': { schemaVersion: 2, meta: { id: '' }, layout, blocks: [] } }
		};
		const wrapper = mount(HomePage);
		await vi.waitFor(() => expect(wrapper.find('.docs-home__error').exists()).toBe(true));
	});

	it('reports a configured page failure without substituting a built-in document', async () => {
		window.$docs.routes['/'] = { content: { 'zh-CN': './missing.page.json' } };
		vi.spyOn(Gateway, 'subscribe').mockReturnValue(vi.fn());
		vi.spyOn(Gateway, 'load').mockRejectedValue(new Error('Unavailable'));
		const wrapper = mount(HomePage);
		await vi.waitFor(() => expect(wrapper.text()).toContain('Unavailable'));
		expect(wrapper.find('.docs-renderer').exists()).toBe(false);
	});
});
