// @vitest-environment jsdom

import { defineComponent, nextTick } from 'vue';
import { mount } from '@vue/test-utils';
import { useStore } from '@vue/repl';
import Playground from '../src/playground.vue';

const { popup, store, setFiles } = vi.hoisted(() => ({
	popup: vi.fn(),
	setFiles: vi.fn(),
	store: {} as any
}));

vi.mock('../src/editor', () => ({ Editor: { popup } }));
vi.mock('@deot/vc', () => ({
	Clipboard: defineComponent({ name: 'Clipboard', props: ['value'], template: '<button class="clipboard"><slot /></button>' }),
	Scroller: defineComponent({
		name: 'Scroller',
		props: ['contentClass'],
		template: '<div class="scroller"><div :class="contentClass"><slot /></div></div>'
	})
}));
vi.mock('@vue/repl', () => ({
	File: class {
		constructor(public filename: string, public code = '') {}
	},
	Sandbox: defineComponent({
		name: 'Sandbox',
		props: ['store', 'autoStoreInit', 'clearConsole', 'previewOptions'],
		template: '<div class="sandbox" />'
	}),
	useStore: vi.fn((options) => {
		store.options = options;
		store.files = options.files.value;
		store.mainFile = options.mainFile.value;
		store.activeFilename = options.activeFilename.value;
		store.errors = [];
		store.init = vi.fn();
		store.setActive = vi.fn((filename: string) => (store.activeFilename = filename));
		store.addFile = vi.fn((file: any) => {
			store.files[file.filename] = file;
			store.activeFilename = file.filename;
		});
		store.renameFile = vi.fn((oldFilename: string, newFilename: string) => {
			const file = store.files[oldFilename];
			file.filename = newFilename;
			store.files[newFilename] = file;
			delete store.files[oldFilename];
			if (store.mainFile === oldFilename) store.mainFile = newFilename;
		});
		store.setFiles = setFiles.mockImplementation((files: Record<string, string>, entry: string) => {
			store.files = Object.fromEntries(Object.entries(files).map(([filename, code]) => [
				`src/${filename}`,
				{ filename: `src/${filename}`, code }
			]));
			store.mainFile = `src/${entry}`;
		});
		return store;
	})
}));

