// @vitest-environment jsdom

import { flushPromises, mount } from '@vue/test-utils';
import { createApp, defineComponent, h } from 'vue';
import { BuiltinModules } from '@deot/docs-renderer';
import MarkdownRenderer from '../src/components/renderer/markdown.vue';
import MarkdownEditor from '../src/components/renderer/markdown-editor.vue';
import SfcRenderer from '../src/components/renderer/sfc.vue';
import SourceEditor from '../src/components/renderer/source-editor.vue';
import {
	ClientRendererModules,
	getRendererRuntime,
	provideRendererModules,
	useRendererModules
} from '../src/components/renderer';
import { createRendererCreateContext } from './fixtures/docs';

const { load, subscribe, unsubscribe } = vi.hoisted(() => ({
	load: vi.fn(),
	subscribe: vi.fn(),
	unsubscribe: vi.fn()
}));
vi.mock('../src/modules', () => ({
	Gateway: {
		load,
		subscribe: (...args: unknown[]) => {
			subscribe(...args);
			return unsubscribe;
		}
	}
}));
vi.mock('@deot/docs-markdown', () => ({
	Markdown: defineComponent({
		props: { indicator: { type: [Boolean, Object], default: true }, locale: Object, value: String },
		setup: props => () => (
			<article
				class="markdown-output"
				data-indicator={JSON.stringify(props.indicator ?? true)}
			>
				{props.value}
			</article>
		)
	})
}));
vi.mock('../src/components/remote-sfc', () => ({
	default: defineComponent({
		props: { source: String, lang: String },
		setup: props => () => <div class="sfc-output">{`${props.source}:${props.lang}`}</div>
	})
}));

const context = {
	scene: 'renderer' as const,
	frameMode: 'sortable' as const,
	readonly: true,
	lang: 'en-US',
	source: './home.page.json'
};
const node = (props: Record<string, unknown>) => ({
	id: 'module',
	module: { type: 'docs:markdown', version: 1, props },
	appearance: { marginTop: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 }
});

