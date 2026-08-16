// @vitest-environment jsdom

import { defineComponent, h } from 'vue';
import { flushPromises, mount } from '@vue/test-utils';
import { createEmptyRendererDocument } from '../src';
import type { RendererModuleContext, RendererSortableNode } from '../src';
import Paint from '../src/modules/sortable/area/paint.vue';
import AreaEditor from '../src/modules/sortable/area/editor.vue';
import { AreaModule } from '../src/modules/sortable/area';
import { toRecord } from '../src/modules/shared/utils';
import {
	AREA_ZONE_MAX,
	applyAreaZoneDelta,
	containAreaZone,
	createAreaZone,
	normalizeAreaZone,
	normalizeAreaZones,
	validateAreaZones
} from '../src/modules/sortable/area/zones';

const { popupMock } = vi.hoisted(() => ({
	popupMock: vi.fn()
}));
vi.mock('../src/modules/sortable/area/popup', () => ({
	createAreaPaintPortal: () => ({ popup: popupMock })
}));

const moduleContext: RendererModuleContext = {
	scene: 'combo',
	frameMode: 'sortable',
	readonly: false,
	lang: 'en-US'
};
const area = AreaModule;
const appearance = { marginTop: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 };
const node = (props: object): RendererSortableNode => ({
	id: 'area',
	module: { type: 'area', version: 1, props: toRecord(props) },
	appearance
});
const ModalStub = defineComponent({
	setup(_, { slots }) {
		return () => h('div', { class: 'modal-stub' }, [slots.default?.(), slots.footer?.()]);
	}
});

