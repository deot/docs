// @vitest-environment jsdom

import { defineComponent, nextTick } from 'vue';
import { mount } from '@vue/test-utils';
import EditorWrapper from '../src/editor/editor.vue';

const { destroy, focus, listener, dragOff, javascriptMode, messageError, vueMode, scrollerRefresh, setScrollLeft } = vi.hoisted(() => ({
	destroy: vi.fn(),
	focus: vi.fn(),
	listener: { callback: undefined as any },
	dragOff: vi.fn(),
	javascriptMode: vi.fn(() => 'javascript'),
	messageError: vi.fn(),
	vueMode: vi.fn(() => 'vue'),
	scrollerRefresh: vi.fn(),
	setScrollLeft: vi.fn()
}));

vi.mock('@deot/vc', () => ({
	Portal: class {
		constructor(public component: any, public options: any) {}
	},
	Message: { error: messageError },
	Popconfirm: defineComponent({
		name: 'Popconfirm',
		props: ['title', 'portal'],
		emits: ['ok', 'trigger'],
		template: '<span class="popconfirm" @click="$emit(\'trigger\')"><slot /></span>'
	}),
	Scroller: defineComponent({
		name: 'Scroller',
		props: ['contentClass'],
		setup(_, { expose }) {
			expose({ refresh: scrollerRefresh, setScrollLeft });
		},
		template: '<div class="scroller"><div :class="contentClass"><slot /></div></div>'
	}),
	TransitionFade: defineComponent({
		emits: ['after-leave'],
		template: '<div><slot /></div>'
	})
}));
vi.mock('codemirror', () => ({
	basicSetup: {},
	EditorView: class {
		static updateListener = { of: callback => (listener.callback = callback) };
		focus = focus;
		destroy = destroy;
		constructor(public options: any) {}
	}
}));
vi.mock('@codemirror/lang-javascript', () => ({ javascript: javascriptMode }));
vi.mock('@codemirror/lang-vue', () => ({ vue: vueMode }));
vi.mock('@codemirror/view', () => ({ highlightActiveLine: vi.fn(() => 'line') }));
vi.mock('../src/editor/drag', () => ({ Drag: class { off = dragOff; } }));