describe('Playground', () => {
	beforeEach(() => {
		popup.mockReset();
		setFiles.mockReset();
		vi.mocked(useStore).mockClear();
	});

	it('renders the preview and merges custom imports', () => {
		const wrapper = mount(Playground, {
			props: {
				modelValue: '<template>hello</template>',
				options: { builtinImportMap: { imports: { vue: '/vue.js', custom: '/custom.js' } } }
			}
		});

		expect(wrapper.classes()).toContain('docs-playground');
		expect(wrapper.find('.clipboard').attributes('aria-label')).toBe('复制');
		expect(store.options.template.value.welcomeSFC).toContain('hello');
		expect(store.options.builtinImportMap.value.imports.vue).toBe('/vue.js');
		expect(store.options.builtinImportMap.value.imports.custom).toBe('/custom.js');
		expect(store.files['src/App.vue'].code).toContain('hello');
		expect(store.init).toHaveBeenCalledTimes(1);
		expect(wrapper.findComponent({ name: 'Sandbox' }).props('autoStoreInit')).toBe(false);
		expect(wrapper.findComponent({ name: 'Sandbox' }).props('previewOptions').headHTML).toContain('@deot/style');
	});

	it('is exported from the package entry', async () => {
		const entry = await import('../src');
		expect(entry.CodePreview).toBeDefined();
		expect(entry.Playground).toBe(Playground);
	});

	it('opens the editor and synchronizes multi-file actions', async () => {
		const wrapper = mount(Playground, {
			props: {
				files: { 'main.js': 'first', 'App.vue': '<template />' },
				entry: 'main.js',
				views: ['runtime', 'files']
			}
		});
		await wrapper.find('[data-action="edit"]').trigger('click');
		const options = popup.mock.calls[0][0];
		expect(options.files).toEqual({ 'main.js': 'first', 'App.vue': '<template />' });
		expect(options.entry).toBe('main.js');
		options.onActiveChange('App.vue');
		expect(store.setActive).toHaveBeenCalledWith('src/App.vue');

		options.onFilesChange(
			{ 'main.js': 'second', 'App.vue': '<template />' },
			'main.js',
			{ type: 'update', filename: 'main.js' }
		);
		expect(store.files['src/main.js'].code).toBe('second');
		expect(wrapper.emitted('update:modelValue')).toEqual([['second']]);
		expect(wrapper.emitted('change')).toEqual([['second']]);

		options.onFilesChange(
			{ 'main.js': 'second', 'App.vue': '<template />', 'util.ts': '' },
			'main.js',
			{ type: 'create', filename: 'util.ts' }
		);
		await nextTick();
		expect(store.addFile).toHaveBeenCalledWith(expect.objectContaining({ filename: 'src/util.ts' }));
		expect(wrapper.find('[data-filename="util.ts"]').classes()).toContain('is-active');

		options.onFilesChange(
			{ 'bootstrap.js': 'second', 'App.vue': '<template />', 'util.ts': '' },
			'bootstrap.js',
			{ type: 'rename', previousFilename: 'main.js', filename: 'bootstrap.js' }
		);
		await nextTick();
		expect(store.renameFile).toHaveBeenCalledWith('src/main.js', 'src/bootstrap.js');
		expect(wrapper.emitted('update:entry')).toEqual([['bootstrap.js']]);

		options.onFilesChange(
			{ 'bootstrap.js': 'second', 'App.vue': '<template />' },
			'bootstrap.js',
			{ type: 'delete', filename: 'util.ts' }
		);
		await nextTick();
		expect(store.files['src/util.ts']).toBeUndefined();
		expect(wrapper.find('[data-filename="bootstrap.js"]').classes()).toContain('is-active');
		expect(wrapper.emitted('update:files')?.at(-1)?.[0]).toEqual({
			'bootstrap.js': 'second',
			'App.vue': '<template />'
		});
	});

	it('changes entry and accepts external file updates', async () => {
		const wrapper = mount(Playground, {
			props: { files: { 'App.vue': 'app', 'main.js': 'main' }, entry: 'App.vue' }
		});
		await wrapper.find('[data-action="edit"]').trigger('click');
		const options = popup.mock.calls[0][0];
		options.onFilesChange(
			{ 'App.vue': 'app', 'main.js': 'main' },
			'main.js',
			{ type: 'entry', filename: 'main.js' }
		);
		expect(store.mainFile).toBe('src/main.js');
		expect(wrapper.emitted('update:entry')).toEqual([['main.js']]);

		await wrapper.setProps({ files: { 'App.vue': 'changed', 'child.ts': 'child' }, entry: 'App.vue' });
		await nextTick();
		expect(setFiles).toHaveBeenCalledWith({ 'App.vue': 'changed', 'child.ts': 'child' }, 'App.vue');

		await wrapper.setProps({ entry: 'child.ts' });
		await nextTick();
		expect(store.mainFile).toBe('src/child.ts');
		expect(store.setActive).toHaveBeenCalledWith('src/child.ts');

		await wrapper.setProps({ entry: 'missing.ts' });
		await nextTick();
		expect(wrapper.find('.docs-playground__error').text()).toContain('missing.ts');
	});

	it('synchronizes external single-file model changes', async () => {
		const wrapper = mount(Playground, { props: { modelValue: 'first' } });
		await wrapper.setProps({ modelValue: 'second' });
		await nextTick();
		expect(store.files['src/App.vue'].code).toBe('second');
	});

	it('supports a styleless sandbox and default template', () => {
		const wrapper = mount(Playground, { props: { styleless: true } });
		expect(wrapper.find('.docs-playground').exists()).toBe(false);
		expect(wrapper.find('.docs-playground-runtime--styleless').attributes('style'))
			.toContain('height: 28px');
		expect(wrapper.find('.docs-playground__header').exists()).toBe(false);
		expect(wrapper.find('.sandbox').exists()).toBe(true);
		expect(wrapper.findComponent({ name: 'Sandbox' }).props('autoStoreInit')).toBe(false);
		expect(store.options.template.value.welcomeSFC).toContain('<slot />');
	});

	it('supports runtime-only and files-only views', async () => {
		const runtime = mount(Playground, { props: { modelValue: '<template>runtime</template>' } });
		expect(runtime.find('.sandbox').exists()).toBe(true);
		expect(runtime.find('.docs-playground-files').exists()).toBe(false);
		expect(runtime.find('.docs-playground__views').exists()).toBe(false);
		expect(runtime.find('.docs-playground__preview').attributes('style'))
			.toContain('height: 48px');

		const fixedRuntime = mount(Playground, {
			attrs: { style: 'height: 200px' },
			props: { modelValue: '<template>fixed</template>' }
		});
		expect(fixedRuntime.attributes('style')).toContain('height: 200px');
		expect(fixedRuntime.find('.docs-playground__preview').attributes('style'))
			.toContain('height: 48px');

		const files = mount(Playground, {
			props: {
				files: {
					'App.vue': '<template><strong>files</strong></template>',
					'util.ts': 'export const value = 1'
				},
				entry: 'App.vue',
				views: ['files']
			}
		});
		expect(useStore).toHaveBeenCalledTimes(2);
		expect(files.find('.sandbox').exists()).toBe(false);
		expect(files.find('.docs-playground-files').exists()).toBe(true);
		expect(files.find('.docs-playground__header').exists()).toBe(false);
		expect(files.find('.docs-playground__tools').exists()).toBe(false);
		expect(files.find('.docs-code-preview__copy').attributes('aria-label')).toBe('复制当前文件');
		expect(files.find('code.hljs').html()).toContain('hljs-tag');
		expect(files.find('code.hljs').html()).not.toContain('<strong>files</strong>');
		expect(files.find('pre').element.childNodes).toHaveLength(1);
		await files.find('[data-filename="util.ts"]').trigger('click');
		expect(files.find('[data-filename="util.ts"]').classes()).toContain('is-active');
		expect(files.find('code.hljs').text()).toContain('export const value');
	});

	it('orders views, lazily creates the sandbox and retains it after switching', async () => {
		const wrapper = mount(Playground, {
			props: {
				files: { 'App.vue': '<template>app</template>' },
				entry: 'App.vue',
				views: ['files', 'runtime']
			}
		});
		expect(useStore).not.toHaveBeenCalled();
		const buttons = wrapper.findAll('.docs-playground__view');
		expect(buttons.map(item => item.attributes('aria-label'))).toEqual(['文件预览', '运行时预览']);
		expect(buttons[0].classes()).toContain('is-active');
		expect(wrapper.find('.sandbox').exists()).toBe(false);
		expect(wrapper.find('.docs-playground__header').exists()).toBe(false);
		expect(wrapper.find('.docs-playground-files__actions').exists()).toBe(true);

		await buttons[1].trigger('click');
		expect(useStore).toHaveBeenCalledTimes(1);
		expect(wrapper.find('.sandbox').exists()).toBe(true);
		expect(wrapper.find('.docs-playground__header').exists()).toBe(true);
		expect(wrapper.find('.docs-playground__header').element.lastElementChild?.classList)
			.toContain('docs-playground__views');
		await buttons[0].trigger('click');
		expect(wrapper.find('.sandbox').exists()).toBe(true);
		expect(wrapper.find('.docs-playground__preview').isVisible()).toBe(false);
	});

	it('normalizes and reacts to external views', async () => {
		const wrapper = mount(Playground, {
			props: {
				files: { 'App.vue': '<template>app</template>' },
				views: ['invalid', 'files', 'files'] as any
			}
		});
		expect(wrapper.find('.docs-playground-files').isVisible()).toBe(true);
		expect(wrapper.find('.docs-playground__views').exists()).toBe(false);

		await wrapper.setProps({ views: [] });
		await nextTick();
		expect(wrapper.find('.sandbox').exists()).toBe(true);
		expect(wrapper.find('.docs-playground-files').exists()).toBe(false);
	});

	it('destroys a removed runtime and recreates it only when selected', async () => {
		const wrapper = mount(Playground, {
			props: {
				files: { 'App.vue': '<template>app</template>' },
				views: ['runtime', 'files']
			}
		});
		expect(wrapper.find('.sandbox').exists()).toBe(true);

		await wrapper.setProps({ views: ['files'] });
		expect(wrapper.find('.sandbox').exists()).toBe(false);

		await wrapper.setProps({ views: ['files', 'runtime'] });
		expect(wrapper.find('.sandbox').exists()).toBe(false);
		await wrapper.findAll('.docs-playground__view')[1].trigger('click');
		expect(wrapper.find('.sandbox').exists()).toBe(true);
	});

	it('shows an invalid explicit entry', () => {
		const wrapper = mount(Playground, {
			props: { files: { 'App.vue': 'app' }, entry: 'missing.js' }
		});
		expect(wrapper.find('.docs-playground__error').text()).toContain('missing.js');
	});
});