describe('client Renderer integrations', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		window.$docs = {
			locales: { 'en-US': { label: 'English' } },
			routes: {},
			namespace: 'renderer-test',
			runtime: { mode: 'development', workspace: '/site/' }
		};
	});

	it('builds one immutable module set per config', async () => {
		const first = getRendererRuntime(window.$docs);
		const second = getRendererRuntime(window.$docs);
		expect(first).toBe(second);
		expect(first.modules).toHaveLength(BuiltinModules.length + ClientRendererModules.length);
		const markdown = await first.catalog.get('docs:markdown');
		const sfc = await first.catalog.get('docs:sfc');
		expect(markdown?.integrations?.collectResources?.({ source: './guide.md' }))
			.toEqual([{ type: 'markdown', source: './guide.md' }]);
		expect(markdown?.integrations?.collectResources?.({ source: 'https://example.com/guide.md' }))
			.toEqual([{ type: 'markdown', source: 'https://example.com/guide.md' }]);
		expect(markdown?.integrations?.collectResources?.({ source: './guide.md', content: '# Inline' }))
			.toEqual([]);
		expect(markdown?.integrations?.collectResources?.({ source: '' })).toEqual([]);
		expect(markdown?.data.create(createRendererCreateContext())).toEqual({ source: '' });
		expect(markdown?.data.normalize?.({ source: 1, content: '' })).toEqual({ source: '', content: '' });
		expect(markdown?.data.normalize?.({
			source: './guide.md',
			options: { indicator: { position: 'left', preview: true, unknown: 1 }, theme: 'docs' }
		})).toEqual({
			source: './guide.md',
			options: { indicator: { position: 'left', preview: true }, theme: 'docs' }
		});
		expect(markdown?.data.normalize?.({
			source: './guide.md',
			options: {
				indicator: {
					draggable: false,
					height: '40vh',
					position: 'right',
					preview: false,
					top: 8
				}
			}
		})).toEqual({
			source: './guide.md',
			options: {
				indicator: {
					draggable: false,
					height: '40vh',
					position: 'right',
					preview: false,
					top: 8
				}
			}
		});
		expect(markdown?.data.normalize?.({ options: { indicator: 'nope' } })).toEqual({ source: '' });
		expect(markdown?.data.normalize?.({ options: { indicator: true } })).toEqual({
			source: '',
			options: { indicator: true }
		});
		expect(markdown?.data.normalize?.(null)).toEqual({ source: '' });
		expect(markdown?.data.validate?.({ source: '', content: '' })).toEqual([]);
		expect(markdown?.data.validate?.({ source: '' })).toContainEqual(expect.objectContaining({
			code: 'source.required'
		}));
		expect(sfc?.integrations?.collectResources?.({ source: './demo.vue' }))
			.toEqual([{ type: 'sfc', source: './demo.vue' }]);
		expect(sfc?.integrations?.collectResources?.({ source: '' })).toEqual([]);
		expect(sfc?.data.create(createRendererCreateContext())).toEqual({ source: '' });
		expect(sfc?.data.normalize?.({ source: 1 })).toEqual({ source: '' });
		expect(sfc?.data.normalize?.(null)).toEqual({ source: '' });
		expect(sfc?.data.validate?.({ source: '' })).toContainEqual(expect.objectContaining({
			code: 'source.required'
		}));
	});

	it('provides the instance module set and keeps a built-in fallback', () => {
		const config = {
			...window.$docs,
			renderers: [{ type: 'custom', load: async () => { throw new Error('unused'); } }]
		};
		const target = document.createElement('div');
		const Reader = defineComponent({
			setup() {
				const modules = useRendererModules();
				return () => h('span', String(modules.length));
			}
		});
		const fallbackTarget = document.createElement('div');
		const fallbackApp = createApp(Reader);
		fallbackApp.mount(fallbackTarget);
		expect(fallbackTarget.textContent).toBe(String(BuiltinModules.length + ClientRendererModules.length));
		fallbackApp.unmount();
		const app = createApp(Reader);
		provideRendererModules(app, config);
		app.mount(target);
		expect(target.textContent).toBe(String(BuiltinModules.length + ClientRendererModules.length + 1));
		app.unmount();
	});

	it('reserves the docs module namespace for client integrations', () => {
		expect(() => getRendererRuntime({
			...window.$docs,
			renderers: [{ type: 'docs:custom', load: async () => { throw new Error('unused'); } }]
		})).toThrow('namespace is reserved');
	});

	it('renders inline Markdown without entering Gateway', async () => {
		const wrapper = mount(MarkdownRenderer, { props: { node: node({ content: '# Inline' }), context } });
		await flushPromises();
		expect(wrapper.text()).toContain('# Inline');
		expect(wrapper.get('.markdown-output').attributes('data-indicator')).toBe('true');
		expect(load).not.toHaveBeenCalled();
		await wrapper.setProps({
			node: node({ content: '# Inline', options: { indicator: false } })
		});
		await flushPromises();
		expect(wrapper.get('.markdown-output').attributes('data-indicator')).toBe('false');
		await wrapper.setProps({ node: node({}) });
		await flushPromises();
		expect(wrapper.text()).toBe('');
	});

	it('loads site Markdown and remote https sources', async () => {
		load.mockResolvedValueOnce({ content: '# Loaded' });
		const wrapper = mount(MarkdownRenderer, { props: { node: node({ source: './guide.md' }), context } });
		await vi.waitFor(() => expect(wrapper.text()).toContain('# Loaded'));
		expect(load).toHaveBeenCalledWith(expect.objectContaining({ type: 'markdown' }), expect.objectContaining({
			url: '/site/en-US/guide.md',
			priority: 100
		}));
		const listener = subscribe.mock.calls[0][1] as (record: { content: string }) => void;
		listener({ content: '# Updated' });
		await flushPromises();
		expect(wrapper.text()).toContain('# Updated');
		const signal = load.mock.calls[0][1].signal as AbortSignal;
		wrapper.unmount();
		expect(signal.aborted).toBe(true);
		expect(unsubscribe).toHaveBeenCalled();

		load.mockResolvedValueOnce({ content: '# Remote' });
		const remote = mount(MarkdownRenderer, {
			props: { node: node({ source: 'https://example.com/guide.md' }), context }
		});
		await vi.waitFor(() => expect(remote.text()).toContain('# Remote'));
		expect(load).toHaveBeenCalledWith(expect.objectContaining({
			source: 'https://example.com/guide.md'
		}), expect.objectContaining({
			url: 'https://example.com/guide.md'
		}));
		remote.unmount();

		load.mockRejectedValueOnce(new Error('Unavailable'));
		const failed = mount(MarkdownRenderer, { props: { node: node({ source: './missing.md' }), context } });
		await vi.waitFor(() => expect(failed.text()).toContain('Unavailable'));
	});

	it('adapts SFC nodes to the existing remote component', async () => {
		const wrapper = mount(SfcRenderer, {
			props: { node: { ...node({ source: './demo.vue' }), module: { type: 'docs:sfc', version: 1, props: { source: './demo.vue' } } }, context }
		});
		expect(wrapper.text()).toBe('./demo.vue:en-US');
	});

	it('edits Markdown source, inline content and indicator options', async () => {
		const wrapper = mount(MarkdownEditor, {
			props: { node: node({ source: './old.md' }), modelValue: { source: './old.md' }, context }
		});
		await wrapper.find('input').setValue('https://example.com/guide.md');
		expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([{
			source: 'https://example.com/guide.md'
		}]);
		await wrapper.find('textarea').setValue('# Hello');
		expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([{
			source: './old.md',
			content: '# Hello'
		}]);
		await wrapper.find('textarea').setValue('');
		expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([{
			source: './old.md'
		}]);
		await wrapper.findComponent({ name: 'vc-switch' }).vm.$emit('update:modelValue', false);
		expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([{
			source: './old.md',
			options: { indicator: false }
		}]);
	});

	it('edits a module source immutably', async () => {
		const wrapper = mount(SourceEditor, {
			props: { node: node({ source: './old.md' }), modelValue: { source: './old.md' }, context }
		});
		await wrapper.find('input').setValue('./new.md');
		expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([{ source: './new.md' }]);
	});
});
