// @vitest-environment jsdom

import { defineComponent, nextTick } from 'vue';
import { mount } from '@vue/test-utils';
import Playground from '../src/playground.vue';

const { popup, store } = vi.hoisted(() => ({
	popup: vi.fn(),
	store: { activeFile: { code: '' } }
}));

vi.mock('../src/editor', () => ({ Editor: { popup } }));
vi.mock('@deot/vc', () => ({
	Clipboard: defineComponent({ name: 'Clipboard', props: ['value'], template: '<button class="clipboard"><slot /></button>' })
}));
vi.mock('@vue/repl', () => ({
	Sandbox: defineComponent({ name: 'Sandbox', props: ['store', 'clearConsole', 'previewOptions'], template: '<div class="sandbox" />' }),
	useStore: vi.fn((options) => {
		Object.assign(store, { options });
		return store;
	})
}));

describe('Playground', () => {
	beforeEach(() => {
		popup.mockReset();
		store.activeFile.code = '';
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
		expect((store as any).options.template.value.welcomeSFC).toContain('hello');
		expect((store as any).options.builtinImportMap.value.imports.vue).toBe('/vue.js');
		expect((store as any).options.builtinImportMap.value.imports.custom).toBe('/custom.js');
		expect(wrapper.findComponent({ name: 'Sandbox' }).props('previewOptions').headHTML).toContain('@deot/style');
	});

	it('is exported from the package entry', async () => {
		const entry = await import('../src');
		expect(entry.Playground).toBe(Playground);
	});

	it('opens the editor, updates code and emits changes', async () => {
		const wrapper = mount(Playground, { props: { modelValue: 'first' } });
		await wrapper.find('.docs-playground__tools span:last-child').trigger('click');
		const options = popup.mock.calls[0][0];
		expect(options.value).toBe('first');

		options.onChange('second');
		expect(store.activeFile.code).toBe('second');
		expect(wrapper.emitted('update:modelValue')).toEqual([['second']]);
		expect(wrapper.emitted('change')).toEqual([['second']]);

		await wrapper.setProps({ modelValue: 'third' });
		await nextTick();
		expect(store.activeFile.code).toBe('third');
	});

	it('supports a styleless sandbox and default template', () => {
		const wrapper = mount(Playground, { props: { styleless: true } });
		expect(wrapper.find('.docs-playground').exists()).toBe(false);
		expect(wrapper.find('.sandbox').exists()).toBe(true);
		expect((store as any).options.template.value.welcomeSFC).toContain('<slot />');
	});
});
