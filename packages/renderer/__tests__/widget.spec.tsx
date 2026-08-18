// @vitest-environment jsdom

import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';
import {
	createEmptyRendererDocument,
	createRendererModuleCatalog,
	defineRendererModule
} from '../src';
import type { Component } from 'vue';
import type { RendererModuleContext, RendererWidgetPreset } from '../src';
import Widget from '../src/widget/index.vue';
import { RENDERER_WIDGET_MIME } from '../src/widget/constants';

const Viewer = defineComponent(() => () => h('div'));
const Editor = defineComponent(() => () => h('div'));
const context: RendererModuleContext = {
	scene: 'combo',
	frameMode: 'sortable',
	readonly: false,
	lang: 'en-US'
};
const module = (type: string, value: {
	label?: string;
	category?: string;
	visible?: boolean;
	component?: Component;
	presets?: RendererWidgetPreset[];
	maxInstances?: number;
	draggable?: boolean;
} = {}) => defineRendererModule({
	identity: { type, version: 1, label: value.label || type, category: value.category || 'Group' },
	widget: {
		visible: value.visible,
		component: value.component,
		presets: value.presets
	},
	data: { create: () => ({}) },
	viewer: Viewer,
	editor: Editor,
	frames: {
		sortable: { maxInstances: value.maxInstances },
		...(value.draggable
			? {
					draggable: {
						initialPlacement: () => ({ x: 0, y: 0, width: 100, height: 100, rotate: 0, zIndex: 1 })
					}
				}
			: {})
	}
});

describe('renderer Widget', () => {
	it('renders instance-local modules, previews and stable preset intents', async () => {
		const Icon = defineComponent(() => () => h('b', 'Icon preview'));
		const Preview = defineComponent(() => () => h('i', 'Object preview'));
		const definitions = [
			module('plain', { component: Icon, label: 'Plain', category: 'Basics' }),
			module('preset', {
				label: 'Preset module',
				category: 'Basics',
				presets: [
					{ key: 'object', label: 'Object', preview: Preview },
					{ key: 'image', label: 'Image', preview: '/preview.png' },
					{ key: 'label', label: { 'en-US': 'Text preview', 'zh-CN': '文字预览' } }
				]
			}),
			module('hidden', { visible: false }),
			module('free-only', { draggable: true, visible: false })
		];
		const document = createEmptyRendererDocument('sortable');
		const wrapper = mount(Widget, {
			props: {
				catalog: createRendererModuleCatalog(definitions),
				mode: 'sortable',
				context,
				document
			}
		});
		await flushPromises();
		expect(wrapper.text()).toContain('Icon preview');
		expect(wrapper.text()).toContain('Object preview');
		expect(wrapper.text()).toContain('Text preview');
		expect(wrapper.text()).toContain('Drag modules below onto the canvas to place them');
		expect(wrapper.find('img[src="/preview.png"]').exists()).toBe(true);
		expect(wrapper.text()).not.toContain('hidden');

		expect(wrapper.find('.docs-renderer-widget__item .docs-renderer-widget__preview').exists()).toBe(true);
		expect(wrapper.findAll('.docs-renderer-widget__label').map(item => item.text())).toEqual(expect.arrayContaining(['Plain', 'Object', 'Image', 'Text preview']));
		expect(wrapper.find('.docs-renderer-widget__group').exists()).toBe(true);
		expect(wrapper.find('.docs-renderer-widget__icon-warn').exists()).toBe(true);
		await wrapper.get('.docs-renderer-widget__tip-close').trigger('click');
		expect(wrapper.find('.docs-renderer-widget__tip').exists()).toBe(false);
		expect(wrapper.find('.docs-renderer-widget__icon-warn').exists()).toBe(false);
		expect(wrapper.get('.docs-renderer-widget__tab.is-active').text()).toBe('Basics');

		await wrapper.get('.docs-renderer-widget__title.is-click').trigger('click');
		expect(wrapper.find('.docs-renderer-widget__presets').exists()).toBe(false);
		await wrapper.get('.docs-renderer-widget__title.is-click').trigger('click');
		expect(wrapper.find('.docs-renderer-widget__presets').exists()).toBe(true);

		const buttons = wrapper.findAll('.docs-renderer-widget__item');
		await buttons.find(button => button.text().includes('Icon preview'))?.trigger('click');
		await buttons.find(button => button.text().includes('Object preview'))?.trigger('click');
		expect(wrapper.emitted('create')).toEqual([
			[{ type: 'plain' }],
			[{ type: 'preset', presetKey: 'object' }]
		]);

		const dataTransfer = {
			setData: vi.fn(),
			effectAllowed: '',
			setDragImage: vi.fn()
		};
		await buttons.find(button => button.text().includes('Text preview'))?.trigger('dragstart', { dataTransfer });
		expect(dataTransfer.setData).toHaveBeenCalledWith(
			RENDERER_WIDGET_MIME,
			JSON.stringify({ type: 'preset', presetKey: 'label' })
		);
		expect(dataTransfer.effectAllowed).toBe('copy');
		expect(dataTransfer.setDragImage).toHaveBeenCalled();
		await buttons.find(button => button.text().includes('Text preview'))?.trigger('dragend');
	});

	it('switches category tabs without losing the current module list', async () => {
		const definitions = [
			module('plain', { label: 'Plain', category: 'Basics' }),
			module('other', { label: 'Other', category: 'Extra' })
		];
		const wrapper = mount(Widget, {
			props: {
				catalog: createRendererModuleCatalog(definitions),
				mode: 'sortable',
				context,
				document: createEmptyRendererDocument('sortable')
			}
		});
		await flushPromises();
		expect(wrapper.findAll('.docs-renderer-widget__tab')).toHaveLength(2);
		expect(wrapper.text()).toContain('Plain');
		expect(wrapper.text()).not.toContain('Other');
		await wrapper.findAll('.docs-renderer-widget__tab').find(tab => tab.text() === 'Extra')?.trigger('click');
		expect(wrapper.text()).toContain('Other');
		expect(wrapper.text()).not.toContain('Plain');
	});

	it('disables maxed modules and rejects their drag payloads', async () => {
		const limited = module('limited', { maxInstances: 1 });
		const document = createEmptyRendererDocument('sortable');
		document.blocks.push({
			id: 'limited',
			module: { type: 'limited', version: 1, props: {} },
			appearance: { marginTop: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 }
		});
		const wrapper = mount(Widget, {
			props: {
				catalog: createRendererModuleCatalog([limited]),
				mode: 'sortable',
				context,
				document
			}
		});
		await flushPromises();
		const button = wrapper.get('.docs-renderer-widget__item');
		expect(button.attributes('disabled')).toBeDefined();
		const dataTransfer = { setData: vi.fn(), effectAllowed: '' };
		const event = await button.trigger('dragstart', { dataTransfer });
		expect(dataTransfer.setData).not.toHaveBeenCalled();
		expect(event).toBeUndefined();
	});
});