describe('sortable area module', () => {
	it('normalizes wya-vm field names and keeps zones inside the image', () => {
		expect(normalizeAreaZones({ length: 1 })).toEqual([]);
		expect(normalizeAreaZone({
			x: -20, y: 90, w: 40, h: 30, z: 2, route: '/guide', name: 'Guide'
		})).toEqual({
			x: 0, y: 70, width: 40, height: 30, zIndex: 2, to: '/guide', label: 'Guide'
		});
		expect(containAreaZone(createAreaZone(0)).width).toBeGreaterThanOrEqual(4);
		expect(applyAreaZoneDelta(
			{ x: 10, y: 10, width: 20, height: 20, zIndex: 1, to: '', label: '' },
			'se',
			10,
			5
		)).toEqual(expect.objectContaining({ width: 30, height: 25 }));
		expect(applyAreaZoneDelta(
			{ x: 10, y: 10, width: 20, height: 20, zIndex: 1, to: '', label: '' },
			'move',
			90,
			90
		)).toEqual(expect.objectContaining({ x: 80, y: 80 }));
		const origin = { x: 20, y: 20, width: 30, height: 24, zIndex: 1, to: '', label: '' };
		expect(applyAreaZoneDelta(origin, 'n', 0, -4)).toEqual(expect.objectContaining({ y: 16, height: 28 }));
		expect(applyAreaZoneDelta(origin, 's', 0, 4)).toEqual(expect.objectContaining({ height: 28 }));
		expect(applyAreaZoneDelta(origin, 'e', 4, 0)).toEqual(expect.objectContaining({ width: 34 }));
		expect(applyAreaZoneDelta(origin, 'w', -4, 0)).toEqual(expect.objectContaining({ x: 16, width: 34 }));
		expect(applyAreaZoneDelta(origin, 'ne', 4, -4)).toEqual(expect.objectContaining({ y: 16, width: 34, height: 28 }));
		expect(applyAreaZoneDelta(origin, 'nw', -4, -4)).toEqual(expect.objectContaining({ x: 16, y: 16, width: 34, height: 28 }));
		expect(applyAreaZoneDelta(origin, 'sw', -4, 4)).toEqual(expect.objectContaining({ x: 16, width: 34, height: 28 }));
		expect(applyAreaZoneDelta(origin, 'move', 0, 0)).toEqual(expect.objectContaining({ x: 20, y: 20 }));
		expect(validateAreaZones(Array.from({ length: AREA_ZONE_MAX + 1 }, () => createAreaZone(0))))
			.toContainEqual(expect.objectContaining({ code: 'items.max' }));
		expect(normalizeAreaZones(Array.from({ length: AREA_ZONE_MAX + 3 }, () => ({})))).toHaveLength(AREA_ZONE_MAX);
	});

	it('requires an image and rejects unsafe hotspot links', () => {
		const empty = area.data.normalize?.({});
		expect(empty).toEqual({ src: '', alt: '', areas: [] });
		expect(area.data.validate?.(empty!)).toContainEqual(expect.objectContaining({ code: 'area.src.required' }));
		const imported = area.data.normalize?.({
			src: './map.png',
			list: [{ x: 8, y: 8, width: 20, height: 20, to: 'javascript:alert(1)' }]
		});
		expect(imported?.areas[0].to).toBe('javascript:alert(1)');
		expect(area.data.validate?.(imported!)).toContainEqual(expect.objectContaining({ code: 'area.target.unsafe' }));
		expect(area.integrations?.collectResources?.({ src: './map.png' } as never))
			.toEqual([{ type: 'module', source: './map.png' }]);
		expect(area.frames.sortable).toBeDefined();
		expect(area.frames.draggable).toBeUndefined();
	});

	it('shows dashed labels while editing and navigates published hotspots', async () => {
		const navigate = vi.fn();
		const resolveLink = vi.fn((value: string) => `/resolved${value}`);
		const value = {
			src: 'https://example.com/map.png',
			alt: 'Map',
			areas: [{ x: 10, y: 20, width: 30, height: 25, zIndex: 2, to: '/guide', label: 'Guide' }]
		};
		const editing = mount(area.viewer, {
			props: { node: node(value), context: moduleContext }
		});
		await flushPromises();
		expect(editing.classes()).toContain('is-editing');
		expect(editing.get('.docs-renderer-area__label').text()).toBe('Guide');
		expect(editing.find('a').exists()).toBe(false);
		await editing.get('.docs-renderer-area__zone').trigger('click');
		expect(navigate).not.toHaveBeenCalled();
		editing.unmount();

		const published = mount(area.viewer, {
			props: {
				node: node(value),
				context: {
					...moduleContext,
					scene: 'renderer',
					readonly: true,
					services: { navigate, resolveLink }
				}
			}
		});
		await flushPromises();
		expect(published.find('.docs-renderer-area__label').exists()).toBe(false);
		expect(published.get('a').attributes('href')).toBe('/resolved/guide');
		await published.get('a').trigger('click');
		expect(navigate).toHaveBeenCalledWith('/guide');
		published.unmount();
	});

	it('keeps draw-hotspots disabled until a source exists and paints new zones', async () => {
		const created = area.data.create({
			frameMode: 'sortable',
			index: 0,
			document: createEmptyRendererDocument('sortable'),
			context: moduleContext
		});
		const editor = mount(area.editor, {
			props: { node: node(created), modelValue: created, context: moduleContext }
		});
		await flushPromises();
		expect(editor.get('.docs-renderer-area-editor__paint').attributes('disabled')).toBeDefined();
		editor.unmount();

		const paint = mount(Paint, {
			props: {
				src: 'data:image/png;base64,iVBORw0KGgo=',
				areas: []
			},
			global: { stubs: { Modal: ModalStub } }
		});
		await flushPromises();
		await paint.get('.docs-renderer-area-paint__add').trigger('click');
		expect(paint.findAll('.docs-renderer-area-paint__zone')).toHaveLength(1);
		await paint.get('.docs-renderer-area-paint__apply').trigger('click');
		expect(paint.emitted('portal-fulfilled')?.[0]?.[0]).toEqual([
			expect.objectContaining({ width: 24, height: 18, to: '' })
		]);
		paint.unmount();
		const again = mount(Paint, {
			props: {
				src: 'data:image/png;base64,iVBORw0KGgo=',
				areas: [{ x: 10, y: 10, width: 20, height: 20, zIndex: 1, to: '/a', label: 'A' }]
			},
			global: { stubs: { Modal: ModalStub } }
		});
		await flushPromises();
		expect(again.findAll('.docs-renderer-area-paint__zone')).toHaveLength(1);
		await again.get('.docs-renderer-area-paint__remove').trigger('click');
		expect(again.findAll('.docs-renderer-area-paint__zone')).toHaveLength(0);
		await again.get('.docs-renderer-area-paint__cancel').trigger('click');
		expect(again.emitted('portal-rejected')).toHaveLength(1);
		again.unmount();
	});

	it('writes hotspot fields and applies painted zones from the portal', async () => {
		popupMock.mockReset();
		popupMock.mockResolvedValue([
			{ x: 8, y: 8, width: 20, height: 20, zIndex: 1, to: '/b', label: 'B' }
		]);
		const value = {
			src: 'https://example.com/map.png',
			alt: 'Map',
			areas: [{ x: 10, y: 10, width: 20, height: 20, zIndex: 1, to: '/a', label: 'A' }]
		};
		const editor = mount(AreaEditor, {
			props: { node: node(value), modelValue: value, context: moduleContext }
		});
		await flushPromises();
		expect(editor.text()).toContain('A');
		const inputs = editor.findAllComponents({ name: 'vc-input' });
		inputs[0].vm.$emit('update:modelValue', 'https://example.com/next.png');
		expect(editor.emitted('update:modelValue')?.at(-1)?.[0]).toEqual(expect.objectContaining({
			src: 'https://example.com/next.png'
		}));
		inputs[1].vm.$emit('update:modelValue', 'Hotspot map');
		expect(editor.emitted('update:modelValue')?.at(-1)?.[0]).toEqual(expect.objectContaining({ alt: 'Hotspot map' }));
		inputs[2].vm.$emit('update:modelValue', '/guide');
		expect(editor.emitted('update:modelValue')?.at(-1)?.[0]).toEqual(expect.objectContaining({
			areas: [expect.objectContaining({ to: '/guide' })]
		}));
		await editor.get('.docs-renderer-area-editor__paint').trigger('click');
		await flushPromises();
		expect(popupMock).toHaveBeenCalledWith({
			src: 'https://example.com/map.png',
			areas: [expect.objectContaining({ to: '/a', label: 'A' })]
		});
		expect(editor.emitted('update:modelValue')?.at(-1)?.[0]).toEqual(expect.objectContaining({
			areas: [expect.objectContaining({ to: '/b', label: 'B' })]
		}));
		editor.unmount();
	});

	it('keeps current hotspots when paint resolve fails or the user cancels', async () => {
		popupMock.mockReset();
		const resolveAsset = vi.fn().mockRejectedValue(new Error('offline'));
		const failed = mount(AreaEditor, {
			props: {
				node: node({ src: './map.png', alt: '', areas: [] }),
				modelValue: { src: './map.png', alt: '', areas: [] },
				context: { ...moduleContext, services: { resolveAsset } }
			}
		});
		await failed.get('.docs-renderer-area-editor__paint').trigger('click');
		await flushPromises();
		expect(failed.emitted('update:modelValue')).toBeUndefined();
		failed.unmount();

		popupMock.mockRejectedValue(new Error('cancel'));
		const cancelled = mount(AreaEditor, {
			props: {
				node: node({ src: 'https://example.com/map.png', alt: '', areas: [] }),
				modelValue: { src: 'https://example.com/map.png', alt: '', areas: [] },
				context: moduleContext
			}
		});
		await cancelled.get('.docs-renderer-area-editor__paint').trigger('click');
		await flushPromises();
		expect(cancelled.emitted('update:modelValue')).toBeUndefined();
		cancelled.unmount();
	});

	it('moves a selected hotspot with pointer events on the paint stage', async () => {
		const paint = mount(Paint, {
			props: {
				src: 'data:image/png;base64,iVBORw0KGgo=',
				areas: [{ x: 10, y: 10, width: 20, height: 20, zIndex: 1, to: '/a', label: 'A' }]
			},
			global: { stubs: { Modal: ModalStub } }
		});
		await flushPromises();
		const stage = paint.get('.docs-renderer-area-paint__stage').element as HTMLElement;
		Object.defineProperty(stage, 'getBoundingClientRect', {
			configurable: true,
			value: () => ({
				x: 0, y: 0, left: 0, top: 0, right: 200, bottom: 200, width: 200, height: 200, toJSON() {}
			})
		});
		await paint.get('.docs-renderer-area-paint__item').trigger('click');
		paint.get('.docs-renderer-area-paint__zone').element.dispatchEvent(new PointerEvent('pointerdown', {
			button: 0,
			clientX: 40,
			clientY: 40,
			bubbles: true
		}));
		window.dispatchEvent(new PointerEvent('pointermove', { clientX: 60, clientY: 70 }));
		window.dispatchEvent(new PointerEvent('pointerup'));
		await paint.vm.$nextTick();
		const zone = paint.get('.docs-renderer-area-paint__zone').element as HTMLElement;
		expect(zone.style.left).not.toBe('10%');
		paint.get('.docs-renderer-area-paint__stage').element.dispatchEvent(new PointerEvent('pointerdown', {
			button: 0,
			bubbles: true
		}));
		await paint.vm.$nextTick();
		expect(paint.find('.docs-renderer-area-paint__zone').classes()).not.toContain('is-selected');
		paint.unmount();
	});
});
