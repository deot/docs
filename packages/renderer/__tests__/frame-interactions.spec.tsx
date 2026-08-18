// @vitest-environment jsdom

import { flushPromises, mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import {
	BuiltinModules,
	createEmptyRendererDocument,
	createRendererModuleCatalog
} from '../src';
import type {
	RendererDraggableDocument,
	RendererModuleContext,
	RendererSortableDocument
} from '../src';
import DraggableFrame from '../src/frame/draggable/index.vue';
import SortableFrame from '../src/frame/sortable/index.vue';
import { RendererStore } from '../src/store';
import {
	RENDERER_WIDGET_MIME,
	beginWidgetDrag,
	endWidgetDrag
} from '../src/widget/constants';
import { RENDERER_RIGHT_MENU } from '../src/frame/draggable/right-menu/constants';
import { htmlElementOf } from './fixtures';

const menuPopup = vi.hoisted(() => vi.fn((..._args: unknown[]): Promise<string> => (
	Promise.reject(new Error('dismissed'))
)));
vi.mock('../src/frame/draggable/right-menu', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../src/frame/draggable/right-menu')>();
	return {
		...actual,
		createRightMenuPortal: () => ({ popup: menuPopup })
	};
});

const context = (frameMode: RendererModuleContext['frameMode']): RendererModuleContext => ({
	scene: 'combo',
	frameMode,
	readonly: false
});

const rect = (left: number, top: number, width: number, height: number): DOMRect => ({
	x: left,
	y: top,
	left,
	top,
	width,
	height,
	right: left + width,
	bottom: top + height,
	toJSON: () => ({})
});

const setRect = (element: Element, value: DOMRect) => {
	vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(value);
};

const pointer = (
	target: EventTarget,
	type: string,
	value: Partial<Pick<PointerEvent, 'pointerId' | 'button' | 'clientX' | 'clientY' | 'metaKey' | 'ctrlKey'>> = {}
) => {
	const event = new Event(type, { bubbles: true, cancelable: true });
	Object.entries({
		pointerId: 1,
		button: 0,
		clientX: 0,
		clientY: 0,
		metaKey: false,
		ctrlKey: false,
		...value
	}).forEach(([key, item]) => Object.defineProperty(event, key, { configurable: true, value: item }));
	target.dispatchEvent(event);
	return event;
};

const drag = (
	target: EventTarget,
	type: string,
	value: Record<string, unknown> = {}
) => {
	const event = new Event(type, { bubbles: true, cancelable: true });
	Object.entries({
		clientX: 0,
		clientY: 0,
		...value
	}).forEach(([key, item]) => Object.defineProperty(event, key, { configurable: true, value: item }));
	target.dispatchEvent(event);
	return event;
};

const sortable = (): RendererSortableDocument => {
	const document = createEmptyRendererDocument('sortable');
	document.blocks.push(...['a', 'b', 'c'].map(id => ({
		id,
		module: { type: 'text', version: 1, props: { text: id.toUpperCase() } },
		appearance: {
			marginTop: 0,
			marginBottom: 0,
			paddingTop: 0,
			paddingBottom: 0,
			paddingLeft: 0,
			paddingRight: 0
		}
	})));
	return document;
};

const draggable = (): RendererDraggableDocument => {
	const document = createEmptyRendererDocument('draggable');
	document.blocks.push({
		id: 'a',
		module: { type: 'text', version: 1, props: { text: 'A' } },
		placement: { x: 10, y: 20, width: 100, height: 80, rotate: 0, zIndex: 1 }
	}, {
		id: 'b',
		module: { type: 'title', version: 1, props: { text: 'B', level: 2 } },
		placement: { x: 240, y: 180, width: 120, height: 70, rotate: 0, zIndex: 2 }
	});
	return document;
};

