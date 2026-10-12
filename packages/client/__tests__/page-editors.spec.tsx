// @vitest-environment jsdom

import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { defineComponent, nextTick, ref } from 'vue';
import { EditorView } from 'codemirror';
import SourceEditor from '../src/pages/markdown-editor/components/source-editor.vue';
import JsonEditor from '../src/pages/raw-editor/components/json-editor.vue';

enableAutoUnmount(afterEach);
vi.stubGlobal('requestAnimationFrame', () => 1);
vi.stubGlobal('cancelAnimationFrame', () => {});
vi.mock('@deot/vc', () => ({
	Scroller: defineComponent({
		name: 'Scroller', emits: ['scroll'],
		setup: (_, { slots, expose, emit }) => {
			const element = ref<HTMLElement>();
			expose({ setScrollTop: (top: number) => { if (element.value) element.value.scrollTop = top; } });
			return () => <div ref={element} onScroll={() => emit('scroll')}>{slots.default?.()}</div>;
		}
	})
}));
vi.mock('../src/modules/settings', async () => {
	const { ref: themeRef } = await import('vue');
	return { Theme: { current: themeRef('light') } };
});

describe.each([
	{ name: 'Markdown source', component: SourceEditor, initial: '# Initial', replacement: '# Remote', edited: '# Edited' },
	{ name: 'JSON', component: JsonEditor, initial: '{"initial":true}', replacement: '[1,2]', edited: '{"edited":true}' }
])('$name editor', ({ component, initial, replacement, edited }) => {
	it('reflects external content and emits only user document changes', async () => {
		const wrapper = mount(component, { props: { modelValue: initial, label: 'Source' }, attachTo: document.body });
		const content = wrapper.find('.cm-content');
		const view = EditorView.findFromDOM(content.element as HTMLElement)!;
		expect(view.state.doc.toString()).toBe(initial);
		expect(content.attributes('aria-label')).toBe('Source');
		await wrapper.setProps({ modelValue: replacement, label: 'Updated source' });
		expect(view.state.doc.toString()).toBe(replacement);
		expect(content.attributes('aria-label')).toBe('Updated source');
		expect(wrapper.emitted('update:modelValue')).toBeUndefined();
		view.dispatch({ selection: { anchor: 1 } });
		expect(wrapper.emitted('update:modelValue')).toBeUndefined();
		view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: edited } });
		expect(wrapper.emitted('update:modelValue')).toEqual([[edited]]);
		await wrapper.setProps({ modelValue: edited });
		expect(wrapper.emitted('update:modelValue')).toEqual([[edited]]);
		const destroy = vi.spyOn(view, 'destroy');
		wrapper.unmount();
		expect(destroy).toHaveBeenCalledOnce();
	});

	it('updates the CodeMirror theme without replacing its document', async () => {
		const { Theme } = await import('../src/modules/settings');
		const current = Theme.current as { value: string };
		current.value = 'light';
		const wrapper = mount(component, { props: { modelValue: initial, label: 'Source' } });
		const view = EditorView.findFromDOM(wrapper.find('.cm-content').element as HTMLElement)!;
		expect(view.state.facet(EditorView.darkTheme)).toBe(false);
		current.value = 'dark';
		await nextTick();
		expect(view.state.facet(EditorView.darkTheme)).toBe(true);
		expect(view.state.doc.toString()).toBe(initial);
		expect(wrapper.emitted('update:modelValue')).toBeUndefined();
		current.value = 'light';
		await flushPromises();
		expect(view.state.facet(EditorView.darkTheme)).toBe(false);
	});
});

it('uses the Markdown source Scroller for scroll events and position updates', async () => {
	const wrapper = mount(SourceEditor, { props: { modelValue: '# Source', label: 'Source' } });
	expect(wrapper.vm.getScrollElement()).toBe(wrapper.element);
	wrapper.vm.setScrollTop(120);
	expect(wrapper.element.scrollTop).toBe(120);
	await wrapper.trigger('scroll');
	expect(wrapper.emitted('scroll')).toHaveLength(1);
});
