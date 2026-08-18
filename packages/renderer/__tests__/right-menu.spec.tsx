// @vitest-environment jsdom

import { mount } from '@vue/test-utils';
import RightMenu from '../src/frame/draggable/right-menu/index.vue';
import { createRightMenuPortal } from '../src/frame/draggable/right-menu';
import { RENDERER_RIGHT_MENU } from '../src/frame/draggable/right-menu/constants';

describe('renderer right menu', () => {
	it('creates a portal handle without opening it', () => {
		const portal = createRightMenuPortal();
		expect(typeof portal.popup).toBe('function');
	});
	it('emits the chosen action and flips lock label', async () => {
		const event = { clientX: 80, clientY: 40, target: document.body };
		const wrapper = mount(RightMenu, {
			props: {
				event,
				items: [RENDERER_RIGHT_MENU.COPY, RENDERER_RIGHT_MENU.LOCK],
				locked: true,
				theme: 'light'
			}
		});
		expect(wrapper.attributes('data-vc-theme')).toBe('light');
		expect(wrapper.text()).toContain('Unlock');
		await wrapper.findAll('button').at(0)?.trigger('click');
		expect(wrapper.emitted('portal-fulfilled')?.[0]).toEqual([RENDERER_RIGHT_MENU.COPY]);
		wrapper.unmount();
	});

	it('marks grouped and destructive items', () => {
		const event = { clientX: 80, clientY: 40, target: document.body };
		const wrapper = mount(RightMenu, {
			props: {
				event,
				items: [
					RENDERER_RIGHT_MENU.TOP,
					RENDERER_RIGHT_MENU.DELETE,
					RENDERER_RIGHT_MENU.COPY
				],
				theme: 'dark'
			}
		});
		const buttons = wrapper.findAll('button');
		expect(wrapper.attributes('data-vc-theme')).toBe('dark');
		expect(buttons.at(0)?.classes()).not.toContain('is-divided');
		expect(buttons.at(1)?.classes()).toEqual(expect.arrayContaining(['is-divided', 'is-danger']));
		expect(buttons.at(2)?.classes()).toContain('is-divided');
		expect(buttons.at(2)?.classes()).not.toContain('is-danger');
		wrapper.unmount();
	});

	it('rejects clicks outside the menu', async () => {
		const event = { clientX: 80, clientY: window.innerHeight - 10, target: document.body };
		const wrapper = mount(RightMenu, {
			props: {
				event,
				items: [RENDERER_RIGHT_MENU.PASTE]
			}
		});
		await new Promise(resolve => setTimeout(resolve, 0));
		document.documentElement.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(wrapper.emitted('portal-rejected')).toHaveLength(1);
		wrapper.unmount();
	});
});
