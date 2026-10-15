// @vitest-environment jsdom

import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { reactive } from 'vue';
import type { LocationQuery } from 'vue-router';
import { encode } from '@deot/helper-unicode';
import { Markdown } from '@deot/docs-markdown';
import MarkdownEditor from '../src/pages/markdown-editor/index.vue';

const { state, request, getSetting, setSetting, stored } = vi.hoisted(() => ({
	state: { query: {} as LocationQuery, params: { lang: 'zh-CN' } },
	request: vi.fn(), getSetting: vi.fn(), setSetting: vi.fn(), stored: new Map<string, unknown>()
}));
const route = reactive(state);
enableAutoUnmount(afterEach);
vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
vi.stubGlobal('requestAnimationFrame', () => 1);
vi.stubGlobal('cancelAnimationFrame', () => {});
vi.mock('vue-router', () => ({ useRoute: () => route }));
vi.mock('../src/modules/gateway', () => ({ Gateway: { revalidate: request } }));
vi.mock('../src/modules/settings', () => ({ Settings: { get: getSetting, set: setSetting } }));
vi.mock('../src/components/theme-toggler/index.vue', () => ({ default: { template: '<div />' } }));
vi.mock('../src/pages/markdown-editor/components/source-editor.vue', async () => {
	const { defineComponent, ref } = await import('vue');
	return { default: defineComponent({
		name: 'SourceEditor', props: ['modelValue', 'label'], emits: ['update:modelValue', 'scroll'],
		setup: (props, { expose, emit }) => {
			const root = ref<HTMLElement>();
			expose({
				getScrollElement: () => root.value,
				getLineTop: (line: number) => (line - 1) * 20,
				setScrollTop: (top: number) => { if (root.value) root.value.scrollTop = top; }
			});
			return () => (
				<div ref={root} class="docs-markdown-editor-source-editor">
					<textarea
						aria-label={props.label}
						value={props.modelValue}
						onInput={event => emit('update:modelValue', (event.target as HTMLTextAreaElement).value)}
					/>
				</div>
			);
		}
	}) };
});
vi.mock('@deot/vc', async () => {
	const { defineComponent, ref } = await import('vue');
	return {
		Clipboard: defineComponent({
			name: 'Clipboard', props: ['value', 'tag'], setup: (_, { slots }) => () => <button>{slots.default?.()}</button>
		}),
		Scroller: defineComponent({
			name: 'Scroller', props: ['height', 'native', 'wheel', 'autoResize', 'always'], emits: ['scroll'],
			setup: (_, { slots, expose, emit }) => {
				const root = ref<HTMLElement>();
				expose({ refresh: () => {}, setScrollTop: (top: number) => { if (root.value) root.value.scrollTop = top; } });
				return () => <div ref={root} onScroll={() => emit('scroll')}>{slots.default?.()}</div>;
			}
		})
	};
});
vi.mock('@deot/docs-playground', async () => {
	const { defineComponent } = await import('vue');
	const { resolveCdnURL } = await import('../../playground/src/cdn');
	return {
		resolveCdnURL,
		CodePreview: defineComponent({ props: ['code'], setup: props => () => <pre class="code-preview">{props.code}</pre> }),
		Playground: defineComponent({ props: ['options', 'viewport'], setup: () => () => <div class="playground" /> })
	};
});

const deferred = <T,>() => {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>(done => resolve = done);
	return { promise, resolve };
};
const button = (wrapper: ReturnType<typeof mount>, name: string) => wrapper.findAll('button')
	.find(item => item.text() === name)!;