describe('editor', () => {
	beforeEach(() => {
		destroy.mockClear();
		focus.mockClear();
		dragOff.mockClear();
		javascriptMode.mockClear();
		messageError.mockClear();
		vueMode.mockClear();
		scrollerRefresh.mockClear();
		setScrollLeft.mockClear();
	});

	it('creates a legacy editor, reports changes, hides and disposes resources', async () => {
		const onChange = vi.fn();
		const wrapper = mount(EditorWrapper, { props: { value: '<template>ok</template>', onChange } });
		await nextTick();
		expect(focus).toHaveBeenCalled();
		expect(vueMode).toHaveBeenCalled();

		listener.callback({ docChanged: false, state: { doc: { toString: () => 'ignored' } } });
		listener.callback({ docChanged: true, state: { doc: { toString: () => 'changed' } } });
		expect(onChange).toHaveBeenCalledWith('changed');

		await wrapper.find('.docs-playground-editor__header span:last-child').trigger('click');
		expect(wrapper.find('.docs-playground-editor__wrapper').isVisible()).toBe(false);
		wrapper.unmount();
		expect(dragOff).toHaveBeenCalled();
		expect(destroy).toHaveBeenCalled();
	});

	it('switches files and edits non-entry code', async () => {
		const onFilesChange = vi.fn();
		const onActiveChange = vi.fn();
		const wrapper = mount(EditorWrapper, {
			props: {
				files: { 'App.vue': '<template />', 'util.ts': 'export const value = 1' },
				entry: 'App.vue',
				onFilesChange,
				onActiveChange
			}
		});
		await nextTick();
		await wrapper.find('[data-filename="util.ts"]').trigger('click');
		expect(onActiveChange).toHaveBeenCalledWith('util.ts');
		expect(javascriptMode).toHaveBeenCalledWith({ jsx: false, typescript: true });

		listener.callback({ docChanged: true, state: { doc: { toString: () => 'export const value = 2' } } });
		expect(onFilesChange).toHaveBeenLastCalledWith(
			expect.objectContaining({ 'util.ts': 'export const value = 2' }),
			'App.vue',
			{ type: 'update', filename: 'util.ts' }
		);
	});

	it('creates, renames, changes entry and deletes files', async () => {
		const onFilesChange = vi.fn();
		const wrapper = mount(EditorWrapper, {
			props: {
				files: { 'App.vue': '<template />', 'util.ts': '' },
				entry: 'App.vue',
				onFilesChange
			}
		});
		await nextTick();

		await wrapper.find('button[title="新建文件"]').trigger('click');
		await nextTick();
		expect(onFilesChange).toHaveBeenLastCalledWith(
			expect.objectContaining({ 'comp1.vue': expect.stringContaining('<slot />') }),
			'App.vue',
			{ type: 'create', filename: 'comp1.vue' }
		);
		expect(scrollerRefresh).toHaveBeenCalled();
		expect(setScrollLeft).toHaveBeenCalledWith(Number.MAX_SAFE_INTEGER);

		await wrapper.find('[data-filename="comp1.vue"]').trigger('dblclick');
		await wrapper.find('.docs-playground-editor__filename').setValue('config.json');
		await wrapper.find('.docs-playground-editor__filename').trigger('blur');
		expect(onFilesChange).toHaveBeenLastCalledWith(
			expect.objectContaining({ 'config.json': expect.stringContaining('<slot />') }),
			'App.vue',
			{ type: 'rename', filename: 'config.json', previousFilename: 'comp1.vue' }
		);

		await wrapper.find('button[title="设为入口"]').trigger('click');
		expect(onFilesChange).toHaveBeenLastCalledWith(
			expect.any(Object),
			'config.json',
			{ type: 'entry', filename: 'config.json' }
		);

		const utilPopconfirm = wrapper.findAllComponents({ name: 'Popconfirm' })
			.find(item => item.props('title').includes('util.ts'));
		await utilPopconfirm?.vm.$emit('ok');
		expect(onFilesChange).toHaveBeenLastCalledWith(
			expect.not.objectContaining({ 'util.ts': expect.anything() }),
			'config.json',
			{ type: 'delete', filename: 'util.ts' }
		);
	});

	it('renames the entry and creates Vue and plain files', async () => {
		const onFilesChange = vi.fn();
		const wrapper = mount(EditorWrapper, {
			props: {
				files: { 'App.vue': '<template />', 'comp1.vue': '<template />' },
				entry: 'App.vue',
				onFilesChange
			}
		});
		await nextTick();
		await wrapper.find('[data-filename="App.vue"]').trigger('dblclick');
		await wrapper.find('.docs-playground-editor__filename').trigger('click');
		await wrapper.find('.docs-playground-editor__filename').trigger('dblclick');
		await wrapper.find('.docs-playground-editor__filename').setValue('Root.vue');
		await wrapper.find('.docs-playground-editor__filename').trigger('keydown', { key: 'Enter' });
		expect(onFilesChange).toHaveBeenLastCalledWith(
			expect.objectContaining({ 'Root.vue': '<template />' }),
			'Root.vue',
			{ type: 'rename', filename: 'Root.vue', previousFilename: 'App.vue' }
		);

		await wrapper.find('button[title="新建文件"]').trigger('click');
		expect(onFilesChange.mock.calls.at(-1)?.[0]['comp2.vue']).toContain('<slot />');
	});

	it('prevents deleting the entry', async () => {
		const onActiveChange = vi.fn();
		const wrapper = mount(EditorWrapper, {
			props: {
				files: { 'App.vue': '<template />', 'util.ts': '' },
				entry: 'App.vue',
				onActiveChange
			}
		});
		await nextTick();
		expect(wrapper.find('button[title="入口文件不能删除"]').attributes('disabled')).toBeDefined();
		const utilPopconfirm = wrapper.findComponent({ name: 'Popconfirm' });
		expect(utilPopconfirm.props('portal')).toBe(true);
		await utilPopconfirm.find('button[title="删除文件"]').trigger('click');
		expect(utilPopconfirm.emitted('trigger')).toHaveLength(1);
		expect(onActiveChange).not.toHaveBeenCalled();
	});

	it('returns to the entry after confirming deletion of the active file', async () => {
		const onFilesChange = vi.fn();
		const onActiveChange = vi.fn();
		const wrapper = mount(EditorWrapper, {
			props: {
				files: { 'App.vue': '<template />', 'util.ts': '' },
				entry: 'App.vue',
				onFilesChange,
				onActiveChange
			}
		});
		await nextTick();
		await wrapper.find('[data-filename="util.ts"]').trigger('click');
		await wrapper.findComponent({ name: 'Popconfirm' }).vm.$emit('ok');
		expect(onFilesChange).toHaveBeenLastCalledWith(
			{ 'App.vue': '<template />' },
			'App.vue',
			{ type: 'delete', filename: 'util.ts' }
		);
		expect(onActiveChange).toHaveBeenLastCalledWith('App.vue');
	});

	it.each([
		['', '请输入文件名'],
		['/root.vue', '相对 POSIX'],
		['bad\\file.vue', '相对 POSIX'],
		['notes.txt', '不支持'],
		['Other.vue', '已存在']
	])('rejects invalid filename %s', async (filename, message) => {
		const wrapper = mount(EditorWrapper, {
			props: {
				files: { 'App.vue': '<template />', 'Other.vue': '<template />' },
				entry: 'App.vue'
			}
		});
		await nextTick();
		await wrapper.find('[data-filename="App.vue"]').trigger('dblclick');
		await wrapper.find('.docs-playground-editor__filename').setValue(filename);
		await wrapper.find('.docs-playground-editor__filename').trigger('blur');
		expect(messageError).toHaveBeenLastCalledWith(expect.stringContaining(message));
		expect(wrapper.find('.docs-playground-editor__error').exists()).toBe(false);
	});

	it('shows code errors inside the editor', async () => {
		const wrapper = mount(EditorWrapper, {
			props: {
				files: { 'App.vue': '<template>' },
				entry: 'App.vue',
				getCodeErrors: () => ['Element is missing end tag.', new Error('Unexpected token')]
			}
		});
		await nextTick();
		expect(wrapper.find('.docs-playground-editor__error').text())
			.toContain('Element is missing end tag.\nUnexpected token');
	});

	it('cancels filename editing', async () => {
		const onFilesChange = vi.fn();
		const wrapper = mount(EditorWrapper, {
			props: {
				files: { 'App.vue': '<template />', 'util.js': '' },
				entry: 'App.vue',
				onFilesChange
			}
		});
		await nextTick();
		await wrapper.find('[data-filename="util.js"]').trigger('dblclick');
		await wrapper.find('.docs-playground-editor__filename').trigger('keydown', { key: 'Escape' });
		expect(wrapper.find('.docs-playground-editor__filename').exists()).toBe(false);
		expect(onFilesChange).not.toHaveBeenCalled();
	});

	it('exports the editor portal', async () => {
		const { Editor } = await import('../src/editor');
		expect(Editor).toBeTruthy();
	});

	it('handles a missing mount target without leaking resources', async () => {
		const wrapper = mount(EditorWrapper, {
			props: { value: 'plain javascript' },
			global: { stubs: { TransitionFade: true } }
		});
		await nextTick();
		wrapper.unmount();
	});
});
