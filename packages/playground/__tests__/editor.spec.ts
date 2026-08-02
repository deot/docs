// @vitest-environment jsdom

import { defineComponent, nextTick } from 'vue';
import { mount } from '@vue/test-utils';
import EditorWrapper from '../src/editor/editor.vue';

const { destroy, focus, listener, dragOff } = vi.hoisted(() => ({
	destroy: vi.fn(), focus: vi.fn(), listener: { callback: undefined as any }, dragOff: vi.fn()
}));

vi.mock('@deot/vc', () => ({
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
vi.mock('@codemirror/lang-javascript', () => ({ javascript: vi.fn(() => 'javascript') }));
vi.mock('@codemirror/lang-vue', () => ({ vue: vi.fn(() => 'vue') }));
vi.mock('@codemirror/view', () => ({ highlightActiveLine: vi.fn(() => 'line') }));
vi.mock('../src/editor/drag', () => ({ Drag: class { off = dragOff; } }));

describe('editor', () => {
	it('creates an editor, reports changes, hides and disposes resources', async () => {
		const onChange = vi.fn();
		const wrapper = mount(EditorWrapper, { props: { value: '<template>ok</template>', onChange } });
		await nextTick();
		expect(focus).toHaveBeenCalled();

		listener.callback({ docChanged: false, state: { doc: { toString: () => 'ignored' } } });
		listener.callback({ docChanged: true, state: { doc: { toString: () => 'changed' } } });
		expect(onChange).toHaveBeenCalledWith('changed');

		await wrapper.find('.docs-playground-editor__header span:last-child').trigger('click');
		expect(wrapper.find('.docs-playground-editor__wrapper').isVisible()).toBe(false);
		wrapper.unmount();
		expect(dragOff).toHaveBeenCalled();
		expect(destroy).toHaveBeenCalled();
	});

	it('handles a missing mount target without creating an editor', async () => {
		const wrapper = mount(EditorWrapper, {
			props: { value: 'plain javascript' },
			global: { stubs: { TransitionFade: true } }
		});
		await nextTick();
		wrapper.unmount();
	});
});
