// @vitest-environment jsdom

import { flushPromises, mount } from '@vue/test-utils';
import { Input, Select, Textarea } from '@deot/vc';
import { enUS } from '@deot/docs-locale';
import { BuiltinModules } from '../src';
import type { RendererModuleContext, RendererSortableNode } from '../src';
import HeroEditor from '../src/modules/sortable/hero/editor.vue';
import HeroPanel from '../src/modules/sortable/hero/panel.vue';
import FaqViewer from '../src/modules/sortable/faq/viewer.vue';
import { createHeroVisual, normalizeHeroVisual } from '../src/modules/sortable/hero/visual';
import { toRecord } from '../src/modules/shared/utils';
import FeaturesEditor from '../src/modules/sortable/features/editor.vue';
import ImageSource from '../src/editor/common/image/index.vue';
import FeaturesViewer from '../src/modules/sortable/features/viewer.vue';

const context: RendererModuleContext = { scene: 'combo', frameMode: 'sortable', readonly: false, locale: enUS };
const nodeOf = (type: string, props: Record<string, unknown>): RendererSortableNode => ({
	id: type,
	module: { type, version: 1, props },
	appearance: { marginTop: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 }
});

describe('landing module composition', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it('reveals offscreen content once, cleans up its observer and honors reduced motion', () => {
		let intersect: IntersectionObserverCallback;
		const unobserve = vi.fn();
		const disconnect = vi.fn();
		vi.stubGlobal('IntersectionObserver', class {
			constructor(callback: IntersectionObserverCallback) { intersect = callback; }
			observe() {}
			unobserve = unobserve;
			disconnect = disconnect;
		});
		vi.stubGlobal('matchMedia', () => ({ matches: false }));
		vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ top: 2000, height: 50000 } as DOMRect);
		const props = { node: nodeOf('features', { title: 'Features', items: [] }), context: { ...context, readonly: true } };
		const viewer = mount(FeaturesViewer, { props });
		const grid = viewer.get('.docs-renderer-features__grid');
		expect(grid.classes()).toContain('is-waiting');
		intersect!([{ target: grid.element, isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
		expect(grid.classes()).not.toContain('is-waiting');
		expect(unobserve).toHaveBeenCalledWith(grid.element);
		viewer.unmount();
		expect(disconnect).toHaveBeenCalledOnce();
		vi.stubGlobal('matchMedia', () => ({ matches: true }));
		const reduced = mount(FeaturesViewer, { props });
		expect(reduced.classes()).not.toContain('has-motion');
		expect(reduced.find('.is-waiting').exists()).toBe(false);
		reduced.unmount();
	});

	it.each(['hero', 'features', 'steps', 'faq', 'cta'])('preserves %s right alignment during normalization and editing', async (type) => {
		const definition = BuiltinModules.find(item => 'identity' in item && item.identity.type === type);
		if (!definition || !('identity' in definition)) throw new Error('module unavailable');
		const value = toRecord(definition.data.normalize?.({
			title: 'Heading', align: 'right', items: [{ title: 'Item', question: 'Question', answer: 'Answer' }]
		}));
		expect(value?.align).toBe('right');
		expect(definition.data.validate?.(value!)).not.toContainEqual(expect.objectContaining({ path: '$.align' }));
		const node = nodeOf(type, value!);
		const viewer = mount(definition.viewer, { props: { node, context } });
		expect(viewer.classes()).toContain('is-right');
		if (['features', 'steps', 'faq'].includes(type)) {
			const children = Array.from((viewer.element as Element).children);
			expect(children[0].tagName).toBe('HEADER');
			expect(children[1].tagName).not.toBe('HEADER');
		}
		const editor = mount(definition.editor, { props: { node, context, modelValue: value! } });
		const align = editor.findComponent(Select);
		expect(align.props('data')).toContainEqual({ label: 'Right', value: 'right' });
		align.vm.$emit('update:modelValue', 'left');
		expect(editor.emitted('update:modelValue')?.at(-1)?.[0]).toEqual(expect.objectContaining({ align: 'left' }));
		viewer.unmount();
		editor.unmount();
	});

	it('retains legacy hero defaults and preserves document/code content, including an intentionally empty panel', () => {
		expect(normalizeHeroVisual(undefined)).toEqual(createHeroVisual());
		const visual = { type: 'code', title: 'example.ts', content: '', language: 'custom' };
		expect(normalizeHeroVisual(visual)).toEqual(visual);
		const hero = BuiltinModules.find(item => 'identity' in item && item.identity.type === 'hero');
		if (!hero || !('identity' in hero)) throw new Error('hero unavailable');
		expect(hero.data.normalize?.({ title: 'Legacy', showVisual: false })).toEqual(
			expect.objectContaining({ showVisual: false, visual: createHeroVisual() })
		);
		expect(hero.data.normalize?.({ title: 'Code', visual })).toEqual(expect.objectContaining({ visual }));
	});

	it('renders Markdown headings and navigation while escaping HTML and unsafe links', async () => {
		const wrapper = mount(HeroPanel, { props: { visual: {
			...createHeroVisual(), content: [
				'# Document', '**Readable** content', '## Setup\nHello',
				'<script>alert(1)</script>', '[unsafe](javascript:alert(1))'
			].join('\n\n')
		} } });
		expect(wrapper.get('h1').text()).toBe('Document');
		expect(wrapper.get('strong').text()).toBe('Readable');
		expect(wrapper.get('button').text()).toBe('Setup');
		expect(wrapper.find('script').exists()).toBe(false);
		expect(wrapper.find('a[href^="javascript:"]').exists()).toBe(false);
		await wrapper.get('button').trigger('click');
		wrapper.unmount();
	});

	it('highlights supported code and safely falls back to plain text for other languages', async () => {
		const visual = {
			...createHeroVisual(), type: 'code' as const, title: 'example.ts', content: 'const title = "Hello";', language: 'typescript'
		};
		const wrapper = mount(HeroPanel, { props: { visual } });
		expect(wrapper.get('.hljs-keyword').text()).toBe('const');
		expect(wrapper.get('code').text()).toBe(visual.content);
		await wrapper.setProps({ visual: { ...visual, language: 'unknown', content: '<img src=x onerror=alert(1)>' } });
		expect(wrapper.get('code').text()).toBe('<img src=x onerror=alert(1)>');
		expect(wrapper.find('img').exists()).toBe(false);
		wrapper.unmount();
	});

	it('preserves and edits feature illustrations independently from icons and resolves workspace images', async () => {
		const features = BuiltinModules.find(item => 'identity' in item && item.identity.type === 'features');
		if (!features || !('identity' in features)) throw new Error('features unavailable');
		const item = { title: 'Feature', description: 'Text', icon: 'star', image: './illustration.svg' };
		const value = toRecord(features.data.normalize?.({ items: [item] }));
		expect(value.items).toEqual([expect.objectContaining(item)]);
		expect(features.integrations?.collectResources?.(value)).toEqual([{ type: 'module', source: './illustration.svg' }]);
		const editor = mount(FeaturesEditor, { props: { node: nodeOf('features', value), modelValue: value, context } });
		editor.findAllComponents(ImageSource)[0].vm.$emit('update:modelValue', 'https://example.com/feature.png');
		expect(toRecord(editor.emitted('update:modelValue')?.at(-1)?.[0]).items).toEqual([
			expect.objectContaining({ ...item, image: 'https://example.com/feature.png' })
		]);
		editor.unmount();
		const resolveAsset = vi.fn(async (source: string) => `https://cdn.example.com/${source}`);
		const viewer = mount(FeaturesViewer, { props: {
			node: nodeOf('features', value), context: { ...context, source: 'home.page.json', services: { resolveAsset } }
		} });
		await flushPromises();
		expect(resolveAsset).toHaveBeenCalledWith('./illustration.svg', 'home.page.json');
		expect(viewer.get('.docs-renderer-features__illustration img').attributes('src')).toBe('https://cdn.example.com/./illustration.svg');
		viewer.unmount();
	});

	it('edits nested hero panel settings without losing its content or other module props', async () => {
		const visual = { ...createHeroVisual(), content: '# Keep this text' };
		const value = { title: 'Hero', align: 'left', visual };
		const wrapper = mount(HeroEditor, { props: { node: nodeOf('hero', value), modelValue: value, context } });
		wrapper.findAllComponents(Select)[1].vm.$emit('update:modelValue', 'code');
		const changed = wrapper.emitted('update:modelValue')?.at(-1)?.[0] as Record<string, unknown>;
		expect(changed).toEqual({ ...value, visual: { ...visual, type: 'code' } });
		await wrapper.setProps({ modelValue: changed });
		const language = wrapper.findAllComponents(Input).find(input => input.props('modelValue') === 'typescript');
		language!.vm.$emit('update:modelValue', 'json');
		expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toEqual(
			expect.objectContaining({ visual: { ...visual, type: 'code', language: 'json' } })
		);
		wrapper.findAllComponents(Textarea).at(-1)!.vm.$emit('update:modelValue', '{ "hello": true }');
		expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toEqual(
			expect.objectContaining({ visual: { ...visual, type: 'code', content: '{ "hello": true }' } })
		);
		wrapper.unmount();
	});

	it('expands FAQ columns according to the module width and returns to an accordion on narrow canvases', async () => {
		let resize: ResizeObserverCallback;
		const disconnect = vi.fn();
		vi.stubGlobal('ResizeObserver', class {
			constructor(callback: ResizeObserverCallback) { resize = callback; }
			observe() {}
			disconnect = disconnect;
		});
		const wrapper = mount(FaqViewer, { props: {
			node: nodeOf('faq', { align: 'left', items: [
				{ question: 'One', answer: 'A' }, { question: 'Two', answer: 'B' }, { question: 'Three', answer: 'C' }
			] }), context
		} });
		const notify = async (width: number) => {
			resize!([{ contentRect: { width } } as ResizeObserverEntry], {} as ResizeObserver);
			await wrapper.vm.$nextTick();
		};
		await notify(1536);
		expect(wrapper.findAll('details[open]')).toHaveLength(3);
		await wrapper.setProps({ node: nodeOf('faq', { ...wrapper.props('node').module.props, align: 'center' }) });
		expect(wrapper.findAll('details[open]')).toHaveLength(1);
		await wrapper.setProps({ node: nodeOf('faq', { ...wrapper.props('node').module.props, align: 'right' }) });
		expect(wrapper.findAll('details[open]')).toHaveLength(3);
		await notify(390);
		expect(wrapper.findAll('details[open]')).toHaveLength(1);
		(wrapper.findAll('details')[1].element as HTMLDetailsElement).open = true;
		expect(wrapper.findAll('details[open]')).toHaveLength(2);
		wrapper.unmount();
		expect(disconnect).toHaveBeenCalledOnce();
	});
});
