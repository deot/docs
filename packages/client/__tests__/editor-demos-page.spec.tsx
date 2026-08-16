// @vitest-environment jsdom

import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h, reactive } from 'vue';
import EditorDemosPage from '../src/pages/renderer-editor-demos/index.vue';

const { routerPush } = vi.hoisted(() => ({
	routerPush: vi.fn()
}));
const route = reactive({
	path: '/en-US/renderer-editor-demos',
	fullPath: '/en-US/renderer-editor-demos',
	params: { lang: 'en-US' },
	query: {} as Record<string, string>,
	meta: { docsEditorDemos: true }
});

vi.mock('vue-router', async original => ({
	...await original<any>(),
	useRoute: () => route,
	useRouter: () => ({
		push: routerPush,
		resolve: (target: string) => ({ href: target })
	})
}));
vi.mock('@deot/docs-renderer', async original => ({
	...await original<any>(),
	Combo: defineComponent({
		props: ['modelValue', 'modules', 'context', 'draftKey'],
		emits: ['back', 'save', 'update:modelValue'],
		setup(props, { emit }) {
			return () => h('div', { class: 'editor-mock' }, [
				h('span', { class: 'editor-title' }, props.modelValue?.meta?.title),
				h('span', {
					class: 'editor-types'
				}, (props.modelValue?.blocks || []).map((block: { module: { type: string } }) => block.module.type).join(',')),
				h('span', { class: 'editor-draft' }, props.draftKey || ''),
				h('span', { class: 'editor-theme' }, props.context?.theme || ''),
				h('button', { class: 'editor-back', onClick: () => emit('back') }, 'Back'),
				h('button', {
					class: 'editor-save',
					onClick: () => emit('save', props.modelValue)
				}, 'Save')
			]);
		}
	})
}));

describe('renderer demos page', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		route.path = '/en-US/renderer-editor-demos';
		route.fullPath = '/en-US/renderer-editor-demos';
		route.params.lang = 'en-US';
		route.query = {};
		window.$docs = {
			locales: { 'en-US': { label: 'English' } },
			routes: {},
			namespace: 'editor-demos',
			runtime: { mode: 'development', workspace: '/site/' }
		};
	});
	afterEach(() => vi.restoreAllMocks());

	it('lists the catalog when name is missing or unknown', () => {
		const catalog = mount(EditorDemosPage);
		expect(catalog.find('.docs-renderer-editor-demos-gallery').exists()).toBe(true);
		expect(catalog.findAll('.docs-renderer-editor-demos-card')).toHaveLength(9);
		expect(catalog.text()).toContain('Landing composition');
		expect(catalog.text()).toContain('Blank editor');
		expect(catalog.find('.editor-mock').exists()).toBe(false);
		catalog.unmount();

		route.query = { name: 'missing' };
		const unknown = mount(EditorDemosPage);
		expect(unknown.find('.docs-renderer-editor-demos-gallery').exists()).toBe(true);
		expect(unknown.find('.editor-mock').exists()).toBe(false);
	});

	it('opens the blank renderer editor from the catalog', async () => {
		route.fullPath = '/en-US/renderer-editor-demos';
		const wrapper = mount(EditorDemosPage);
		const editor = wrapper.findAll('.docs-renderer-editor-demos-card')
			.find(card => card.text().includes('Blank editor'));
		expect(editor).toBeDefined();
		await editor!.trigger('click');
		expect(routerPush).toHaveBeenCalledWith({
			path: '/en-US/__docs/renderer-editor',
			query: { from: '/en-US/renderer-editor-demos' }
		});
	});

	it('opens a demo from the current catalog path', async () => {
		route.path = '/en-US/__docs/renderer-editor-demos';
		const wrapper = mount(EditorDemosPage);
		const landing = wrapper.findAll('.docs-renderer-editor-demos-card')
			.find(card => card.text().includes('Landing composition'));
		expect(landing).toBeDefined();
		await landing!.trigger('click');
		expect(routerPush).toHaveBeenCalledWith({
			path: '/en-US/__docs/renderer-editor-demos',
			query: { name: 'landing' }
		});
	});

	it('mounts the named demo and returns to the catalog query', async () => {
		route.query = { name: 'landing' };
		const wrapper = mount(EditorDemosPage);
		await vi.waitFor(() => expect(wrapper.find('.editor-title').text()).toBe('Landing composition'));
		expect(wrapper.find('.docs-renderer-editor-demos-gallery').exists()).toBe(false);
		expect(wrapper.find('.editor-types').text()).toBe('hero,features,steps,faq,cta');
		expect(wrapper.find('.editor-draft').text()).toContain('landing');
		expect(wrapper.find('.editor-theme').text()).toBe('light');
		await wrapper.find('.editor-back').trigger('click');
		expect(routerPush).toHaveBeenCalledWith({
			path: '/en-US/renderer-editor-demos',
			query: {}
		});
	});

	it('saves the named demo to a development page file', async () => {
		const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }));
		route.query = { name: 'promo' };
		const wrapper = mount(EditorDemosPage);
		await vi.waitFor(() => expect(wrapper.find('.editor-save').exists()).toBe(true));
		await wrapper.find('.editor-save').trigger('click');
		await flushPromises();
		expect(fetchMock).toHaveBeenCalledWith('/__docs/page', expect.objectContaining({ method: 'PUT' }));
		expect(JSON.parse(String(fetchMock.mock.calls.at(-1)?.[1]?.body || '{}'))).toMatchObject({
			lang: 'en-US',
			source: './pages/renderer-promo.page.json'
		});
	});
});
