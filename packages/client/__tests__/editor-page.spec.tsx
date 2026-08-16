// @vitest-environment jsdom

import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h, reactive } from 'vue';
import EditorPage from '../src/pages/renderer-editor/index.vue';
import { ResourceRequestError } from '../src/modules/gateway/types';

const { load, routerPush, routerReplace } = vi.hoisted(() => ({
	load: vi.fn(),
	routerPush: vi.fn(),
	routerReplace: vi.fn()
}));
const route = reactive({
	params: { lang: 'en-US' },
	query: { type: 'home', from: '/en-US', source: '' } as Record<string, string>,
	meta: {} as Record<string, unknown>
});

vi.mock('vue-router', async original => ({
	...await original<any>(),
	useRoute: () => route,
	useRouter: () => ({
		push: routerPush,
		replace: routerReplace,
		resolve: (target: string) => ({ href: target })
	})
}));
vi.mock('../src/modules', () => ({
	Gateway: { load },
	Theme: {
		current: { value: 'light' },
		enabled: { value: true },
		ready: { value: true },
		set: vi.fn(),
		toggle: vi.fn()
	}
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
				}, 'Save'),
				h('button', {
					class: 'editor-navigate',
					onClick: () => props.context.services?.navigate?.('/en-US/next')
				}, 'Navigate'),
				h('button', {
					class: 'editor-resolve',
					onClick: () => {
						props.context.services?.resolveLink?.('/en-US/guide');
						void props.context.services?.resolveAsset?.('./asset.png', './pages/home.page.json');
					}
				}, 'Resolve')
			]);
		}
	})
}));