describe('renderer frame interactions', () => {
	beforeAll(() => {
		Object.defineProperty(HTMLElement.prototype, 'setPointerCapture', {
			configurable: true,
			value: vi.fn()
		});
	});

	afterEach(() => {
		endWidgetDrag();
		menuPopup.mockReset();
		menuPopup.mockImplementation(async () => Promise.reject(new Error('dismissed')));
	});

	it('reorders sortable blocks with HTML5 DnD, auto-scrolls and accepts widget drops', async () => {
		const store = new RendererStore(sortable());
		const wrapper = mount(SortableFrame, {
			props: {
				store,
				catalog: createRendererModuleCatalog(BuiltinModules),
				context: context('sortable')
			}
		});
		await flushPromises();
		const items = wrapper.findAll('.docs-renderer-frame__item');
		items.forEach((item, index) => setRect(item.element, rect(0, index * 100, 400, 100)));
		const scroller = htmlElementOf(wrapper.get('.vc-scroller__wrapper'));
		setRect(scroller, rect(0, 0, 500, 300));
		scroller.scrollTop = 30;

		const transfer = { setData: vi.fn(), effectAllowed: '' };
		drag(items[0].element, 'dragstart', { dataTransfer: transfer });
		drag(items[2].element, 'dragenter');
		await flushPromises();
		expect(store.document.blocks.map(node => node.id)).toEqual(['b', 'c', 'a']);
		drag(items[0].element, 'dragend');
		await flushPromises();
		expect(store.document.blocks.map(node => node.id)).toEqual(['b', 'c', 'a']);
		store.undo();
		expect(store.document.blocks.map(node => node.id)).toEqual(['a', 'b', 'c']);
		store.redo();

		beginWidgetDrag({ type: 'title', width: 360, height: 64 });
		const canvas = wrapper.get('.docs-renderer-frame__canvas');
		drag(canvas.element, 'dragover', {
			clientY: 295,
			dataTransfer: { types: [RENDERER_WIDGET_MIME] }
		});
		await nextTick();
		expect(scroller.scrollTop).toBe(48);
		expect(wrapper.find('.docs-renderer-frame__drop-slot').exists()).toBe(true);
		await canvas.trigger('drop', {
			clientY: 0,
			dataTransfer: {
				getData: (type: string) => type === RENDERER_WIDGET_MIME
					? JSON.stringify({ type: 'title' })
					: ''
			}
		});
		expect(wrapper.emitted('create')?.at(-1)?.[0]).toEqual({ type: 'title', index: 0 });

		const count = wrapper.emitted('create')?.length;
		await canvas.trigger('drop', { dataTransfer: { getData: () => '{invalid' } });
		await canvas.trigger('drop', { dataTransfer: { getData: () => '' } });
		expect(wrapper.emitted('create')?.length).toBe(count);
		wrapper.unmount();
	});

	it('debounces sortable live reorders and clears the widget drop slot on leave', async () => {
		const store = new RendererStore(sortable());
		const wrapper = mount(SortableFrame, {
			props: {
				store,
				catalog: createRendererModuleCatalog(BuiltinModules),
				context: context('sortable')
			}
		});
		await flushPromises();
		const items = wrapper.findAll('.docs-renderer-frame__item');
		items.forEach((item, index) => setRect(item.element, rect(0, index * 100, 400, 100)));
		drag(items[0].element, 'dragstart', { dataTransfer: { setData: vi.fn(), effectAllowed: '' } });
		drag(items[2].element, 'dragenter');
		expect(store.document.blocks.map(node => node.id)).toEqual(['b', 'c', 'a']);
		drag(items[1].element, 'dragenter');
		expect(store.document.blocks.map(node => node.id)).toEqual(['b', 'c', 'a']);
		drag(items[0].element, 'dragend');

		beginWidgetDrag({ type: 'title', width: 360, height: 64 });
		const canvas = wrapper.get('.docs-renderer-frame__canvas');
		drag(canvas.element, 'dragenter', { dataTransfer: { types: [RENDERER_WIDGET_MIME] } });
		drag(canvas.element, 'dragover', {
			clientY: 50,
			dataTransfer: { types: [RENDERER_WIDGET_MIME] }
		});
		await nextTick();
		expect(wrapper.find('.docs-renderer-frame__drop-slot').exists()).toBe(true);
		drag(canvas.element, 'dragleave', { relatedTarget: null });
		await nextTick();
		expect(wrapper.find('.docs-renderer-frame__drop-slot').exists()).toBe(false);
		drag(canvas.element, 'dragover', {
			clientY: 50,
			dataTransfer: { types: [RENDERER_WIDGET_MIME] }
		});
		await nextTick();
		drag(canvas.element, 'dragleave', { relatedTarget: canvas.element });
		await nextTick();
		expect(wrapper.find('.docs-renderer-frame__drop-slot').exists()).toBe(true);
		wrapper.unmount();
	});

	it('commits nothing when a sortable drag ends without changing order', async () => {
		vi.useFakeTimers();
		try {
			const store = new RendererStore(sortable());
			const wrapper = mount(SortableFrame, {
				props: {
					store,
					catalog: createRendererModuleCatalog(BuiltinModules),
					context: context('sortable')
				}
			});
			await flushPromises();
			const items = wrapper.findAll('.docs-renderer-frame__item');
			items.forEach((item, index) => setRect(item.element, rect(0, index * 100, 400, 100)));
			drag(items[1].element, 'dragstart', { dataTransfer: { setData: vi.fn(), effectAllowed: '' } });
			drag(items[1].element, 'dragenter');
			drag(items[0].element, 'dragenter');
			expect(store.document.blocks.map(node => node.id)).toEqual(['b', 'a', 'c']);
			vi.advanceTimersByTime(500);
			drag(items[2].element, 'dragenter');
			expect(store.document.blocks.map(node => node.id)).toEqual(['a', 'c', 'b']);
			drag(items[1].element, 'dragend');
			store.undo();
			expect(store.document.blocks.map(node => node.id)).toEqual(['a', 'b', 'c']);
			drag(items[0].element, 'dragstart', { dataTransfer: { setData: vi.fn(), effectAllowed: '' } });
			drag(items[0].element, 'dragend');
			expect(store.canUndo).toBe(false);
			wrapper.unmount();
		} finally {
			vi.useRealTimers();
		}
	});

	it('ignores non-widget drags and keeps empty-canvas placeholder until a widget enters', async () => {
		const store = new RendererStore(createEmptyRendererDocument('sortable'));
		const wrapper = mount(SortableFrame, {
			props: {
				store,
				catalog: createRendererModuleCatalog(BuiltinModules),
				context: context('sortable')
			}
		});
		await flushPromises();
		expect(wrapper.find('.docs-renderer-frame__empty').exists()).toBe(true);
		const canvas = wrapper.get('.docs-renderer-frame__canvas');
		drag(canvas.element, 'dragover', { clientY: 10, dataTransfer: { types: ['text/plain'] } });
		await nextTick();
		expect(wrapper.find('.docs-renderer-frame__drop-slot').exists()).toBe(false);
		beginWidgetDrag({ type: 'text', width: 280, height: 80 });
		drag(canvas.element, 'dragover', {
			clientY: 10,
			dataTransfer: { types: [RENDERER_WIDGET_MIME] }
		});
		await nextTick();
		expect(wrapper.find('.docs-renderer-frame__empty').exists()).toBe(false);
		expect(wrapper.find('.docs-renderer-frame__drop-slot').exists()).toBe(true);
		wrapper.unmount();
	});

	it('keeps interactive controls from starting a sortable drag and deletes from the overlay', async () => {
		const store = new RendererStore(sortable());
		const wrapper = mount(SortableFrame, {
			props: {
				store,
				catalog: createRendererModuleCatalog(BuiltinModules),
				context: context('sortable')
			}
		});
		await flushPromises();
		const first = wrapper.findAll('.docs-renderer-frame__item')[0];
		setRect(first.element, rect(0, 0, 400, 100));
		pointer(wrapper.findAll('.docs-renderer-frame__item')[1].element, 'pointerdown', { clientX: 20, clientY: 120 });
		expect(store.selectedId).toBe('b');
		await first.trigger('click');
		expect(store.selectedId).toBe('a');
		const remove = wrapper.get('.docs-renderer-selection__delete');
		const blocked = new Event('dragstart', { bubbles: true, cancelable: true });
		Object.defineProperty(blocked, 'target', { configurable: true, value: remove.element });
		Object.defineProperty(blocked, 'currentTarget', { configurable: true, value: first.element });
		Object.defineProperty(blocked, 'dataTransfer', {
			configurable: true,
			value: { setData: vi.fn(), effectAllowed: '' }
		});
		first.element.dispatchEvent(blocked);
		expect(blocked.defaultPrevented).toBe(true);
		expect(store.document.blocks.map(node => node.id)).toEqual(['a', 'b', 'c']);
		await remove.trigger('click');
		expect(store.document.blocks.map(node => node.id)).toEqual(['b', 'c']);
		wrapper.unmount();
	});

	it('shows page-level editing after clicking outside a sortable module', async () => {
		const store = new RendererStore(sortable());
		const wrapper = mount(SortableFrame, {
			props: {
				store,
				catalog: createRendererModuleCatalog(BuiltinModules),
				context: context('sortable')
			}
		});
		await flushPromises();
		store.select('a');
		pointer(wrapper.get('.docs-renderer-frame__canvas').element, 'pointerdown');
		expect(store.selectedId).toBeNull();
		pointer(wrapper.findAll('.docs-renderer-frame__item')[1].element, 'pointerdown');
		expect(store.selectedId).toBe('b');
		wrapper.unmount();
	});

	it('keeps sortable editing on a single module even with modifier clicks', async () => {
		const store = new RendererStore(sortable());
		const wrapper = mount(SortableFrame, {
			props: {
				store,
				catalog: createRendererModuleCatalog(BuiltinModules),
				context: context('sortable')
			}
		});
		await flushPromises();
		const items = wrapper.findAll('.docs-renderer-frame__item');
		pointer(items[0].element, 'pointerdown');
		pointer(items[1].element, 'pointerdown', { metaKey: true, ctrlKey: true });
		await flushPromises();
		expect(store.selectedIds).toEqual(['b']);
		expect(wrapper.findAll('.docs-renderer-frame__item.is-selected')).toHaveLength(1);
		expect(wrapper.findAll('.docs-renderer-selection--sortable')).toHaveLength(1);
		await items[0].trigger('click', { metaKey: true });
		expect(store.selectedIds).toEqual(['a']);
		wrapper.unmount();
	});

	it('closes the previous sortable overlay when clicking another module', async () => {
		const store = new RendererStore(sortable());
		const wrapper = mount(SortableFrame, {
			props: {
				store,
				catalog: createRendererModuleCatalog(BuiltinModules),
				context: context('sortable')
			}
		});
		await flushPromises();
		const items = wrapper.findAll('.docs-renderer-frame__item');
		pointer(items[0].element, 'pointerdown');
		await flushPromises();
		pointer(items[1].element, 'pointerdown');
		await flushPromises();
		pointer(items[2].element, 'pointerdown');
		await flushPromises();
		expect(store.selectedId).toBe('c');
		expect(wrapper.findAll('.docs-renderer-frame__item.is-selected')).toHaveLength(1);
		expect(wrapper.findAll('.docs-renderer-selection--sortable')).toHaveLength(1);
		expect(items[0].classes()).not.toContain('is-selected');
		expect(items[1].classes()).not.toContain('is-selected');
		expect(items[2].classes()).toContain('is-selected');
		drag(items[2].element, 'dragstart', { dataTransfer: { setData: vi.fn(), effectAllowed: '' } });
		await flushPromises();
		expect(wrapper.find('.docs-renderer-frame__item.is-dragging').exists()).toBe(false);
		pointer(window, 'pointerup');
		await flushPromises();
		expect(store.selectedId).toBe('c');
		expect(wrapper.findAll('.docs-renderer-selection--sortable')).toHaveLength(1);
		drag(items[0].element, 'dragstart', { dataTransfer: { setData: vi.fn(), effectAllowed: '' } });
		drag(items[2].element, 'dragenter');
		await flushPromises();
		expect(wrapper.find('.docs-renderer-frame__item.is-dragging').exists()).toBe(true);
		drag(items[0].element, 'dragend');
		await flushPromises();
		expect(wrapper.find('.docs-renderer-frame__item.is-dragging').exists()).toBe(false);
		wrapper.unmount();
	});

	it('moves, resizes and rotates a draggable selection as undoable commands', async () => {
		const store = new RendererStore(draggable());
		const wrapper = mount(DraggableFrame, {
			props: {
				store,
				catalog: createRendererModuleCatalog(BuiltinModules),
				context: context('draggable')
			}
		});
		await flushPromises();
		store.updateViewport({ scale: 1, showGuides: false });
		store.select('a');
		await flushPromises();
		setRect(wrapper.get('.docs-renderer-frame__artboard').element, rect(0, 0, 1200, 800));

		pointer(wrapper.get('.docs-renderer-selection--draggable').element, 'pointerdown', { clientX: 20, clientY: 30 });
		pointer(window, 'pointermove', { clientX: 70, clientY: 90 });
		pointer(window, 'pointerup', { clientX: 70, clientY: 90 });
		expect(store.getNode('a')?.placement).toEqual(expect.objectContaining({ x: 60, y: 80 }));
		store.undo();
		expect(store.getNode('a')?.placement).toEqual(expect.objectContaining({ x: 10, y: 20 }));
		store.redo();

		await nextTick();
		pointer(wrapper.get('.docs-renderer-selection__handle--se').element, 'pointerdown', { clientX: 160, clientY: 160 });
		pointer(window, 'pointermove', { clientX: 200, clientY: 190 });
		pointer(window, 'pointerup', { clientX: 200, clientY: 190 });
		expect(store.getNode('a')?.placement?.width).toBeGreaterThan(100);
		expect(store.getNode('a')?.placement?.height).toBeGreaterThan(80);

		const beforeRotate = store.getNode('a')!.placement!.rotate;
		pointer(wrapper.get('.docs-renderer-selection__rotate').element, 'pointerdown', { clientX: 110, clientY: 40 });
		pointer(window, 'pointermove', { clientX: 200, clientY: 160 });
		await nextTick();
		expect(wrapper.find('.docs-renderer-selection__rotate-tip').exists()).toBe(true);
		expect(wrapper.find('.docs-renderer-rotate-hud__deg.is-45').exists()).toBe(true);
		expect(wrapper.find('.docs-renderer-selection__rotate-beam').exists()).toBe(true);
		pointer(window, 'pointerup', { clientX: 200, clientY: 160 });
		expect(store.getNode('a')!.placement!.rotate).not.toBe(beforeRotate);
		wrapper.unmount();
	});

	it('resizes the draggable artboard through the page module handles', async () => {
		const store = new RendererStore(draggable());
		const wrapper = mount(DraggableFrame, {
			props: {
				store,
				catalog: createRendererModuleCatalog(BuiltinModules),
				context: context('draggable')
			}
		});
		await flushPromises();
		await new Promise(resolve => requestAnimationFrame(() => resolve(undefined)));
		store.updateViewport({ scale: 1 });
		await nextTick();
		expect(wrapper.findAll('.docs-renderer-page__handle')).toHaveLength(3);
		pointer(wrapper.get('.docs-renderer-page__handle--se').element, 'pointerdown', { clientX: 1200, clientY: 800 });
		pointer(window, 'pointermove', { clientX: 1240, clientY: 850 });
		pointer(window, 'pointerup', { clientX: 1240, clientY: 850 });
		expect(store.document.layout).toEqual(expect.objectContaining({ width: 1240, height: 850 }));
		store.undo();
		expect(store.document.layout).toEqual(expect.objectContaining({ width: 1200, height: 800 }));
		pointer(wrapper.get('.docs-renderer-page__handle--e').element, 'pointerdown', { clientX: 1200, clientY: 400 });
		pointer(window, 'pointermove', { clientX: 1280, clientY: 400 });
		pointer(window, 'pointerup', { clientX: 1280, clientY: 400 });
		expect(store.document.layout).toEqual(expect.objectContaining({ width: 1280, height: 800 }));
		store.undo();
		pointer(wrapper.get('.docs-renderer-page__handle--s').element, 'pointerdown', { clientX: 600, clientY: 800 });
		pointer(window, 'pointermove', { clientX: 600, clientY: 860 });
		pointer(window, 'pointerup', { clientX: 600, clientY: 860 });
		expect(store.document.layout).toEqual(expect.objectContaining({ width: 1200, height: 860 }));
		wrapper.unmount();
	});

	it('keeps the artboard inset in screen pixels while the scroll range grows with zoom', async () => {
		const store = new RendererStore(draggable());
		const wrapper = mount(DraggableFrame, {
			props: {
				store,
				catalog: createRendererModuleCatalog(BuiltinModules),
				context: context('draggable')
			}
		});
		await flushPromises();
		store.updateViewport({ scale: 1 });
		await nextTick();
		expect(wrapper.get('.docs-renderer-frame__viewport--draggable').attributes('style')).toEqual(
			expect.stringContaining('padding: 20px')
		);
		store.updateViewport({ scale: 1.5 });
		await nextTick();
		const style = wrapper.get('.docs-renderer-frame__viewport--draggable').attributes('style') || '';
		expect(style).toContain('padding: 20px');
		expect(style).toContain('width: 1840px');
		expect(style).toContain('height: 1240px');
		store.updateViewport({ scale: 2 });
		await nextTick();
		const zoomed = wrapper.get('.docs-renderer-frame__viewport--draggable').attributes('style') || '';
		expect(zoomed).toContain('padding: 20px');
		expect(zoomed).toContain('width: 2440px');
		expect(zoomed).toContain('height: 1640px');
		expect(wrapper.get('.docs-renderer-frame__scaled').attributes('style')).toContain('width: 2400px');
		expect(wrapper.get('.docs-renderer-frame__artboard').attributes('style')).toContain('margin: 0');
		wrapper.unmount();
	});

	it('restores transient draggable geometry on pointer cancellation', async () => {
		const store = new RendererStore(draggable());
		const wrapper = mount(DraggableFrame, {
			props: {
				store,
				catalog: createRendererModuleCatalog(BuiltinModules),
				context: context('draggable')
			}
		});
		await flushPromises();
		store.updateViewport({ scale: 1 });
		store.select('a');
		await flushPromises();
		setRect(wrapper.get('.docs-renderer-frame__artboard').element, rect(0, 0, 1200, 800));
		const original = { ...store.getNode('a')!.placement! };
		pointer(wrapper.get('.docs-renderer-selection--draggable').element, 'pointerdown', { clientX: 20, clientY: 30 });
		pointer(window, 'pointermove', { clientX: 100, clientY: 120 });
		pointer(window, 'pointercancel', { clientX: 100, clientY: 120 });
		expect(store.getNode('a')?.placement).toEqual(original);

		pointer(wrapper.get('.docs-renderer-selection__handle--e').element, 'pointerdown', { clientX: 110, clientY: 60 });
		pointer(window, 'pointermove', { clientX: 180, clientY: 60 });
		pointer(window, 'pointercancel', { clientX: 180, clientY: 60 });
		expect(store.getNode('a')?.placement).toEqual(original);
		wrapper.unmount();
	});

	it('marquee-selects nodes, manages guides, shows drop ghosts and accepts free-layout drops', async () => {
		const store = new RendererStore(draggable());
		const wrapper = mount(DraggableFrame, {
			props: {
				store,
				catalog: createRendererModuleCatalog(BuiltinModules),
				context: context('draggable')
			}
		});
		await flushPromises();
		store.updateViewport({ scale: 1 });
		await nextTick();
		const artboard = wrapper.get('.docs-renderer-frame__artboard');
		setRect(artboard.element, rect(0, 0, 1200, 800));
		pointer(artboard.element, 'pointerdown', { clientX: 0, clientY: 0 });
		pointer(window, 'pointermove', { clientX: 180, clientY: 140 });
		await nextTick();
		expect(wrapper.find('.docs-renderer-marquee').exists()).toBe(true);
		pointer(window, 'pointerup', { clientX: 180, clientY: 140 });
		expect(store.selectedIds).toEqual(['a']);

		const topRuler = wrapper.get('.docs-renderer-ruler--top');
		pointer(topRuler.element, 'pointerdown', { clientX: 120, clientY: 10 });
		pointer(window, 'pointermove', { clientX: 160, clientY: 10 });
		pointer(window, 'pointerup', { clientX: 160, clientY: 10 });
		expect(store.viewport.guideX).toEqual([160]);

		beginWidgetDrag({ type: 'image', width: 320, height: 240 });
		drag(artboard.element, 'dragover', {
			clientX: 500,
			clientY: 300,
			dataTransfer: { types: [RENDERER_WIDGET_MIME] }
		});
		await nextTick();
		expect(wrapper.find('.docs-renderer-drop-ghost').exists()).toBe(true);

		await artboard.trigger('drop', {
			clientX: 500,
			clientY: 300,
			dataTransfer: { getData: () => JSON.stringify({ type: 'image' }) }
		});
		expect(wrapper.emitted('create')?.at(-1)?.[0]).toEqual({
			type: 'image',
			index: 2,
			point: { x: 500, y: 300 }
		});
		expect(wrapper.find('.docs-renderer-drop-ghost').exists()).toBe(false);
		await wrapper.get('.docs-renderer-guide--vertical.is-user').trigger('dblclick');
		expect(store.viewport.guideX).toEqual([]);
		const count = wrapper.emitted('create')?.length;
		await artboard.trigger('drop', { dataTransfer: { getData: () => 'bad json' } });
		expect(wrapper.emitted('create')?.length).toBe(count);

		beginWidgetDrag({ type: 'image', width: 320, height: 240 });
		drag(artboard.element, 'dragover', {
			clientX: 400,
			clientY: 200,
			dataTransfer: { types: [RENDERER_WIDGET_MIME] }
		});
		await nextTick();
		expect(wrapper.find('.docs-renderer-drop-ghost').exists()).toBe(true);
		drag(artboard.element, 'dragleave', { relatedTarget: null });
		await nextTick();
		expect(wrapper.find('.docs-renderer-drop-ghost').exists()).toBe(false);

		endWidgetDrag();
		drag(artboard.element, 'dragover', {
			clientX: 240,
			clientY: 180,
			dataTransfer: { types: [RENDERER_WIDGET_MIME] }
		});
		await nextTick();
		const ghost = wrapper.get('.docs-renderer-drop-ghost');
		expect(ghost.attributes('style')).toContain('200px');
		expect(ghost.attributes('style')).toContain('120px');
		wrapper.unmount();
	});

	it('creates a persistent selection group from a two-module marquee', async () => {
		const store = new RendererStore(draggable());
		const wrapper = mount(DraggableFrame, {
			props: {
				store,
				catalog: createRendererModuleCatalog(BuiltinModules),
				context: context('draggable')
			}
		});
		await flushPromises();
		store.updateViewport({ scale: 1 });
		await nextTick();
		const artboard = wrapper.get('.docs-renderer-frame__artboard');
		setRect(artboard.element, rect(0, 0, 1200, 800));
		pointer(artboard.element, 'pointerdown', { clientX: 0, clientY: 0 });
		pointer(window, 'pointermove', { clientX: 400, clientY: 280 });
		pointer(window, 'pointerup', { clientX: 400, clientY: 280 });
		await flushPromises();
		const group = store.document.blocks.find(node => node.module.type === 'selection');
		expect(group?.module.props).toEqual({ members: ['a', 'b'] });
		expect(store.selectedIds).toEqual([group?.id]);
		expect(wrapper.find('.docs-renderer-selection-group').exists()).toBe(true);
		wrapper.unmount();
	});

	it('uses the thumbnail to navigate the Scroller viewport', async () => {
		const store = new RendererStore(draggable());
		const wrapper = mount(DraggableFrame, {
			props: {
				store,
				catalog: createRendererModuleCatalog(BuiltinModules),
				context: context('draggable')
			}
		});
		await flushPromises();
		store.updateViewport({ scale: 2 });
		const scroller = htmlElementOf(wrapper.get('.vc-scroller__wrapper'));
		Object.defineProperties(scroller, {
			clientWidth: { configurable: true, value: 400 },
			clientHeight: { configurable: true, value: 300 }
		});
		const scrollTo = vi.fn();
		scroller.scrollTo = scrollTo;
		const thumbnail = wrapper.get('.docs-renderer-thumbnail');
		setRect(thumbnail.element, rect(10, 20, 176, 116));
		await thumbnail.trigger('click', { clientX: 98, clientY: 78 });
		expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'smooth' }));

		Object.defineProperties(scroller, {
			scrollWidth: { configurable: true, value: 2400 },
			scrollHeight: { configurable: true, value: 1600 },
			scrollLeft: { configurable: true, writable: true, value: 0 },
			scrollTop: { configurable: true, writable: true, value: 0 }
		});
		await wrapper.get('.docs-renderer-thumbnail__visible').trigger('mousedown', { clientX: 20, clientY: 20 });
		window.dispatchEvent(new MouseEvent('mousemove', { clientX: 40, clientY: 50, bubbles: true }));
		window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
		expect(scroller.scrollLeft).toBeGreaterThan(0);
		expect(scroller.scrollTop).toBeGreaterThan(0);

		Object.defineProperties(scroller, {
			scrollLeft: { configurable: true, writable: true, value: 48 },
			scrollTop: { configurable: true, writable: true, value: 96 }
		});
		scroller.dispatchEvent(new Event('scroll'));
		await nextTick();
		expect(store.viewport.scrollLeft).toBe(48);
		expect(store.viewport.scrollTop).toBe(96);
		wrapper.unmount();
	});

	it('toggles free-layout aids and deletes from the overlay', async () => {
		const store = new RendererStore(draggable());
		const wrapper = mount(DraggableFrame, {
			props: {
				store,
				catalog: createRendererModuleCatalog(BuiltinModules),
				context: context('draggable')
			}
		});
		await flushPromises();
		expect(wrapper.find('.docs-renderer-ruler__origin').exists()).toBe(true);
		await wrapper.get('.docs-renderer-ruler__origin').trigger('click');
		expect(store.viewport.showGuides).toBe(false);
		await wrapper.get('.docs-renderer-ruler__origin').trigger('click');
		expect(store.viewport.showGuides).toBe(true);
		await wrapper.findAll('.docs-renderer-frame__controls button')
			.find(button => button.text() === 'Grid')?.trigger('click');
		expect(wrapper.find('.docs-renderer-grid-lines').exists()).toBe(true);
		for (const label of ['Ruler', 'Guides', 'Map']) {
			await wrapper.findAll('.docs-renderer-frame__controls button')
				.find(button => button.text() === label)?.trigger('click');
		}
		expect(store.viewport.showRuler).toBe(false);
		expect(store.viewport.showGuides).toBe(false);
		expect(store.viewport.showThumbnail).toBe(false);
		expect(wrapper.find('.docs-renderer-layers').exists()).toBe(false);

		store.select('b');
		await flushPromises();
		pointer(wrapper.get('.docs-renderer-frame__inner').element, 'pointerdown');
		expect(store.selectedId).toBeNull();
		store.select('b');
		await flushPromises();
		await wrapper.get('.docs-renderer-selection__delete').trigger('click');
		expect(store.getNode('b')).toBeUndefined();
		wrapper.unmount();
	});

	it('creates and moves a horizontal user guide from the left ruler', async () => {
		const store = new RendererStore(draggable());
		const wrapper = mount(DraggableFrame, {
			props: {
				store,
				catalog: createRendererModuleCatalog(BuiltinModules),
				context: context('draggable')
			}
		});
		await flushPromises();
		store.updateViewport({ scale: 1 });
		setRect(wrapper.get('.docs-renderer-frame__artboard').element, rect(0, 0, 1200, 800));
		await wrapper.get('.docs-renderer-ruler--top').trigger('mousemove', { clientX: 80, clientY: 10 });
		expect(wrapper.get('.docs-renderer-guide.is-preview').text()).toContain('80');
		await wrapper.get('.docs-renderer-ruler--left').trigger('mousemove', { clientX: 8, clientY: 40 });
		expect(wrapper.get('.docs-renderer-guide.is-preview').text()).toContain('40');
		await wrapper.get('.docs-renderer-ruler--top').trigger('mouseleave');
		expect(wrapper.find('.docs-renderer-guide.is-preview').exists()).toBe(false);

		pointer(wrapper.get('.docs-renderer-ruler--left').element, 'pointerdown', { clientX: 8, clientY: 90 });
		pointer(window, 'pointermove', { clientX: 8, clientY: 130 });
		pointer(window, 'pointerup', { clientX: 8, clientY: 130 });
		expect(store.viewport.guideY).toEqual([130]);
		await nextTick();
		pointer(wrapper.get('.docs-renderer-guide--horizontal.is-user').element, 'pointerdown', { clientY: 130 });
		pointer(window, 'pointermove', { clientY: 160 });
		pointer(window, 'pointerup', { clientY: 160 });
		expect(store.viewport.guideY).toEqual([160]);
		await wrapper.get('.docs-renderer-guide--horizontal.is-user').trigger('dblclick');
		expect(store.viewport.guideY).toEqual([]);
		wrapper.unmount();
	});

	it('applies free-layout context menu actions through the portal', async () => {
		const store = new RendererStore(draggable());
		const wrapper = mount(DraggableFrame, {
			props: {
				store,
				catalog: createRendererModuleCatalog(BuiltinModules),
				context: context('draggable')
			}
		});
		await flushPromises();
		store.updateViewport({ scale: 1 });
		const artboard = wrapper.get('.docs-renderer-frame__artboard');
		setRect(artboard.element, rect(0, 0, 1200, 800));
		menuPopup.mockResolvedValueOnce(RENDERER_RIGHT_MENU.LOCK);
		pointer(wrapper.get('[data-renderer-node-id="a"]').element, 'contextmenu', { clientX: 40, clientY: 50, button: 2 });
		await flushPromises();
		expect(store.getNode('a')?.locked).toBe(true);

		store.select('a');
		await nextTick();
		menuPopup.mockClear();
		menuPopup.mockResolvedValueOnce(RENDERER_RIGHT_MENU.COPY);
		pointer(wrapper.get('.docs-renderer-selection--draggable').element, 'contextmenu', { clientX: 40, clientY: 50, button: 2 });
		await flushPromises();
		expect(menuPopup).toHaveBeenCalled();
		expect(menuPopup.mock.calls.at(-1)?.[0]).toEqual(expect.objectContaining({
			items: expect.arrayContaining([RENDERER_RIGHT_MENU.COPY, RENDERER_RIGHT_MENU.LOCK])
		}));

		store.select('a');
		menuPopup.mockResolvedValueOnce(RENDERER_RIGHT_MENU.COPY);
		pointer(wrapper.get('[data-renderer-node-id="a"]').element, 'contextmenu', { clientX: 40, clientY: 50, button: 2 });
		await flushPromises();
		menuPopup.mockResolvedValueOnce(RENDERER_RIGHT_MENU.PASTE);
		pointer(artboard.element, 'contextmenu', { clientX: 80, clientY: 90, button: 2 });
		await flushPromises();
		expect(store.document.blocks.length).toBeGreaterThan(2);

		store.select('b');
		menuPopup.mockResolvedValueOnce(RENDERER_RIGHT_MENU.TOP);
		pointer(wrapper.get('[data-renderer-node-id="b"]').element, 'contextmenu', { clientX: 260, clientY: 200, button: 2 });
		await flushPromises();
		menuPopup.mockResolvedValueOnce(RENDERER_RIGHT_MENU.BOTTOM);
		pointer(wrapper.get('[data-renderer-node-id="b"]').element, 'contextmenu', { clientX: 260, clientY: 200, button: 2 });
		await flushPromises();
		menuPopup.mockResolvedValueOnce(RENDERER_RIGHT_MENU.UP);
		pointer(wrapper.get('[data-renderer-node-id="b"]').element, 'contextmenu', { clientX: 260, clientY: 200, button: 2 });
		await flushPromises();
		menuPopup.mockResolvedValueOnce(RENDERER_RIGHT_MENU.DOWN);
		pointer(wrapper.get('[data-renderer-node-id="b"]').element, 'contextmenu', { clientX: 260, clientY: 200, button: 2 });
		await flushPromises();
		menuPopup.mockResolvedValueOnce(RENDERER_RIGHT_MENU.DELETE);
		pointer(wrapper.get('[data-renderer-node-id="b"]').element, 'contextmenu', { clientX: 260, clientY: 200, button: 2 });
		await flushPromises();
		expect(store.getNode('b')).toBeUndefined();

		store.createSelectionFromIds(['a', store.document.blocks.map(node => node.id).find(id => id !== 'a')!]);
		const groupId = store.selectedId!;
		menuPopup.mockResolvedValueOnce(RENDERER_RIGHT_MENU.SELECTION);
		pointer(artboard.element, 'contextmenu', { clientX: 20, clientY: 30, button: 2 });
		await flushPromises();
		if (store.getNode(groupId)) {
			store.ungroupNode(groupId);
		}
		wrapper.unmount();
	});
});
