// @vitest-environment jsdom

import { defineComponent, nextTick } from 'vue';
import { mount } from '@vue/test-utils';
import Playground from '../src/playground.vue';

const { popup, store, setFiles } = vi.hoisted(() => ({
	popup: vi.fn(),
	setFiles: vi.fn(),
	store: {} as any
}));

vi.mock('../src/editor', () => ({ Editor: { popup } }));
vi.mock('@deot/vc', () => ({
	Clipboard: defineComponent({ name: 'Clipboard', props: ['value'], template: '<button class="clipboard"><slot /></button>' })
}));
vi.mock('@vue/repl', () => ({
	File: class {
		constructor(public filename: string, public code = '') {}
	},
	Sandbox: defineComponent({ name: 'Sandbox', props: ['store', 'clearConsole', 'previewOptions'], template: '<div class="sandbox" />' }),
	useStore: vi.fn((options) => {
		store.options = options;
		store.files = options.files.value;
		store.mainFile = options.mainFile.value;
		store.activeFilename = options.activeFilename.value;
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
		store.setFiles = setFiles;
		return store;
	})
}));

describe('Playground', () => {
	beforeEach(() => {
		popup.mockReset();
		setFiles.mockReset();
	});

	it('renders the preview and merges custom imports', () => {
		const wrapper = mount(Playground, {
			props: {
				modelValue: '<template>hello</template>',
				options: { builtinImportMap: { imports: { vue: '/vue.js', custom: '/custom.js' } } }
			}
		});

		expect(wrapper.classes()).toContain('docs-playground');
		expect(wrapper.find('.clipboard').text()).toBe('复制');
		expect(store.options.template.value.welcomeSFC).toContain('hello');
		expect(store.options.builtinImportMap.value.imports.vue).toBe('/vue.js');
		expect(store.options.builtinImportMap.value.imports.custom).toBe('/custom.js');
		expect(store.files['src/App.vue'].code).toContain('hello');
		expect(wrapper.findComponent({ name: 'Sandbox' }).props('previewOptions').headHTML).toContain('@deot/style');
	});

	it('is exported from the package entry', async () => {
		const entry = await import('../src');
		expect(entry.Playground).toBe(Playground);
	});

	it('opens the editor and synchronizes multi-file actions', async () => {
		const wrapper = mount(Playground, {
			props: {
				files: { 'main.js': 'first', 'App.vue': '<template />' },
				entry: 'main.js'
			}
		});
		await wrapper.find('.docs-playground__tools span:last-child').trigger('click');
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
		expect(store.addFile).toHaveBeenCalledWith(expect.objectContaining({ filename: 'src/util.ts' }));

		options.onFilesChange(
			{ 'bootstrap.js': 'second', 'App.vue': '<template />', 'util.ts': '' },
			'bootstrap.js',
			{ type: 'rename', previousFilename: 'main.js', filename: 'bootstrap.js' }
		);
		expect(store.renameFile).toHaveBeenCalledWith('src/main.js', 'src/bootstrap.js');
		expect(wrapper.emitted('update:entry')).toEqual([['bootstrap.js']]);

		options.onFilesChange(
			{ 'bootstrap.js': 'second', 'App.vue': '<template />' },
			'bootstrap.js',
			{ type: 'delete', filename: 'util.ts' }
		);
		expect(store.files['src/util.ts']).toBeUndefined();
		expect(wrapper.emitted('update:files')?.at(-1)?.[0]).toEqual({
			'bootstrap.js': 'second',
			'App.vue': '<template />'
		});
	});

	it('changes entry and accepts external file updates', async () => {
		const wrapper = mount(Playground, {
			props: { files: { 'App.vue': 'app', 'main.js': 'main' }, entry: 'App.vue' }
		});
		await wrapper.find('.docs-playground__tools span:last-child').trigger('click');
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
		expect(wrapper.find('.sandbox').exists()).toBe(true);
		expect(store.options.template.value.welcomeSFC).toContain('<slot />');
	});

	it('shows an invalid explicit entry', () => {
		const wrapper = mount(Playground, {
			props: { files: { 'App.vue': 'app' }, entry: 'missing.js' }
		});
		expect(wrapper.find('.docs-playground__error').text()).toContain('missing.js');
	});
});
