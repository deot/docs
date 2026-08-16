// @vitest-environment jsdom

import { flushPromises, mount } from '@vue/test-utils';
import { ColorPicker, Input, InputNumber, Select, Switch, Textarea } from '@deot/vc';
import { enUS } from '@deot/docs-locale';
import {
	BuiltinModules,
	createEmptyRendererDocument,
	createRendererModuleCatalog,
	createRendererPageNode,
	type RendererDraggableDocument,
	type RendererModuleContext
} from '../src';
import PropertyEditor from '../src/editor/index.vue';
import JsonPopup from '../src/editor/json/popup';
import ArrayEditor from '../src/editor/array/index.vue';
import ImageSource from '../src/editor/common/image/index.vue';
import NumberEditor from '../src/editor/common/number/index.vue';
import SortableBox from '../src/editor/common/sortable-box/index.vue';
import { toRecord } from '../src/modules/shared/utils';
import PageEditor from '../src/modules/shared/page/editor.vue';
import PreviewPopup from '../src/assist/preview/popup.vue';
import ActionsEditor from '../src/modules/shared/actions/editor.vue';
import FeaturesEditor from '../src/modules/sortable/features/editor.vue';
import HeroEditor from '../src/modules/sortable/hero/editor.vue';
import StepsEditor from '../src/modules/sortable/steps/editor.vue';
import FaqEditor from '../src/modules/sortable/faq/editor.vue';
import CtaEditor from '../src/modules/sortable/cta/editor.vue';
import AdsEditor from '../src/modules/sortable/promo/editor.vue';
import ImageEditor from '../src/modules/shared/image/editor.vue';
import ListEditor from '../src/modules/shared/list/editor.vue';
import SpaceEditor from '../src/modules/sortable/space/editor.vue';
import TextEditor from '../src/modules/shared/text/editor.vue';
import TitleEditor from '../src/modules/shared/title/editor.vue';
import { RendererStore } from '../src/store';

const context: RendererModuleContext = {
	scene: 'combo',
	frameMode: 'sortable',
	readonly: false,
	locale: enUS,
	theme: 'light'
};