describe('Renderer editor page', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		load.mockReset();
		route.params.lang = 'en-US';
		route.query = { type: 'home', from: '/en-US', source: '' };
		route.meta = {};
		sessionStorage.clear();
		window.$docs = {
			locales: { 'en-US': { label: 'English' } },
			routes: {},
			namespace: 'editor-page',
			runtime: { mode: 'development', workspace: '/site/' }
		};
	});
	afterEach(() => vi.restoreAllMocks());

	it('opens an empty canvas when home is not configured', async () => {
		const wrapper = mount(EditorPage);
		await vi.waitFor(() => expect(wrapper.find('.editor-mock').exists()).toBe(true));
		expect(wrapper.find('.editor-title').text()).toBe('Untitled Page');
		expect(wrapper.find('.editor-theme').text()).toBe('light');
		await wrapper.find('.editor-back').trigger('click');
		expect(routerPush).toHaveBeenCalledWith('/en-US');
		await wrapper.find('.editor-navigate').trigger('click');
		expect(routerPush).toHaveBeenCalledWith('/en-US/next');
		await wrapper.find('.editor-resolve').trigger('click');
		await flushPromises();
	});

	it('creates Markdown and SFC module documents from route context', async () => {
		route.query = {
			type: 'markdown',
			from: '/en-US/guide',
			source: './guide.md',
			title: 'Markdown page'
		};
		const markdown = mount(EditorPage);
		await vi.waitFor(() => expect(markdown.find('.editor-title').text()).toBe('Markdown page'));
		expect(markdown.find('.editor-types').text()).toBe('docs:markdown');
		markdown.unmount();

		route.query = { type: 'sfc', from: '/en-US/demo', source: './demo.vue' };
		const sfc = mount(EditorPage);
		await vi.waitFor(() => expect(sfc.find('.editor-types').text()).toBe('docs:sfc'));
		sfc.unmount();
	});

	it('uses an inline configured document while editing the home page', async () => {
		const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
			source: './pages/home.page.json'
		}), { status: 200 }));
		window.$docs.home = {
			locales: {
				'en-US': {
					schemaVersion: 2,
					meta: { id: 'inline-home', title: 'Inline home' },
					layout: { mode: 'sortable', maxWidth: 1180, minHeight: 600, background: '#fff' },
					blocks: []
				}
			}
		};
		const wrapper = mount(EditorPage);
		await vi.waitFor(() => expect(wrapper.find('.editor-title').text()).toBe('Inline home'));
		expect(wrapper.find('.editor-draft').text()).toMatch(/^docs-editor:editor-page:en-US:home:/);
		const locale = window.$docs.home.locales['en-US'];
		if (typeof locale === 'string' || !locale) throw new Error('expected inline document');
		locale.meta.title = 'Mutated config';
		await wrapper.find('.editor-save').trigger('click');
		await flushPromises();
		const body = JSON.parse(String(fetchMock.mock.calls.at(-1)?.[1]?.body || '{}'));
		expect(body.document.meta.title).toBe('Inline home');
		expect(window.$docs.home.locales['en-US']).toBe('./pages/home.page.json');
	});

	it('loads an existing page resource through Gateway', async () => {
		route.query = { type: 'page', from: '/en-US/guide', source: './pages/guide.page.json' };
		load.mockResolvedValue({
			content: JSON.stringify({
				schemaVersion: 2,
				meta: { id: 'guide', title: 'Guide page' },
				layout: { mode: 'sortable', maxWidth: 1180, minHeight: 600, background: '#fff' },
				blocks: []
			})
		});
		const wrapper = mount(EditorPage);
		await vi.waitFor(() => expect(wrapper.find('.editor-title').text()).toBe('Guide page'));
		expect(load).toHaveBeenCalledWith(expect.objectContaining({ type: 'page' }), expect.objectContaining({
			priority: 100
		}));
	});

	it('opens an empty canvas when a page resource does not exist', async () => {
		route.query = {
			type: 'page',
			from: '/en-US/new-page',
			source: './pages/new-page.page.json',
			title: 'New page'
		};
		load.mockRejectedValue(new ResourceRequestError(404));
		const wrapper = mount(EditorPage);
		await vi.waitFor(() => expect(wrapper.find('.editor-mock').exists()).toBe(true));
		expect(wrapper.find('.editor-title').text()).toBe('New page');
		expect(wrapper.find('.docs-renderer-editor-page__error').exists()).toBe(false);
	});

	it('saves to the development endpoint and adopts the returned source', async () => {
		const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
			source: './pages/home.page.json',
			etag: 'etag'
		}), { status: 200 }));
		const wrapper = mount(EditorPage);
		await vi.waitFor(() => expect(wrapper.find('.editor-save').exists()).toBe(true));
		await wrapper.find('.editor-save').trigger('click');
		await flushPromises();
		expect(fetchMock).toHaveBeenCalledWith('/__docs/page', expect.objectContaining({ method: 'PUT' }));
		expect(routerReplace).toHaveBeenCalledWith({
			query: expect.objectContaining({ source: './pages/home.page.json', type: 'page' })
		});
	});

	it('shows invalid page and save response errors without mounting the editor', async () => {
		route.query = { type: 'page', source: './bad.page.json' };
		load.mockResolvedValue({ content: '{invalid' });
		const wrapper = mount(EditorPage);
		await vi.waitFor(() => expect(wrapper.find('.docs-renderer-editor-page__error').exists()).toBe(true));
		expect(wrapper.find('.editor-mock').exists()).toBe(false);
	});

	it('discards stale page documents when the editor target changes', async () => {
		route.query = { type: 'page', from: '/en-US/guide', source: './slow.page.json' };
		let resolveLoad: (value: { content: string }) => void = () => undefined;
		load.mockImplementation(() => new Promise((resolve) => { resolveLoad = resolve; }));
		const wrapper = mount(EditorPage);
		route.query = {
			type: 'markdown',
			from: '/en-US/guide',
			source: './guide.md',
			title: 'Current page'
		};
		await vi.waitFor(() => expect(wrapper.find('.editor-title').text()).toBe('Current page'));
		resolveLoad({
			content: JSON.stringify({
				schemaVersion: 2,
				meta: { id: 'stale', title: 'Stale page' },
				layout: { mode: 'sortable', maxWidth: 1180, minHeight: 600, background: '#fff' },
				blocks: []
			})
		});
		await flushPromises();
		expect(wrapper.find('.editor-title').text()).toBe('Current page');
	});

	it('loads a string home page through Gateway', async () => {
		window.$docs.home = { locales: { 'en-US': './pages/home.page.json' } };
		load.mockResolvedValue({
			content: JSON.stringify({
				schemaVersion: 2,
				meta: { id: 'file-home', title: 'File home' },
				layout: { mode: 'sortable', maxWidth: 1180, minHeight: 600, background: '#fff' },
				blocks: []
			})
		});
		const wrapper = mount(EditorPage);
		await vi.waitFor(() => expect(wrapper.find('.editor-title').text()).toBe('File home'));
		expect(load).toHaveBeenCalledWith(expect.objectContaining({
			source: './pages/home.page.json',
			type: 'page'
		}), expect.anything());
	});

	it('restores an inline route document from session storage', async () => {
		route.query = { type: 'inline', from: '/en-US/campaign' };
		sessionStorage.setItem('docs-renderer-inline-document', JSON.stringify({
			from: '/en-US/campaign',
			document: {
				schemaVersion: 2,
				meta: { id: 'campaign', title: 'Campaign page' },
				layout: { mode: 'sortable', maxWidth: 1180, minHeight: 600, background: '#fff' },
				blocks: []
			}
		}));
		const wrapper = mount(EditorPage);
		await vi.waitFor(() => expect(wrapper.find('.editor-title').text()).toBe('Campaign page'));
	});
});