describe('Markdown editor', () => {
	beforeEach(() => {
		route.query = {};
		stored.clear();
		request.mockReset().mockResolvedValue({
			content: '# Remote\n\n![image](./image.png)\n\n[link](./next.md)\n\n```js\nconsole.log("中文");\n```'
		});
		getSetting.mockReset().mockImplementation((_namespace, key) => Promise.resolve(stored.get(key) ?? null));
		setSetting.mockReset().mockImplementation((_namespace, key, value) => { stored.set(key, value); return Promise.resolve(); });
		window.$docs = {
			locales: { 'zh-CN': { label: '中文' } }, routes: {},
			components: { markdown: { indicator: false, theme: 'traditional' } }
		};
		vi.spyOn(window, 'print').mockImplementation(() => {});
		vi.spyOn(window, 'confirm').mockReturnValue(true);
	});
	afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

	it('uses the repository Markdown component, resolves assets and passes scoped Playground options', async () => {
		route.query = { raw: encode(JSON.stringify({
			url: 'https://source.test/docs/readme.md',
			modules: { custom: 'https://source.test/custom.js' }, playground: { viewport: 375 }
		})) };
		const wrapper = mount(MarkdownEditor);
		await flushPromises();
		expect(wrapper.findComponent(Markdown).props('theme')).toBe('traditional');
		expect(wrapper.findComponent(Markdown).props('indicator')).toBe(false);
		expect(wrapper.findComponent(Markdown).props('playground')).toMatchObject({
			viewport: 375, options: { builtinImportMap: { imports: { custom: 'https://source.test/custom.js' } } }
		});
		expect(wrapper.find('article h1').text()).toContain('Remote');
		expect(wrapper.find('article img').attributes('src')).toBe('https://source.test/docs/image.png');
		expect(wrapper.find('article a[href="https://source.test/docs/next.md"]').exists()).toBe(true);
		expect(wrapper.find('.code-preview').text()).toContain('中文');
		expect(setSetting).not.toHaveBeenCalled();
	});

	it('keeps user edits when a slow remote request completes and prints the latest rendered text', async () => {
		vi.useFakeTimers();
		const pending = deferred<{ content: string }>();
		request.mockReturnValue(pending.promise);
		route.query = { url: 'https://source.test/readme.md' };
		const wrapper = mount(MarkdownEditor);
		await flushPromises();
		await wrapper.find('textarea').setValue('# Latest\n\n```js\nconst latest = "中文";\n```');
		pending.resolve({ content: '# Stale' });
		await flushPromises();
		expect((wrapper.find('textarea').element as HTMLTextAreaElement).value).toContain('Latest');
		expect(button(wrapper, 'Export PDF').attributes('disabled')).toBeDefined();
		await vi.advanceTimersByTimeAsync(150);
		await flushPromises();
		expect(button(wrapper, 'Export PDF').attributes('disabled')).toBeUndefined();
		await button(wrapper, 'Export PDF').trigger('click');
		await flushPromises();
		expect(wrapper.find('article h1').text()).toContain('Latest');
		expect(wrapper.find('.code-preview').text()).toContain('latest');
		expect(window.print).toHaveBeenCalledOnce();
		await vi.advanceTimersByTimeAsync(300);
		expect(stored.get('markdown-editor:draft')).toMatchObject({ text: expect.stringContaining('Latest') });
	});

	it('gives explicit links priority, restores a bare-route draft and resets to the sample', async () => {
		stored.set('markdown-editor:draft', { text: '# Saved', base: 'https://source.test/docs/readme.md' });
		route.query = { url: 'https://source.test/readme.md' };
		const wrapper = mount(MarkdownEditor);
		await flushPromises();
		expect(wrapper.find('article h1').text()).toContain('Remote');
		expect(stored.get('markdown-editor:draft')).toMatchObject({ text: '# Saved' });
		route.query = {};
		await flushPromises();
		expect(wrapper.find('article h1').text()).toContain('Saved');
		await button(wrapper, 'Reset').trigger('click');
		await flushPromises();
		expect(window.confirm).toHaveBeenCalledOnce();
		expect(wrapper.find('article h1').text()).toContain('Markdown');
	});

	it('does not overwrite edits when the initial draft read completes late', async () => {
		const pending = deferred<unknown>();
		getSetting.mockImplementation((_namespace, key) => key.endsWith('draft') ? pending.promise : Promise.resolve(null));
		const wrapper = mount(MarkdownEditor);
		await wrapper.find('textarea').setValue('# Typed');
		pending.resolve({ text: '# Old draft', base: location.href });
		await flushPromises();
		expect((wrapper.find('textarea').element as HTMLTextAreaElement).value).toBe('# Typed');
	});

	it('opens a local file, accepts the same file again and resets its initial content', async () => {
		const wrapper = mount(MarkdownEditor);
		await flushPromises();
		const input = wrapper.find('input[type="file"]');
		Object.defineProperty(input.element, 'files', { configurable: true, value: [{ text: () => Promise.resolve('# Local') }] });
		await input.trigger('change');
		await flushPromises();
		expect(wrapper.find('article h1').text()).toContain('Local');
		await wrapper.find('textarea').setValue('# Edited');
		await button(wrapper, 'Reset').trigger('click');
		await flushPromises();
		expect(wrapper.find('article h1').text()).toContain('Local');
		await input.trigger('change');
		await flushPromises();
		expect((input.element as HTMLInputElement).value).toBe('');
	});

	it('does not refetch or overwrite edits for display-only config and tab changes', async () => {
		vi.useFakeTimers();
		const config = { url: 'https://source.test/readme.md', playground: { viewport: 375 } };
		route.query = { raw: encode(JSON.stringify(config)) };
		const wrapper = mount(MarkdownEditor);
		await flushPromises();
		await wrapper.find('textarea').setValue('# Edited');
		route.query = { raw: encode(JSON.stringify({ ...config, playground: { viewport: 640 } })), tab: 'other' };
		await vi.advanceTimersByTimeAsync(150);
		await flushPromises();
		expect(request).toHaveBeenCalledOnce();
		expect(wrapper.find('article h1').text()).toContain('Edited');
		route.query = { ...route.query, tab: 'again' };
		await flushPromises();
		await button(wrapper, 'Export PDF').trigger('click');
		await flushPromises();
		expect(window.print).toHaveBeenCalledOnce();
	});

	it('loads configured CSS and releases it on unmount', async () => {
		route.query = { url: 'https://source.test/readme.md', styles: '/preview.css' };
		const wrapper = mount(MarkdownEditor);
		await flushPromises();
		const link = document.querySelector<HTMLLinkElement>('link[data-docs-preview-style]')!;
		expect(link.href).toContain('/preview.css');
		wrapper.unmount();
		expect(link.isConnected).toBe(false);
	});

	it('resizes the two panes by dragging the divider or using the arrow keys', async () => {
		const wrapper = mount(MarkdownEditor);
		await flushPromises();
		const panes = wrapper.find('.docs-markdown-editor__panes');
		const divider = wrapper.find('[role="separator"]');
		Object.defineProperty(panes.element, 'clientWidth', { value: 1008 });
		Object.defineProperty(divider.element, 'offsetWidth', { value: 8 });
		Object.defineProperty(divider.element, 'setPointerCapture', { value: vi.fn() });
		expect(divider.attributes('aria-valuenow')).toBe('50');
		divider.element.dispatchEvent(new MouseEvent('pointerdown', { button: 0, clientX: 504, bubbles: true }));
		divider.element.dispatchEvent(new MouseEvent('pointermove', { clientX: 604, bubbles: true }));
		await flushPromises();
		expect(divider.attributes('aria-valuenow')).toBe('60');
		expect(panes.attributes('style')).toContain('minmax(0, 60fr) 8px minmax(0, 40fr)');
		await divider.trigger('pointerup');
		divider.element.dispatchEvent(new MouseEvent('pointermove', { clientX: 304, bubbles: true }));
		await flushPromises();
		expect(divider.attributes('aria-valuenow')).toBe('60');
		await divider.trigger('keydown', { key: 'ArrowLeft' });
		expect(divider.attributes('aria-valuenow')).toBe('58');
		await divider.trigger('keydown', { key: 'ArrowRight' });
		expect(divider.attributes('aria-valuenow')).toBe('60');
	});

	it('synchronizes either pane only while sync scroll is enabled', async () => {
		const wrapper = mount(MarkdownEditor);
		await flushPromises();
		const editor = wrapper.find('.docs-markdown-editor-source-editor').element as HTMLElement;
		const preview = wrapper.find('.docs-markdown-editor__preview').element as HTMLElement;
		Object.defineProperties(editor, { scrollHeight: { value: 1100 }, clientHeight: { value: 100 } });
		Object.defineProperties(preview, { scrollHeight: { value: 2100 }, clientHeight: { value: 100 } });
		editor.scrollTop = 500;
		wrapper.findComponent({ name: 'SourceEditor' }).vm.$emit('scroll');
		expect(preview.scrollTop).toBe(0);
		await wrapper.find('input[type="checkbox"]').setValue(true);
		expect(preview.scrollTop).toBe(1000);
		await wrapper.find('.docs-markdown-editor__preview').trigger('wheel');
		preview.scrollTop = 1500;
		await wrapper.find('.docs-markdown-editor__preview').trigger('scroll');
		expect(editor.scrollTop).toBe(750);
		await wrapper.find('input[type="checkbox"]').setValue(false);
		expect(stored.get('markdown-editor:sync')).toBe(false);
	});

	it('aligns corresponding blocks when sections have different rendered heights', async () => {
		request.mockResolvedValue({ content: '# Title\n\nIntro\n\n## Section\n\nBody\n' });
		route.query = { url: 'https://source.test/readme.md' };
		const wrapper = mount(MarkdownEditor);
		await flushPromises();
		const source = wrapper.find('.docs-markdown-editor-source-editor').element as HTMLElement;
		const preview = wrapper.find('.docs-markdown-editor__preview');
		const target = preview.element as HTMLElement;
		Object.defineProperties(source, { scrollHeight: { value: 1100 }, clientHeight: { value: 100 } });
		Object.defineProperties(target, { scrollHeight: { value: 2100 }, clientHeight: { value: 100 } });
		vi.spyOn(wrapper.find('article .docs-markdown-reset').element, 'getBoundingClientRect')
			.mockImplementation(() => ({ top: 24 - target.scrollTop }) as DOMRect);
		wrapper.findAll('article .docs-markdown-reset > *').forEach((block, index) => {
			const tops = [0, 60, 300, 360];
			vi.spyOn(block.element, 'getBoundingClientRect').mockImplementation(() => ({ top: tops[index] + 24 - target.scrollTop }) as DOMRect);
		});
		await wrapper.find('input[type="checkbox"]').setValue(true);
		source.scrollTop = 80;
		wrapper.findComponent({ name: 'SourceEditor' }).vm.$emit('scroll');
		expect(target.scrollTop).toBe(300);
		await preview.trigger('wheel');
		target.scrollTop = 330;
		await preview.trigger('scroll');
		expect(source.scrollTop).toBe(100);
	});

	it('does not scroll the driving pane back when the follower changes its measured height', async () => {
		const wrapper = mount(MarkdownEditor);
		await flushPromises();
		const editor = wrapper.find('.docs-markdown-editor-source-editor');
		const preview = wrapper.find('.docs-markdown-editor__preview');
		const source = editor.element as HTMLElement;
		const target = preview.element as HTMLElement;
		Object.defineProperties(source, { scrollHeight: { value: 1100, configurable: true }, clientHeight: { value: 100 } });
		Object.defineProperties(target, { scrollHeight: { value: 2100, configurable: true }, clientHeight: { value: 100 } });
		await wrapper.find('input[type="checkbox"]').setValue(true);
		source.scrollTop = 500;
		wrapper.findComponent({ name: 'SourceEditor' }).vm.$emit('scroll');
		expect(target.scrollTop).toBe(1000);
		Object.defineProperty(target, 'scrollHeight', { value: 2500 });
		await preview.trigger('scroll');
		expect(source.scrollTop).toBe(500);
		await preview.trigger('wheel');
		target.scrollTop = 1800;
		await preview.trigger('scroll');
		expect(source.scrollTop).toBe(750);
		Object.defineProperty(source, 'scrollHeight', { value: 1400 });
		wrapper.findComponent({ name: 'SourceEditor' }).vm.$emit('scroll');
		expect(target.scrollTop).toBe(1800);
		await editor.trigger('keydown', { key: 'ArrowUp' });
		source.scrollTop = 650;
		wrapper.findComponent({ name: 'SourceEditor' }).vm.$emit('scroll');
		expect(target.scrollTop).toBe(1200);
		await preview.trigger('pointerdown');
		target.scrollTop = 1800;
		await preview.trigger('scroll');
		expect(source.scrollTop).toBe(975);
	});
});