describe('renderer editor surfaces', () => {
	it('keeps Slider and numeric input on one normalized value path', async () => {
		const wrapper = mount(NumberEditor, { props: { modelValue: 20, min: 0, max: 40, showSlider: true } });
		const slider = wrapper.findComponent({ name: 'vc-slider' });
		slider.vm.$emit('update:modelValue', 32);
		await wrapper.vm.$nextTick();
		expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([32]);
		slider.vm.$emit('update:modelValue', 80);
		expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([40]);
		wrapper.findComponent({ name: 'vc-input-number' }).vm.$emit('update:modelValue', 1.239);
		expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([1.24]);
		wrapper.findComponent({ name: 'vc-input-number' }).vm.$emit('update:modelValue', 0);
		expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([0]);
		wrapper.findComponent({ name: 'vc-input-number' }).vm.$emit('update:modelValue', undefined);
		expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([0]);
		wrapper.findComponent({ name: 'vc-input-number' }).vm.$emit('update:modelValue', '');
		expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([0]);
	});

	it('treats max width 0 as unset and does not clamp boxed modules to 320', async () => {
		const boxed = mount(SortableBox, {
			props: {
				appearance: {
					marginTop: 0,
					marginBottom: 0,
					paddingTop: 0,
					paddingBottom: 0,
					fullWidth: false,
					maxWidth: 1200
				},
				capability: { maxWidth: 1200 }
			}
		});
		expect(boxed.findComponent(NumberEditor).props('min')).toBe(0);
		expect(boxed.findComponent(NumberEditor).props('modelValue')).toBe(1200);
		boxed.findComponent(NumberEditor).vm.$emit('update:modelValue', 0);
		expect(boxed.emitted('update:appearance')?.at(-1)?.[0]).toEqual({ maxWidth: 0 });
		const unset = mount(SortableBox, {
			props: {
				appearance: {
					marginTop: 0,
					marginBottom: 0,
					paddingTop: 0,
					paddingBottom: 0,
					fullWidth: false,
					maxWidth: 0
				},
				capability: { maxWidth: 1200 }
			}
		});
		expect(unset.findComponent(NumberEditor).props('modelValue')).toBe(0);
		unset.findComponent(Switch).vm.$emit('update:modelValue', false);
		expect(unset.emitted('update:appearance')?.at(-1)?.[0]).toEqual({
			fullWidth: false,
			maxWidth: 0
		});
		const filled = mount(SortableBox, {
			props: {
				appearance: {
					marginTop: 0,
					marginBottom: 0,
					paddingTop: 0,
					paddingBottom: 0,
					fullWidth: true
				},
				capability: { fullWidth: true }
			}
		});
		expect(filled.findComponent(NumberEditor).props('modelValue')).toBe(0);
		filled.findComponent(NumberEditor).vm.$emit('update:modelValue', 0);
		expect(filled.emitted('update:appearance')?.at(-1)?.[0]).toEqual({ maxWidth: 0 });
		filled.findComponent({ name: 'vc-input-number' }).vm.$emit('update:modelValue', undefined);
		expect(filled.findComponent(NumberEditor).emitted('update:modelValue')?.at(-1)).toEqual([0]);
		const filledWithWidth = mount(SortableBox, {
			props: {
				appearance: {
					marginTop: 0,
					marginBottom: 0,
					paddingTop: 0,
					paddingBottom: 0,
					fullWidth: true,
					maxWidth: 1200
				},
				capability: { maxWidth: 1200 }
			}
		});
		filledWithWidth.findComponent({ name: 'vc-input-number' }).vm.$emit('update:modelValue', undefined);
		expect(filledWithWidth.findComponent(NumberEditor).emitted('update:modelValue')?.at(-1)).toEqual([0]);
		expect(filledWithWidth.emitted('update:appearance')?.at(-1)?.[0]).toEqual({ maxWidth: 0 });
	});

	it('uses SortList without leaking temporary row IDs into business JSON', async () => {
		const wrapper = mount(ArrayEditor, {
			props: { modelValue: ['first', 'second'], createItem: () => 'new' }
		});
		const sortList = wrapper.findComponent({ name: 'vc-sort-list' });
		const rows = sortList.props('modelValue') as Array<{ id: string; value: string }>;
		sortList.vm.$emit('change', [...rows].reverse());
		await wrapper.vm.$nextTick();
		expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toEqual(['second', 'first']);
		expect(JSON.stringify(wrapper.emitted('update:modelValue'))).not.toContain(rows[0].id);
	});

	it('adds, edits and removes array items while honoring stable keys and limits', async () => {
		const keyed = mount(ArrayEditor, {
			props: {
				modelValue: [{ key: 'a', value: 1 }],
				itemKey: 'key',
				createItem: () => ({ key: 'b', value: 2 }),
				min: 1,
				max: 2
			}
		});
		await keyed.find('.docs-renderer-array-editor__add').trigger('click');
		expect(keyed.emitted('update:modelValue')?.at(-1)?.[0]).toEqual([
			{ key: 'a', value: 1 },
			{ key: 'b', value: 2 }
		]);
		expect(keyed.find('.docs-renderer-array-editor__add').attributes('disabled')).toBeDefined();
		const rows = keyed.findComponent({ name: 'vc-sort-list' }).props('modelValue') as Array<{ id: string; value: unknown }>;
		await keyed.setProps({ modelValue: [{ key: 'b', value: 3 }, { key: 'a', value: 4 }] });
		const resynced = keyed.findComponent({ name: 'vc-sort-list' }).props('modelValue') as Array<{ id: string; value: unknown }>;
		expect(resynced.map(row => row.id)).toEqual([rows[1].id, rows[0].id]);
		keyed.findComponent({ name: 'vc-sort-list' }).vm.$emit('change', [rows[1], rows[0]]);
		await keyed.vm.$nextTick();
		await keyed.findAll('.docs-renderer-array-editor__item')[0].get('.docs-renderer-array-editor__remove').trigger('click');
		expect((keyed.emitted('update:modelValue')?.at(-1)?.[0] as unknown[])).toHaveLength(1);
		await keyed.get('.docs-renderer-array-editor__item .docs-renderer-array-editor__remove').trigger('click');
		expect((keyed.emitted('update:modelValue')?.at(-1)?.[0] as unknown[])).toHaveLength(1);

		const functional = mount(ArrayEditor, {
			props: {
				modelValue: [{ key: 'a', value: 1 }],
				itemKey: (item: unknown) => (item as { key: string }).key,
				createItem: () => ({ key: 'b', value: 2 }),
				deletable: false,
				reorderable: false
			},
			slots: {
				default: ({ item, update }: { item: { key: string; value: number }; update: (value: unknown) => void }) => (
					<button class="update-item" onClick={() => update({ ...item, value: 9 })}>update</button>
				)
			}
		});
		await functional.get('.update-item').trigger('click');
		expect(functional.emitted('update:modelValue')?.at(-1)?.[0]).toEqual([{ key: 'a', value: 9 }]);
		expect(keyed.find('.docs-renderer-array-editor__handle').exists()).toBe(false);
		expect(functional.find('.docs-renderer-array-editor__handle').exists()).toBe(false);
	});

	it('keeps every built-in module editor on immutable update events', async () => {
		const node = {
			id: 'editor',
			module: { type: 'text', version: 1, props: {} },
			appearance: { marginTop: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 }
		};
		const props = (modelValue: Record<string, unknown>) => ({ node, modelValue, context });
		const title = mount(TitleEditor, { props: props({ text: 'Title' }) });
		title.findComponent(Input).vm.$emit('update:modelValue', 'Changed');
		title.findAllComponents(NumberEditor).forEach((editor, index) => editor.vm.$emit('update:modelValue', index + 1));
		title.findComponent(ColorPicker).vm.$emit('update:modelValue', '#fff');
		title.findComponent(Select).vm.$emit('update:modelValue', 'center');
		expect(title.emitted('update:modelValue')?.length).toBe(8);

		const text = mount(TextEditor, { props: props({ text: 'Text' }) });
		text.findComponent(Textarea).vm.$emit('update:modelValue', 'Changed');
		text.findAllComponents(NumberEditor).forEach((editor, index) => editor.vm.$emit('update:modelValue', index + 10));
		text.findAllComponents(ColorPicker).forEach(picker => picker.vm.$emit('update:modelValue', '#000'));
		text.findComponent(Select).vm.$emit('update:modelValue', 'right');
		expect(text.emitted('update:modelValue')?.length).toBe(8);

		const image = mount(ImageEditor, { props: props({}) });
		image.findAllComponents(Input).forEach((input, index) => input.vm.$emit('update:modelValue', `value-${index}`));
		image.findComponent(Select).vm.$emit('update:modelValue', 'cover');
		image.findComponent(NumberEditor).vm.$emit('update:modelValue', 12);
		image.findComponent(Switch).vm.$emit('update:modelValue', true);
		expect(image.emitted('update:modelValue')?.length).toBe(6);

		const space = mount(SpaceEditor, { props: props({}) });
		space.findComponent(NumberEditor).vm.$emit('update:modelValue', 48);
		space.findComponent(ColorPicker).vm.$emit('update:modelValue', '#eee');
		expect(space.emitted('update:modelValue')?.length).toBe(2);

		const list = mount(ListEditor, { props: props({ ordered: false, items: ['one'] }) });
		list.findComponent(Switch).vm.$emit('update:modelValue', true);
		list.findComponent(ArrayEditor).vm.$emit('update:modelValue', ['two']);
		expect(list.emitted('update:modelValue')?.length).toBe(2);

		const actions = mount(ActionsEditor, { props: props({ items: [{ label: 'Go', to: '/', variant: 'default' }] }) });
		const actionsArray = actions.findComponent(ArrayEditor);
		const actionSlot = actionsArray.find('.docs-renderer-module-editor__row');
		actionSlot.findAllComponents(Input)[0].vm.$emit('update:modelValue', 'Open');
		actionSlot.findAllComponents(Input)[1].vm.$emit('update:modelValue', '/open');
		actionSlot.findAllComponents(Select).forEach(select => select.vm.$emit('update:modelValue', 'solid'));
		actionSlot.findAllComponents(ColorPicker).forEach(picker => picker.vm.$emit('update:modelValue', '#873bf4'));
		actionsArray.vm.$emit('update:modelValue', [{ label: 'New' }]);
		expect(actions.emitted('update:modelValue')?.length).toBe(7);

		const features = mount(FeaturesEditor, { props: props({ items: [{ title: 'One', description: 'Desc' }] }) });
		features.findAllComponents(NumberEditor).forEach(editor => editor.vm.$emit('update:modelValue', 4));
		features.findAllComponents(ColorPicker).forEach(picker => picker.vm.$emit('update:modelValue', '#14b8a6'));
		features.findAllComponents(Select).forEach(select => select.vm.$emit('update:modelValue', 'search'));
		features.findAllComponents(Input).forEach(input => input.vm.$emit('update:modelValue', 'Two'));
		features.findAllComponents(Textarea).forEach(textarea => textarea.vm.$emit('update:modelValue', 'Description'));
		const featureArray = features.findComponent(ArrayEditor);
		featureArray.vm.$emit('update:modelValue', [{ title: 'Two' }]);
		expect(features.emitted('update:modelValue')?.length).toBe(14);

		const hero = mount(HeroEditor, {
			props: props({ actions: [], highlights: [{ value: '3', label: 'Themes' }] })
		});
		hero.findAllComponents(Input).forEach(input => input.vm.$emit('update:modelValue', 'Hero'));
		hero.findComponent(Textarea).vm.$emit('update:modelValue', 'Description');
		hero.findAllComponents(ColorPicker).forEach(picker => picker.vm.$emit('update:modelValue', '#873bf4'));
		hero.findComponent(Select).vm.$emit('update:modelValue', 'center');
		hero.findComponent(Switch).vm.$emit('update:modelValue', false);
		hero.findAllComponents(NumberEditor).forEach(editor => editor.vm.$emit('update:modelValue', 480));
		hero.findComponent(ActionsEditor).vm.$emit('update:modelValue', { items: [{ label: 'Start' }] });
		expect(hero.emitted('update:modelValue')?.length).toBe(13);

		const steps = mount(StepsEditor, { props: props({ items: [{ title: 'One', description: 'Desc' }] }) });
		steps.findAllComponents(NumberEditor).forEach(editor => editor.vm.$emit('update:modelValue', 2));
		steps.findAllComponents(ColorPicker).forEach(picker => picker.vm.$emit('update:modelValue', '#2d8cf0'));
		steps.findAllComponents(Input).forEach(input => input.vm.$emit('update:modelValue', 'Two'));
		steps.findAllComponents(Textarea).forEach(textarea => textarea.vm.$emit('update:modelValue', 'Description'));
		steps.findComponent(ArrayEditor).vm.$emit('update:modelValue', [{ title: 'Two' }]);
		expect(steps.emitted('update:modelValue')?.length).toBe(10);

		const faq = mount(FaqEditor, { props: props({ items: [{ question: 'Q', answer: 'A' }] }) });
		faq.findAllComponents(ColorPicker).forEach(picker => picker.vm.$emit('update:modelValue', '#873bf4'));
		faq.findAllComponents(Input).forEach(input => input.vm.$emit('update:modelValue', 'Why'));
		faq.findAllComponents(Textarea).forEach(textarea => textarea.vm.$emit('update:modelValue', 'Because'));
		faq.findComponent(ArrayEditor).vm.$emit('update:modelValue', [{ question: 'Why' }]);
		expect(faq.emitted('update:modelValue')?.length).toBe(7);

		const cta = mount(CtaEditor, { props: props({ actions: [] }) });
		cta.findAllComponents(Input).forEach(input => input.vm.$emit('update:modelValue', 'Go'));
		cta.findComponent(Textarea).vm.$emit('update:modelValue', 'Description');
		cta.findAllComponents(ColorPicker).forEach(picker => picker.vm.$emit('update:modelValue', '#873bf4'));
		cta.findComponent(Select).vm.$emit('update:modelValue', 'left');
		cta.findComponent(ActionsEditor).vm.$emit('update:modelValue', { items: [{ label: 'Start' }] });
		expect(cta.emitted('update:modelValue')?.length).toBe(8);

		const ads = mount(AdsEditor, { props: props({ items: [{ src: '', href: 'https://example.com', title: 'Ad' }] }) });
		ads.findAllComponents(Select).forEach(select => select.vm.$emit('update:modelValue', 'scroll'));
		ads.findAllComponents(NumberEditor).forEach(editor => editor.vm.$emit('update:modelValue', 3));
		const adsArray = ads.findComponent(ArrayEditor);
		adsArray.find('.docs-renderer-module-editor__row').findAllComponents(Input)
			.forEach(input => input.vm.$emit('update:modelValue', 'value'));
		adsArray.vm.$emit('update:modelValue', [{ title: 'Two' }]);
		expect(ads.emitted('update:modelValue')?.length).toBe(11);
	});

	it('reads a local image file as a data URL', async () => {
		const wrapper = mount(ImageSource, { props: { modelValue: '', placeholder: 'hint' } });
		wrapper.findComponent(Input).vm.$emit('update:modelValue', 'iVBORw0KGgoAAAANSUhEUg==');
		expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['iVBORw0KGgoAAAANSUhEUg==']);
		const file = new File([Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10])], 'dot.png', { type: 'image/png' });
		const input = wrapper.get('input[type="file"]');
		Object.defineProperty(input.element, 'files', { configurable: true, value: [file] });
		await input.trigger('change');
		await vi.waitFor(() => {
			expect(String(wrapper.emitted('update:modelValue')?.[1]?.[0])).toMatch(/^data:image\/png;base64,/);
		});
		wrapper.unmount();
	});

	it('edits both sortable and draggable page layouts', async () => {
		const sortable = createEmptyRendererDocument('sortable').layout;
		const flow = mount(PageEditor, {
			props: {
				node: createRendererPageNode(sortable),
				modelValue: toRecord(sortable),
				context
			}
		});
		expect(flow.findAllComponents(NumberEditor)).toHaveLength(2);
		flow.findAllComponents(NumberEditor).forEach(editor => editor.vm.$emit('update:modelValue', 720));
		flow.findComponent(ColorPicker).vm.$emit('update:modelValue', '#123456');
		expect(flow.emitted('update:modelValue')?.length).toBeGreaterThan(0);
		flow.findComponent(Select).vm.$emit('update:modelValue', 'draggable');
		expect(flow.emitted('update:modelValue')?.at(-1)?.[0]).toEqual(expect.objectContaining({
			mode: 'draggable',
			width: 1920,
			height: 800,
			background: '#ffffff'
		}));
		flow.findComponent(Select).vm.$emit('update:modelValue', 'sortable');
		flow.findComponent(Select).vm.$emit('update:modelValue', 'grid');

		const draggable = createEmptyRendererDocument('draggable').layout;
		const free = mount(PageEditor, {
			props: {
				node: createRendererPageNode(draggable),
				modelValue: toRecord(draggable),
				context
			}
		});
		free.findAllComponents(NumberEditor).forEach(editor => editor.vm.$emit('update:modelValue', 900));
		free.findComponent(ColorPicker).vm.$emit('update:modelValue', '#654321');
		expect(free.emitted('update:modelValue')?.length).toBeGreaterThan(0);
		free.findComponent(Select).vm.$emit('update:modelValue', 'sortable');
		expect(free.emitted('update:modelValue')?.at(-1)?.[0]).toEqual({
			mode: 'sortable',
			maxWidth: 1200,
			background: '#ffffff'
		});
		free.findComponent(Select).vm.$emit('update:modelValue', 'draggable');
	});

	it('edits shared spacing, free placement and module props through the Store', async () => {
		const sortable = createEmptyRendererDocument('sortable');
		if (sortable.layout.mode !== 'sortable') throw new Error('unexpected frame');
		sortable.blocks.push({
			id: 'text',
			module: {
				type: 'text',
				version: 1,
				props: {
					text: 'Before', fontSize: 16, fontWeight: 400,
					lineHeight: 1.7, letterSpacing: 0, color: '', align: 'left'
				}
			},
			appearance: {
				marginTop: 0,
				marginBottom: 0,
				paddingTop: 0,
				paddingBottom: 0,
				paddingLeft: 0,
				paddingRight: 0
			}
		});
		const store = new RendererStore(sortable);
		store.select('text');
		const wrapper = mount(PropertyEditor, {
			props: {
				store,
				catalog: createRendererModuleCatalog(BuiltinModules),
				context,
				mode: 'sortable'
			}
		});
		await flushPromises();
		const spacing = wrapper.findAll('.docs-renderer-editor__section')
			.find(section => section.get('h3').text() === 'Spacing');
		spacing?.findAllComponents(NumberEditor).forEach((editor, index) => {
			editor.vm.$emit('update:modelValue', 10 + index);
		});
		await wrapper.vm.$nextTick();
		expect(store.getNode('text')?.appearance).toEqual({
			marginTop: 10,
			marginBottom: 11,
			paddingTop: 12,
			paddingBottom: 13,
			paddingLeft: 14,
			paddingRight: 15
		});
		const appearance = wrapper.findAll('.docs-renderer-editor__section')
			.find(section => section.get('h3').text() === 'Appearance');
		appearance?.findComponent(NumberEditor).vm.$emit('update:modelValue', 8);
		await wrapper.vm.$nextTick();
		expect(store.getNode('text')?.appearance?.borderRadius).toBe(8);
		await appearance?.get('.docs-renderer-radius-editor__independent').trigger('click');
		expect(store.getNode('text')?.appearance).toEqual(expect.objectContaining({
			borderRadius: 8,
			borderRadiusTopLeft: 8,
			borderRadiusTopRight: 8,
			borderRadiusBottomLeft: 8,
			borderRadiusBottomRight: 8
		}));
		wrapper.findComponent(TextEditor).vm.$emit('update:modelValue', {
			...store.getNode('text')!.module.props,
			text: 'After'
		});
		expect(store.getNode('text')?.module.props.text).toBe('After');
		wrapper.findComponent(TextEditor).vm.$emit('update:modelValue', { unsafe: () => undefined });
		expect(store.getNode('text')?.module.props.text).toBe('After');
		expect(wrapper.findComponent(PageEditor).exists()).toBe(false);
		expect(wrapper.text()).toMatch(/Fill screen/);
		expect(wrapper.text()).toMatch(/Maximum width/);
		const box = wrapper.findComponent(SortableBox);
		box.findComponent(Switch).vm.$emit('update:modelValue', true);
		await wrapper.vm.$nextTick();
		expect(store.getNode('text')?.appearance).toEqual(expect.objectContaining({
			fullWidth: true
		}));
		expect(store.getNode('text')?.appearance?.maxWidth).toBeUndefined();
		box.findComponent(NumberEditor).vm.$emit('update:modelValue', 960);
		await wrapper.vm.$nextTick();
		expect(store.getNode('text')?.appearance).toEqual(expect.objectContaining({
			fullWidth: true,
			maxWidth: 960
		}));
		box.findComponent(NumberEditor).vm.$emit('update:modelValue', 0);
		await wrapper.vm.$nextTick();
		expect(store.getNode('text')?.appearance?.fullWidth).toBe(true);
		expect(store.getNode('text')?.appearance?.maxWidth).toBeUndefined();
		box.findComponent(NumberEditor).vm.$emit('update:modelValue', 1200);
		await wrapper.vm.$nextTick();
		expect(store.getNode('text')?.appearance?.maxWidth).toBe(1200);
		box.findComponent({ name: 'vc-input-number' }).vm.$emit('update:modelValue', undefined);
		await wrapper.vm.$nextTick();
		expect(store.getNode('text')?.appearance?.maxWidth).toBeUndefined();
		box.findComponent(Switch).vm.$emit('update:modelValue', false);
		await wrapper.vm.$nextTick();
		expect(store.getNode('text')?.appearance).toEqual(expect.objectContaining({
			fullWidth: false
		}));
		expect(store.getNode('text')?.appearance?.maxWidth).toBeUndefined();

		const draggable = createEmptyRendererDocument('draggable') as RendererDraggableDocument;
		draggable.blocks.push({
			id: 'free',
			module: { type: 'text', version: 1, props: { text: 'Free' } },
			placement: { x: 10, y: 20, width: 100, height: 80, rotate: 0, zIndex: 1 }
		});
		const freeStore = new RendererStore(draggable);
		freeStore.select('free');
		const free = mount(PropertyEditor, {
			props: {
				store: freeStore,
				catalog: createRendererModuleCatalog(BuiltinModules),
				context: { ...context, frameMode: 'draggable' },
				mode: 'draggable'
			}
		});
		await flushPromises();
		const placement = free.findAll('.docs-renderer-editor__section')
			.find(section => section.get('h3').text() === 'Placement');
		placement?.findAllComponents(NumberEditor).forEach((editor, index) => {
			editor.vm.$emit('update:modelValue', 30 + index);
		});
		expect(freeStore.getNode('free')?.placement).toEqual({
			x: 30,
			y: 31,
			width: 32,
			height: 33,
			rotate: 34,
			zIndex: 35
		});
		const freeAppearance = free.findAll('.docs-renderer-editor__section')
			.find(section => section.get('h3').text() === 'Appearance');
		freeAppearance?.findComponent(NumberEditor).vm.$emit('update:modelValue', 6);
		expect(freeStore.getNode('free')?.placement?.borderRadius).toBe(6);
	});

	it('keeps JSON edits in a draft until Apply', async () => {
		const document = createEmptyRendererDocument('sortable');
		Object.assign(document.meta, {
			extra: { string: 'value', number: 1, boolean: true, nothing: null, array: ['a', 'b'] }
		});
		const wrapper = mount(JsonPopup, {
			props: { document, modules: BuiltinModules, context },
			attachTo: globalThis.document.body
		});
		await flushPromises();
		expect(wrapper.text()).toContain('Document JSON');
		const sourceButton = wrapper.findAll('button').find(button => button.text() === 'Source');
		await sourceButton?.trigger('click');
		const textarea = wrapper.find('textarea');
		const next = createEmptyRendererDocument('sortable');
		next.meta.title = 'Applied';
		await textarea.setValue(JSON.stringify(next));
		const apply = wrapper.findAll('button').find(button => button.text() === 'Apply');
		await apply?.trigger('click');
		await flushPromises();
		expect(wrapper.emitted('portal-fulfilled')?.[0]?.[0]).toEqual(expect.objectContaining({
			meta: expect.objectContaining({ title: 'Applied' })
		}));
		wrapper.unmount();
	});

	it('reorders JSON arrays through SortList while keeping the draft isolated', async () => {
		const document = createEmptyRendererDocument('sortable');
		Object.assign(document.meta, { extra: { array: ['first', 'second'] } });
		const wrapper = mount(JsonPopup, { props: { document, modules: BuiltinModules, context } });
		await flushPromises();
		const sortList = wrapper.findAllComponents({ name: 'vc-sort-list' }).find((item) => {
			const rows = item.props('modelValue') as Array<{ raw: unknown }>;
			return rows.map(row => row.raw).join(',') === 'first,second';
		});
		const rows = sortList?.props('modelValue') as Array<{ raw: unknown }>;
		sortList?.vm.$emit('change', [...rows].reverse());
		await wrapper.findAll('button').find(button => button.text() === 'Source')?.trigger('click');
		const source = JSON.parse(wrapper.find('textarea').element.value) as {
			meta: { extra: { array: string[] } };
		};
		expect(source.meta.extra.array).toEqual(['second', 'first']);
		expect((document.meta as unknown as Record<string, unknown>).extra).toEqual({ array: ['first', 'second'] });
	});

	it('reports invalid source without mutating or closing', async () => {
		const wrapper = mount(JsonPopup, {
			props: { document: createEmptyRendererDocument(), modules: BuiltinModules, context }
		});
		await wrapper.findAll('button').find(button => button.text() === 'Source')?.trigger('click');
		await wrapper.find('textarea').setValue('{ invalid');
		await wrapper.findAll('button').find(button => button.text() === 'Tree')?.trigger('click');
		expect(wrapper.find('.docs-renderer-json-modal__error').exists()).toBe(true);
		expect(wrapper.emitted('portal-fulfilled')).toBeUndefined();
		await wrapper.findAll('button').find(button => button.text() === 'Cancel')?.trigger('click');
		expect(wrapper.emitted('portal-rejected')).toHaveLength(1);
	});

	it('edits JSON primitive values and array children in tree mode', async () => {
		const document = createEmptyRendererDocument('sortable');
		Object.assign(document.meta, {
			extra: {
				name: 'before',
				count: 2,
				enabled: false,
				object: {},
				array: []
			}
		});
		const wrapper = mount(JsonPopup, { props: { document, modules: BuiltinModules, context } });
		await flushPromises();

		const nodeFor = (key: string) => wrapper.findAll('.docs-renderer-json__node').find((node) => {
			const field = node.element.querySelector(':scope > .docs-renderer-json__fields');
			return field?.getAttribute('data-json-key') === key;
		})!;
		const inputFor = (value: string) => wrapper.findAllComponents(Input).find(input => input.props('modelValue') === value);
		inputFor('before')?.vm.$emit('update:modelValue', 'after');
		nodeFor('count').findComponent(InputNumber).vm.$emit('update:modelValue', 7);
		wrapper.findAllComponents(Switch).find(input => input.props('modelValue') === false)
			?.vm.$emit('update:modelValue', true);
		await wrapper.vm.$nextTick();

		expect(nodeFor('object').find('.docs-renderer-json__add').exists()).toBe(false);
		expect(nodeFor('object').find('.docs-renderer-json__kind').text()).toBe('object');
		expect(nodeFor('name').get('.docs-renderer-json__key').text()).toBe('name');
		const arrayNode = nodeFor('array');
		expect(arrayNode.find('.docs-renderer-json__kind').text()).toBe('array');
		await arrayNode.get('.docs-renderer-json__add').trigger('click');
		await wrapper.vm.$nextTick();
		await arrayNode.get('.docs-renderer-json__add').trigger('click');
		await wrapper.vm.$nextTick();
		const secondItem = wrapper.findAll('.docs-renderer-json__node').find((node) => {
			const key = node.find('.docs-renderer-json__key');
			return key.exists() && key.text().includes('[1]');
		});
		await secondItem?.get('.docs-renderer-json__remove').trigger('click');
		await wrapper.vm.$nextTick();

		await wrapper.findAll('button').find(button => button.text() === 'Source')?.trigger('click');
		const source = JSON.parse(wrapper.find('textarea').element.value) as {
			meta: { extra: Record<string, unknown> };
		};
		expect(source.meta.extra).toEqual(expect.objectContaining({
			name: 'after',
			count: 7,
			enabled: true,
			array: ['']
		}));
		expect(source.meta.extra.object).toEqual({});
	});

	it('disables protocol fields and validates required document keys live', async () => {
		const document = createEmptyRendererDocument('sortable');
		const wrapper = mount(JsonPopup, { props: { document, modules: BuiltinModules, context } });
		await flushPromises();

		const nodeFor = (key: string) => wrapper.findAll('.docs-renderer-json__node').find((node) => {
			const field = node.element.querySelector(':scope > .docs-renderer-json__fields');
			return field?.getAttribute('data-json-key') === key;
		})!;
		const schemaNode = nodeFor('schemaVersion');
		expect(schemaNode.get('.docs-renderer-json__key').text()).toBe('schemaVersion');
		expect(schemaNode.get('.docs-renderer-json__kind').text()).toBe('number');
		expect(schemaNode.findComponent(InputNumber).props('disabled')).toBe(true);
		expect(schemaNode.find('.docs-renderer-json__remove').exists()).toBe(false);
		schemaNode.findComponent(InputNumber).vm.$emit('update:modelValue', 1);
		await wrapper.vm.$nextTick();

		const modeNode = nodeFor('mode');
		expect(modeNode.get('.docs-renderer-json__kind').text()).toBe('string');
		const modeValue = modeNode.findAllComponents(Input).find(input => input.props('modelValue') === 'sortable');
		expect(modeValue?.props('disabled')).toBe(true);
		modeValue?.vm.$emit('update:modelValue', 'draggable');

		expect(wrapper.find('.docs-renderer-json__node.is-root > .docs-renderer-json__fields .docs-renderer-json__add').exists()).toBe(false);
		expect(nodeFor('title').find('.docs-renderer-json__remove').exists()).toBe(false);
		expect(nodeFor('meta').find('.docs-renderer-json__add').exists()).toBe(false);

		const idValue = nodeFor('id').findAllComponents(Input).find(input => input.props('modelValue') === document.meta.id);
		idValue?.vm.$emit('update:modelValue', '');
		await wrapper.vm.$nextTick();
		expect(wrapper.find('.docs-renderer-json-modal__error').text()).toContain('meta.id');

		await wrapper.findAll('button').find(button => button.text() === 'Source')?.trigger('click');
		const source = JSON.parse(wrapper.find('textarea').element.value) as {
			schemaVersion: number;
			layout: { mode: string };
			meta: { id: string; title?: string };
		};
		expect(source.schemaVersion).toBe(2);
		expect(source.layout.mode).toBe('sortable');
		expect(Object.keys(source)).toEqual(['schemaVersion', 'meta', 'layout', 'blocks']);
		expect(source.meta.id).toBe('');
		expect(source.meta.title).toBe('');
		wrapper.unmount();
	});

	it('adds a valid block stub from the JSON tree', async () => {
		const sortable = mount(JsonPopup, {
			props: { document: createEmptyRendererDocument('sortable'), modules: BuiltinModules, context }
		});
		await flushPromises();
		const blocksNode = sortable.findAll('.docs-renderer-json__node').find((node) => {
			const field = node.element.querySelector(':scope > .docs-renderer-json__fields');
			return field?.getAttribute('data-json-key') === 'blocks';
		})!;
		await blocksNode.get('.docs-renderer-json__add').trigger('click');
		await sortable.vm.$nextTick();
		await blocksNode.get('.docs-renderer-json__add').trigger('click');
		await sortable.vm.$nextTick();
		await sortable.findAll('button').find(button => button.text() === 'Source')?.trigger('click');
		const sortableSource = JSON.parse(sortable.find('textarea').element.value) as {
			blocks: Array<{ id: string; module: { type: string }; appearance: Record<string, number> }>;
		};
		expect(sortableSource.blocks).toHaveLength(2);
		expect(sortableSource.blocks[0].id).toBeTruthy();
		expect(sortableSource.blocks[1].id).not.toBe(sortableSource.blocks[0].id);
		expect(sortableSource.blocks[0].module.type).toBe('text');
		expect(sortableSource.blocks[0].appearance).toEqual(expect.objectContaining({ marginTop: 0, paddingTop: 0 }));
		sortable.unmount();

		const draggable = mount(JsonPopup, {
			props: { document: createEmptyRendererDocument('draggable'), modules: BuiltinModules, context }
		});
		await flushPromises();
		const freeBlocks = draggable.findAll('.docs-renderer-json__node').find((node) => {
			const field = node.element.querySelector(':scope > .docs-renderer-json__fields');
			return field?.getAttribute('data-json-key') === 'blocks';
		})!;
		await freeBlocks.get('.docs-renderer-json__add').trigger('click');
		await draggable.vm.$nextTick();
		await draggable.findAll('button').find(button => button.text() === 'Source')?.trigger('click');
		const freeSource = JSON.parse(draggable.find('textarea').element.value) as {
			blocks: Array<{ placement: { width: number } }>;
		};
		expect(freeSource.blocks[0].placement.width).toBe(280);
		draggable.unmount();
	});

	it('keeps Apply open for malformed or structurally invalid JSON', async () => {
		const malformed = mount(JsonPopup, {
			props: { document: createEmptyRendererDocument(), modules: BuiltinModules, context }
		});
		await malformed.findAll('button').find(button => button.text() === 'Source')?.trigger('click');
		await malformed.get('textarea').setValue('{broken');
		await malformed.findAll('button').find(button => button.text() === 'Apply')?.trigger('click');
		expect(malformed.find('.docs-renderer-json-modal__error').exists()).toBe(true);
		await malformed.find('.vc-modal__close').trigger('click');
		expect(malformed.emitted('portal-rejected')).toHaveLength(1);
		malformed.unmount();

		const invalid = mount(JsonPopup, {
			props: { document: createEmptyRendererDocument(), modules: BuiltinModules, context }
		});
		await invalid.findAll('button').find(button => button.text() === 'Source')?.trigger('click');
		await invalid.get('textarea').setValue('{}');
		await invalid.findAll('button').find(button => button.text() === 'Apply')?.trigger('click');
		await flushPromises();
		expect(invalid.find('.docs-renderer-json-modal__error').text()).toContain('$');
		expect(invalid.emitted('portal-fulfilled')).toBeUndefined();
	});

	it('renders and closes the Preview portal for a draggable document', async () => {
		const document = createEmptyRendererDocument('draggable') as RendererDraggableDocument;
		const wrapper = mount(PreviewPopup, {
			props: { document, modules: BuiltinModules, context: { ...context, frameMode: 'draggable' } }
		});
		await flushPromises();
		expect(wrapper.text()).toContain('Preview');
		await wrapper.find('.vc-modal__close').trigger('click');
		expect(wrapper.emitted('portal-fulfilled')).toHaveLength(1);
	});
});
