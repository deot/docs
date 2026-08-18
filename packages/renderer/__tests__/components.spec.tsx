// @vitest-environment jsdom

import 'fake-indexeddb/auto';
import { flushPromises, mount } from '@vue/test-utils';
import type { VueWrapper } from '@vue/test-utils';
import { defineComponent, h, reactive } from 'vue';
import { Select } from '@deot/vc';
import { useLocale, zhCN } from '@deot/docs-locale';
import {
	Combo,
	Renderer,
	BuiltinModules,
	createEmptyRendererDocument,
	defineRendererModule
} from '../src';
import type { RendererDocument, RendererSortableDocument } from '../src';
import PageEditor from '../src/modules/shared/page/editor.vue';
import TextEditor from '../src/modules/shared/text/editor.vue';
import DraggableFrame from '../src/frame/draggable/index.vue';
import SortableFrame from '../src/frame/sortable/index.vue';
import RendererNode from '../src/assist/renderer/node.vue';
import { createRendererModuleCatalog } from '../src/catalog';
import { RendererDraftCache } from '../src/combo/draft';
import {
	closestHTMLElement,
	comboVm,
	draggableDocumentOf,
	htmlElementOf,
	invalid as invalidValue,
	sortableDocumentOf
} from './fixtures';

describe('Renderer and Combo', () => {
	it('renders siblings and isolates an unknown module', async () => {
		const document = createEmptyRendererDocument('sortable');
		document.blocks.push({
			id: 'title',
			module: { type: 'title', version: 1, props: { text: 'Hello', level: 1 } },
			appearance: {
				marginTop: 0,
				marginBottom: 0,
				paddingTop: 0,
				paddingBottom: 0,
				paddingLeft: 12,
				paddingRight: 14,
				borderRadius: 8
			}
		}, {
			id: 'unknown',
			module: { type: 'unknown', version: 1, props: {} },
			appearance: {
				marginTop: 0,
				marginBottom: 0,
				paddingTop: 0,
				paddingBottom: 0,
				borderRadiusTopLeft: 4,
				borderRadiusTopRight: 8,
				borderRadiusBottomRight: 12,
				borderRadiusBottomLeft: 2
			}
		});
		const wrapper = mount(Renderer, { props: { document, modules: BuiltinModules } });
		await flushPromises();
		expect(wrapper.text()).toContain('Hello');
		expect(wrapper.text()).toContain('未知模块');
		const style = htmlElementOf(wrapper.find('[data-renderer-node-id="title"]')).style;
		expect(style.paddingLeft).toBe('12px');
		expect(style.paddingRight).toBe('14px');
		expect(style.borderRadius).toBe('8px');
		expect(style.overflow).toBe('hidden');
		expect(style.minHeight).toBe('');
		const unknown = htmlElementOf(wrapper.find('[data-renderer-node-id="unknown"]')).style;
		expect(unknown.borderRadius).toBe('4px 8px 12px 2px');
		expect(unknown.overflow).toBe('hidden');
	});

	it('lets sortable modules fill the display container', async () => {
		const document = createEmptyRendererDocument('sortable');
		document.blocks.push({
			id: 'hero',
			module: {
				type: 'hero',
				version: 1,
				props: {
					eyebrow: '',
					title: 'Wide',
					description: '',
					actions: []
				}
			},
			appearance: {
				marginTop: 0,
				marginBottom: 0,
				paddingTop: 0,
				paddingBottom: 0
			}
		}, {
			id: 'cta',
			module: {
				type: 'cta',
				version: 1,
				props: {
					title: 'Go',
					description: '',
					actions: [],
					align: 'center'
				}
			},
			appearance: {
				marginTop: 0,
				marginBottom: 0,
				paddingTop: 0,
				paddingBottom: 0
			}
		}, {
			id: 'text',
			module: { type: 'text', version: 1, props: { text: 'Boxed' } },
			appearance: {
				marginTop: 0,
				marginBottom: 0,
				paddingTop: 0,
				paddingBottom: 0
			}
		}, {
			id: 'banner',
			module: { type: 'text', version: 1, props: { text: 'Fill' } },
			appearance: {
				marginTop: 0,
				marginBottom: 0,
				paddingTop: 0,
				paddingBottom: 0,
				fullWidth: true,
				maxWidth: 1200
			}
		});
		const preview = mount(Renderer, { props: { document, modules: BuiltinModules } });
		await flushPromises();
		const publishedCanvas = preview.get('.docs-renderer__canvas').attributes('style') || '';
		expect(publishedCanvas).toContain('width: 100%');
		expect(publishedCanvas).toContain('var(--docs-background-color)');
		expect(publishedCanvas).not.toContain('--docs-renderer-content-width');
		expect(publishedCanvas).not.toMatch(/min-height/);
		expect(preview.get('[data-renderer-node-id="hero"]').classes()).toContain('is-full-width');
		expect(preview.get('[data-renderer-node-id="cta"]').classes()).toContain('is-full-width');
		expect(preview.get('[data-renderer-node-id="text"]').classes()).not.toContain('is-full-width');
		expect(htmlElementOf(preview.get('[data-renderer-node-id="text"]')).style.maxWidth)
			.toBe('');
		expect(htmlElementOf(preview.get('[data-renderer-node-id="text"]'))
			.style.getPropertyValue('--docs-renderer-content-width')).toBe('100%');
		expect(preview.get('[data-renderer-node-id="banner"]').classes()).toContain('is-full-width');
		expect(htmlElementOf(preview.get('[data-renderer-node-id="hero"]'))
			.style.getPropertyValue('--docs-renderer-content-width')).toBe('100%');
		expect(htmlElementOf(preview.get('[data-renderer-node-id="banner"]'))
			.style.getPropertyValue('--docs-renderer-content-width')).toBe('1200px');
		preview.unmount();

		const combo = mount(Combo, { props: { modelValue: document } });
		await flushPromises();
		expect(combo.get('.docs-renderer-frame__canvas').attributes('style')).toContain('width: 1920px');
		const comboItem = (id: string) => closestHTMLElement(
			combo.get(`[data-renderer-node-id="${id}"]`),
			'.docs-renderer-frame__item'
		);
		expect(comboItem('hero')?.classList.contains('is-full-width')).toBe(true);
		expect(comboItem('cta')?.classList.contains('is-full-width')).toBe(true);
		expect(comboItem('cta')?.style.maxWidth).toBe('none');
		expect(comboItem('cta')?.style.width).toBe('100%');
		expect(comboItem('cta')?.style.marginLeft).toBe('0px');
		expect(comboItem('cta')?.style.marginRight).toBe('0px');
		expect(comboItem('text')?.classList.contains('is-full-width')).toBe(false);
		expect(comboItem('text')?.style.marginLeft).toBe('auto');
		expect(comboItem('text')?.style.maxWidth).toBe('none');
		expect(comboItem('text')?.style.width).toBe('100%');
		expect(comboItem('banner')?.classList.contains('is-full-width')).toBe(true);
		expect(comboItem('hero')?.style.getPropertyValue('--docs-renderer-content-width')).toBe('100%');
		combo.unmount();
	});

	it('keeps a filled homepage hero at 1200 while the background spans the canvas', async () => {
		const document = createEmptyRendererDocument('sortable');
		document.blocks.push({
			id: 'home-hero',
			module: {
				type: 'hero',
				version: 1,
				props: { eyebrow: '', title: 'Home', description: '', actions: [] }
			},
			appearance: {
				marginTop: 0,
				marginBottom: 72,
				paddingTop: 0,
				paddingBottom: 0,
				fullWidth: true,
				maxWidth: 1200
			}
		});
		const preview = mount(Renderer, { props: { document, modules: BuiltinModules } });
		await flushPromises();
		const published = htmlElementOf(preview.get('[data-renderer-node-id="home-hero"]'));
		expect(preview.get('[data-renderer-node-id="home-hero"]').classes()).toContain('is-full-width');
		expect(published.style.maxWidth).toBe('');
		expect(published.style.getPropertyValue('--docs-renderer-content-width')).toBe('1200px');
		preview.unmount();

		const combo = mount(Combo, { props: { modelValue: document } });
		await flushPromises();
		const item = closestHTMLElement(
			combo.get('[data-renderer-node-id="home-hero"]'),
			'.docs-renderer-frame__item'
		);
		expect(item?.classList.contains('is-full-width')).toBe(true);
		expect(item?.style.maxWidth).toBe('none');
		expect(item?.style.getPropertyValue('--docs-renderer-content-width')).toBe('1200px');
		combo.unmount();
	});

	it('does not apply a module default max width until the instance sets one', async () => {
		const boxed = defineRendererModule({
			identity: { type: 'boxed', version: 1, label: 'Boxed', category: 'Test' },
			widget: { visible: true },
			data: { create: () => ({}) },
			viewer: defineComponent(() => () => h('div', 'boxed')),
			editor: defineComponent(() => () => h('div')),
			frames: { sortable: { maxWidth: 720 } }
		});
		const document = createEmptyRendererDocument('sortable');
		document.blocks.push({
			id: 'boxed',
			module: { type: 'boxed', version: 1, props: {} },
			appearance: { marginTop: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 }
		}, {
			id: 'assigned',
			module: { type: 'boxed', version: 1, props: {} },
			appearance: {
				marginTop: 0,
				marginBottom: 0,
				paddingTop: 0,
				paddingBottom: 0,
				maxWidth: 720
			}
		});
		const preview = mount(Renderer, { props: { document, modules: [boxed] } });
		await flushPromises();
		expect(htmlElementOf(preview.get('[data-renderer-node-id="boxed"]')).style.maxWidth)
			.toBe('');
		expect(htmlElementOf(preview.get('[data-renderer-node-id="boxed"]'))
			.style.getPropertyValue('--docs-renderer-content-width')).toBe('100%');
		expect(htmlElementOf(preview.get('[data-renderer-node-id="assigned"]')).style.maxWidth)
			.toBe('720px');
		preview.unmount();

		const combo = mount(Combo, { props: { modelValue: document, modules: [boxed] } });
		await flushPromises();
		const item = closestHTMLElement(
			combo.get('[data-renderer-node-id="boxed"]'),
			'.docs-renderer-frame__item'
		);
		expect(item?.style.maxWidth).toBe('none');
		expect(item?.classList.contains('is-full-width')).toBe(false);
		const assigned = closestHTMLElement(
			combo.get('[data-renderer-node-id="assigned"]'),
			'.docs-renderer-frame__item'
		);
		expect(assigned?.style.maxWidth).toBe('720px');
		combo.unmount();
	});

	it('keeps features, steps and faq content within the instance max width', async () => {
		const appearance = {
			marginTop: 0,
			marginBottom: 0,
			paddingTop: 0,
			paddingBottom: 0,
			maxWidth: 800
		};
		const document = createEmptyRendererDocument('sortable');
		document.blocks.push({
			id: 'features',
			module: {
				type: 'features',
				version: 1,
				props: {
					title: 'Caps',
					columns: 3,
					items: [{ title: 'One', description: 'Wide' }]
				}
			},
			appearance
		}, {
			id: 'steps',
			module: {
				type: 'steps',
				version: 1,
				props: {
					title: 'Path',
					columns: 3,
					items: [{ title: 'One', description: 'First' }]
				}
			},
			appearance: { ...appearance }
		}, {
			id: 'faq',
			module: {
				type: 'faq',
				version: 1,
				props: {
					title: 'Ask',
					items: [{ question: 'Why', answer: 'Because' }]
				}
			},
			appearance: { ...appearance, fullWidth: true }
		});
		const preview = mount(Renderer, { props: { document, modules: BuiltinModules } });
		await flushPromises();
		const styleOf = (id: string) => htmlElementOf(preview.get(`[data-renderer-node-id="${id}"]`)).style;
		expect(styleOf('features').maxWidth).toBe('800px');
		expect(styleOf('features').getPropertyValue('--docs-renderer-content-width')).toBe('800px');
		expect(styleOf('steps').maxWidth).toBe('800px');
		expect(styleOf('steps').getPropertyValue('--docs-renderer-content-width')).toBe('800px');
		expect(preview.get('[data-renderer-node-id="faq"]').classes()).toContain('is-full-width');
		expect(styleOf('faq').maxWidth).toBe('');
		expect(styleOf('faq').getPropertyValue('--docs-renderer-content-width')).toBe('800px');
		preview.unmount();

		const combo = mount(Combo, { props: { modelValue: document } });
		await flushPromises();
		const comboItem = (id: string) => closestHTMLElement(
			combo.get(`[data-renderer-node-id="${id}"]`),
			'.docs-renderer-frame__item'
		);
		expect(comboItem('features')?.style.maxWidth).toBe('800px');
		expect(comboItem('features')?.style.getPropertyValue('--docs-renderer-content-width')).toBe('800px');
		expect(comboItem('steps')?.style.maxWidth).toBe('800px');
		expect(comboItem('faq')?.classList.contains('is-full-width')).toBe(true);
		expect(comboItem('faq')?.style.maxWidth).toBe('none');
		expect(comboItem('faq')?.style.getPropertyValue('--docs-renderer-content-width')).toBe('800px');
		combo.unmount();
	});

	it('treats boxed max width 0 the same as an unset width', async () => {
		const document = createEmptyRendererDocument('sortable');
		document.blocks.push({
			id: 'features',
			module: {
				type: 'features',
				version: 1,
				props: {
					title: 'Open',
					columns: 3,
					items: [{ title: 'One', description: 'Wide' }]
				}
			},
			appearance: {
				marginTop: 0,
				marginBottom: 0,
				paddingTop: 0,
				paddingBottom: 0,
				fullWidth: false,
				maxWidth: 0
			}
		}, {
			id: 'hero',
			module: {
				type: 'hero',
				version: 1,
				props: { title: 'Open' }
			},
			appearance: {
				marginTop: 0,
				marginBottom: 0,
				paddingTop: 0,
				paddingBottom: 0,
				fullWidth: true,
				maxWidth: 0
			}
		});
		const preview = mount(Renderer, { props: { document, modules: BuiltinModules } });
		await flushPromises();
		const features = htmlElementOf(preview.get('[data-renderer-node-id="features"]'));
		const hero = htmlElementOf(preview.get('[data-renderer-node-id="hero"]'));
		expect(features.style.maxWidth).toBe('');
		expect(features.style.getPropertyValue('--docs-renderer-content-width')).toBe('100%');
		expect(hero.style.maxWidth).toBe('');
		expect(hero.style.getPropertyValue('--docs-renderer-content-width')).toBe('100%');
		preview.unmount();
	});

	it('lets filled features, steps and faq treat a cleared max width as unlimited', async () => {
		const base = {
			marginTop: 0,
			marginBottom: 0,
			paddingTop: 0,
			paddingBottom: 0,
			fullWidth: true
		};
		const document = createEmptyRendererDocument('sortable');
		document.blocks.push({
			id: 'features',
			module: {
				type: 'features',
				version: 1,
				props: { title: 'Open', columns: 3, items: [{ title: 'One' }] }
			},
			appearance: { ...base }
		}, {
			id: 'features-zero',
			module: {
				type: 'features',
				version: 1,
				props: { title: 'Zero', columns: 3, items: [{ title: 'One' }] }
			},
			appearance: { ...base, maxWidth: 0 }
		}, {
			id: 'steps',
			module: {
				type: 'steps',
				version: 1,
				props: { title: 'Path', items: [{ title: 'One' }] }
			},
			appearance: { ...base, maxWidth: 0 }
		}, {
			id: 'faq',
			module: {
				type: 'faq',
				version: 1,
				props: { title: 'Ask', items: [{ question: 'Why', answer: 'Because' }] }
			},
			appearance: { ...base }
		});
		const preview = mount(Renderer, { props: { document, modules: BuiltinModules } });
		await flushPromises();
		const styleOf = (id: string) => htmlElementOf(preview.get(`[data-renderer-node-id="${id}"]`)).style;
		expect(styleOf('features').getPropertyValue('--docs-renderer-content-width')).toBe('100%');
		expect(styleOf('features-zero').getPropertyValue('--docs-renderer-content-width')).toBe('100%');
		expect(styleOf('steps').getPropertyValue('--docs-renderer-content-width')).toBe('100%');
		expect(styleOf('faq').getPropertyValue('--docs-renderer-content-width')).toBe('100%');
		expect(preview.get('[data-renderer-node-id="features"]').classes()).toContain('is-full-width');
		preview.unmount();
	});

	it('keeps sortable appearance margins on combo items so they match the published page', async () => {
		const document = createEmptyRendererDocument('sortable');
		document.blocks.push({
			id: 'features',
			module: {
				type: 'features',
				version: 1,
				props: {
					title: 'Caps',
					columns: 3,
					gap: 24,
					items: [{ title: 'One', description: 'Wide' }]
				}
			},
			appearance: {
				marginTop: 16,
				marginBottom: 88,
				paddingTop: 0,
				paddingBottom: 0
			}
		});
		const preview = mount(Renderer, { props: { document, modules: BuiltinModules } });
		await flushPromises();
		const published = htmlElementOf(preview.get('[data-renderer-node-id="features"]'));
		expect(published.style.marginBottom).toBe('88px');
		expect(published.style.marginTop).toBe('16px');
		expect(preview.get('.docs-renderer-features').classes()).not.toContain('is-full-width');
		preview.unmount();

		const combo = mount(Combo, { props: { modelValue: document } });
		await flushPromises();
		const node = htmlElementOf(combo.get('[data-renderer-node-id="features"]'));
		const item = closestHTMLElement(node, '.docs-renderer-frame__item');
		expect(item?.classList.contains('is-full-width')).toBe(false);
		expect(item?.style.marginTop).toBe('16px');
		expect(item?.style.marginBottom).toBe('88px');
		expect(node.style.marginTop).toBe('0px');
		expect(node.style.marginBottom).toBe('0px');
		combo.unmount();
	});

	it('keeps empty sortable nodes selectable only in Combo', async () => {
		const document = createEmptyRendererDocument('sortable');
		document.blocks.push({
			id: 'empty-text',
			module: { type: 'text', version: 1, props: { text: '' } },
			appearance: { marginTop: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 }
		});
		const combo = mount(Combo, { props: { modelValue: document } });
		await flushPromises();
		expect(htmlElementOf(combo.find('[data-renderer-node-id="empty-text"]')).style.minHeight)
			.toBe('20px');
		combo.unmount();
	});

	it('isolates a viewer render failure without hiding healthy siblings', async () => {
		const broken = defineRendererModule({
			identity: { type: 'broken', version: 1, label: 'Broken', category: 'Test' },
			widget: { visible: true },
			data: { create: () => ({}) },
			viewer: defineComponent(() => () => {
				throw new Error('Viewer failed');
			}),
			editor: defineComponent(() => () => h('div')),
			frames: { sortable: {} }
		});
		const document = createEmptyRendererDocument('sortable');
		document.blocks.push({
			id: 'broken',
			module: { type: 'broken', version: 1, props: {} },
			appearance: { marginTop: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 }
		}, {
			id: 'healthy',
			module: { type: 'text', version: 1, props: { text: 'Still visible' } },
			appearance: { marginTop: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 }
		});
		const wrapper = mount(Renderer, { props: { document, modules: [broken, ...BuiltinModules] } });
		await flushPromises();
		expect(wrapper.text()).toContain('Viewer failed');
		expect(wrapper.text()).toContain('Still visible');
	});

	it('recovers a failed viewer after its props are corrected', async () => {
		const conditional = defineRendererModule({
			identity: { type: 'conditional', version: 1, label: 'Conditional', category: 'Test' },
			widget: { visible: true },
			data: { create: () => ({ broken: true }) },
			viewer: defineComponent({
				props: { node: { type: Object, required: true } },
				setup: props => () => {
					const node = props.node as RendererSortableDocument['blocks'][number];
					if (node.module.props.broken) throw new Error('Temporary failure');
					return h('div', 'Recovered viewer');
				}
			}),
			editor: defineComponent(() => () => h('div')),
			frames: { sortable: {} }
		});
		const document = reactive(createEmptyRendererDocument('sortable'));
		document.blocks.push({
			id: 'conditional',
			module: { type: 'conditional', version: 1, props: { broken: true } },
			appearance: { marginTop: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 }
		});
		const wrapper = mount(Renderer, { props: { document, modules: [conditional] } });
		await flushPromises();
		expect(wrapper.text()).toContain('Temporary failure');
		document.blocks[0].module.props.broken = false;
		await flushPromises();
		expect(wrapper.text()).toContain('Recovered viewer');
	});

	it('provides context locale to nested business viewers', async () => {
		const localized = defineRendererModule({
			identity: { type: 'localized', version: 1, label: 'Localized', category: 'Test' },
			widget: { visible: true },
			data: { create: () => ({}) },
			viewer: defineComponent(() => {
				const { t } = useLocale();
				return () => h('div', t('renderer.common.untitledPage'));
			}),
			editor: defineComponent(() => () => h('div')),
			frames: { sortable: {} }
		});
		const document = createEmptyRendererDocument('sortable');
		document.blocks.push({
			id: 'localized',
			module: { type: 'localized', version: 1, props: {} },
			appearance: { marginTop: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 }
		});
		const wrapper = mount(Renderer, {
			props: { document, modules: [localized], context: { locale: zhCN } }
		});
		await flushPromises();
		expect(wrapper.text()).toContain('未命名页面');
	});

	it('treats an explicit empty module list as authoritative', async () => {
		const document = createEmptyRendererDocument('sortable');
		document.blocks.push({
			id: 'title',
			module: { type: 'title', version: 1, props: { text: 'Hidden' } },
			appearance: { marginTop: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 }
		});
		const wrapper = mount(Renderer, { props: { document, modules: [] } });
		await flushPromises();
		expect(wrapper.text()).not.toContain('Hidden');
		expect(wrapper.text()).toContain('未知模块');
	});

	it('fits draggable Renderer documents by width, containment or no scaling', async () => {
		const document = createEmptyRendererDocument('draggable');
		document.layout.width = 1000;
		document.layout.height = 500;
		const wrapper = mount(Renderer, { props: { document, fit: 'width' } });
		await flushPromises();
		const host = htmlElementOf(wrapper.get('.docs-renderer'));
		Object.defineProperties(host, {
			clientWidth: { configurable: true, value: 500 },
			clientHeight: { configurable: true, value: 100 }
		});
		await wrapper.setProps({ fit: 'none' });
		await wrapper.setProps({ fit: 'width' });
		expect(wrapper.get('.docs-renderer__canvas').attributes('style')).toContain('scale(0.5)');
		await wrapper.setProps({ fit: 'contain' });
		expect(wrapper.get('.docs-renderer__canvas').attributes('style')).toContain('scale(0.2)');
		expect(wrapper.get('.docs-renderer').attributes('style')).toContain('height: 100%');
		await wrapper.setProps({ fit: 'none' });
		expect(wrapper.get('.docs-renderer__canvas').attributes('style')).toContain('scale(1)');
	});

	it('renders fatal structural errors and isolated lazy-module failures', async () => {
		const invalid = mount(Renderer, { props: { document: invalidValue<RendererDocument>({ schemaVersion: 1 }) } });
		await flushPromises();
		expect(invalid.find('.docs-renderer__error').exists()).toBe(true);

		const document = createEmptyRendererDocument('sortable');
		document.blocks.push({
			id: 'offline',
			module: { type: 'offline', version: 1, props: {} },
			appearance: { marginTop: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 }
		});
		const offline = mount(RendererNode, {
			props: {
				node: document.blocks[0],
				context: { scene: 'renderer', frameMode: 'sortable', readonly: true },
				catalog: createRendererModuleCatalog([{
					type: 'offline',
					load: async () => { throw 'Module offline'; }
				}]),
				frameMode: 'sortable'
			}
		});
		await flushPromises();
		expect(offline.text()).toContain('Module offline');
	});

	it('reacts to nested document changes and replacement module catalogs', async () => {
		const document = reactive(createEmptyRendererDocument('sortable'));
		document.blocks.push({
			id: 'dynamic',
			module: { type: 'dynamic', version: 1, props: { text: 'First' } },
			appearance: { marginTop: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 }
		});
		const definition = (prefix: string) => defineRendererModule({
			identity: { type: 'dynamic', version: 1, label: 'Dynamic', category: 'Test' },
			widget: { visible: true },
			data: { create: () => ({ text: '' }) },
			viewer: defineComponent({
				props: { node: { type: Object, required: true } },
				setup: props => () => h('div', `${prefix}:${(props.node as RendererSortableDocument['blocks'][number]).module.props.text}`)
			}),
			editor: defineComponent(() => () => h('div')),
			frames: { sortable: {} }
		});
		const wrapper = mount(Renderer, { props: { document, modules: [definition('A')] } });
		await flushPromises();
		expect(wrapper.text()).toContain('A:First');
		document.blocks[0].module.props.text = 'Second';
		await flushPromises();
		expect(wrapper.text()).toContain('A:Second');
		await wrapper.setProps({ modules: [definition('B')] });
		await flushPromises();
		expect(wrapper.text()).toContain('B:Second');
	});

	it('opens with an empty canvas and exposes the public instance API', async () => {
		const wrapper = mount(Combo, {
			props: { modelValue: null },
			attachTo: document.body
		});
		await flushPromises();
		expect(wrapper.find('.docs-renderer-combo').attributes('data-vc-theme')).toBeUndefined();
		expect(wrapper.find('.docs-renderer-combo').attributes('data-doc-theme')).toBeUndefined();
		expect(wrapper.text()).toContain('Drop modules here');
		expect(wrapper.text()).toMatch(/Canvas width/);
		expect(wrapper.text()).toMatch(/Minimum height/);
		expect(wrapper.text()).toMatch(/Background/);
		expect(wrapper.findComponent(PageEditor).html()).toContain('docs-renderer-module-editor');
		const canvasStyleOf = () => wrapper.find('.docs-renderer-frame__canvas').attributes('style') || '';
		const cssPx = (style: string, property: string) => {
			const match = new RegExp(`${property}:\\s*(\\d+(?:\\.\\d+)?)px`).exec(style);
			return match ? Number(match[1]) : Number.NaN;
		};
		expect(canvasStyleOf()).not.toContain('--docs-renderer-content-width');
		expect(canvasStyleOf()).not.toMatch(/min-height/);
		expect(cssPx(canvasStyleOf(), 'width')).toBe(1920);
		const canvasWidth = 1920;
		const zoomSelect = wrapper.get('.docs-renderer-zoom-bar').findComponent(Select);
		expect(zoomSelect.props('placement')).toBe('top-left');
		zoomSelect.vm.$emit('ready');
		zoomSelect.vm.$emit('update:modelValue', 0.5);
		await flushPromises();
		expect(wrapper.find('.docs-renderer-frame__scaled--sortable').attributes('style'))
			.toContain(`width: ${canvasWidth * 0.5}px`);
		expect(wrapper.find('.docs-renderer-frame__viewport').attributes('style')).toContain('padding: 48px');
		zoomSelect.vm.$emit('update:modelValue', 2);
		await flushPromises();
		expect(wrapper.find('.docs-renderer-frame__viewport').attributes('style')).toContain('padding: 48px');
		expect(wrapper.find('.docs-renderer-frame__scaled--sortable').attributes('style'))
			.toContain(`width: ${canvasWidth * 2}px`);
		expect(canvasStyleOf()).toContain('margin: 0');
		wrapper.findComponent(PageEditor).vm.$emit('update:modelValue', {
			...instanceDocument(wrapper).layout,
			maxWidth: 1400
		});
		await flushPromises();
		expect(instanceDocument(wrapper).layout).toEqual(expect.objectContaining({ maxWidth: 1400 }));
		expect(cssPx(canvasStyleOf(), 'width')).toBe(1400);
		const instance = comboVm(wrapper);
		expect(instance.getDocument().schemaVersion).toBe(2);
		expect((await instance.validate()).valid).toBe(true);
		instance.undo();
		instance.redo();
		const exported = JSON.parse(instance.exportDocument());
		expect(exported.schemaVersion).toBe(2);
		const imported = await instance.importDocument({
			...exported,
			meta: { ...exported.meta, title: 'Imported empty' }
		});
		expect(imported.valid).toBe(true);
		expect(instance.getDocument().meta.title).toBe('Imported empty');
		instance.select(null);
		wrapper.unmount();
	});

	it('selects the first invalid node and does not emit save', async () => {
		const document = createEmptyRendererDocument('sortable');
		document.blocks.push({
			id: 'invalid-title',
			module: {
				type: 'title',
				version: 1,
				props: {
					text: '', level: 2, fontSize: 32, fontWeight: 700,
					lineHeight: 1.3, letterSpacing: 0, color: '', align: 'left'
				}
			},
			appearance: { marginTop: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 }
		});
		const wrapper = mount(Combo, { props: { modelValue: document } });
		await flushPromises();
		const result = await comboVm(wrapper).save();
		await flushPromises();
		expect(result.valid).toBe(false);
		expect(result.issues).toContainEqual(expect.objectContaining({ nodeId: 'invalid-title' }));
		expect(wrapper.emitted('save')).toBeUndefined();
		expect(wrapper.find('.docs-renderer-frame__item').classes()).toContain('is-selected');
	});

	it('does not crash when an external document contains a cyclic value', async () => {
		const document = createEmptyRendererDocument('sortable');
		const props: Record<string, unknown> = {};
		props.self = props;
		document.blocks.push({
			id: 'cyclic',
			module: { type: 'text', version: 1, props },
			appearance: { marginTop: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 }
		});
		const wrapper = mount(Combo, { props: { modelValue: document } });
		await flushPromises();
		expect(wrapper.emitted('error')?.[0]?.[0]).toEqual(expect.arrayContaining([
			expect.objectContaining({ code: 'module.props' })
		]));
		wrapper.unmount();
	});

	it('adds a widget and emits a flat V2 document', async () => {
		const wrapper = mount(Combo, { props: { modelValue: createEmptyRendererDocument('sortable') } });
		await flushPromises();
		expect(wrapper.findAll('.docs-renderer-widget__label').some(item => item.text() === 'Page')).toBe(false);
		const textButton = wrapper.findAll('.docs-renderer-widget__item').find(item => item.get('.docs-renderer-widget__label').text() === 'Text');
		await textButton?.trigger('click');
		await flushPromises();
		const update = wrapper.emitted('update:modelValue')?.at(-1)?.[0] as RendererSortableDocument;
		expect(update.blocks).toHaveLength(1);
		expect(update.blocks[0]).toHaveProperty('appearance');
		expect(update.blocks[0].appearance).toEqual(expect.objectContaining({
			paddingLeft: 0,
			paddingRight: 0,
			fullWidth: false,
			maxWidth: 1200
		}));
		expect(update.blocks[0]).not.toHaveProperty('children');
		await wrapper.findAll('.docs-renderer-widget__tab').find(tab => tab.text() === 'Page')?.trigger('click');
		await flushPromises();
		const heroButton = wrapper.findAll('.docs-renderer-widget__item')
			.find(item => item.get('.docs-renderer-widget__label').text() === 'Hero');
		await heroButton?.trigger('click');
		await flushPromises();
		const withHero = wrapper.emitted('update:modelValue')?.at(-1)?.[0] as RendererSortableDocument;
		expect(withHero.blocks.some(node => node.module.type === 'hero' && node.appearance.fullWidth)).toBe(true);
		expect(withHero.blocks.find(node => node.module.type === 'hero')?.appearance.maxWidth).toBeUndefined();
	});

	it('treats an explicit empty Combo module list as authoritative', async () => {
		const wrapper = mount(Combo, {
			props: { modelValue: createEmptyRendererDocument('sortable'), modules: [] }
		});
		await flushPromises();
		expect(wrapper.find('.docs-renderer-widget__item').exists()).toBe(false);
		wrapper.unmount();
	});

	it('mirrors context.theme onto Combo theme attributes', async () => {
		const wrapper = mount(Combo, {
			props: {
				modelValue: createEmptyRendererDocument('sortable'),
				context: { theme: 'dark' }
			}
		});
		await flushPromises();
		const root = wrapper.get('.docs-renderer-combo');
		expect(root.attributes('data-vc-theme')).toBe('dark');
		expect(root.attributes('data-doc-theme')).toBe('dark');
		await wrapper.setProps({ context: { theme: 'light' } });
		await flushPromises();
		expect(root.attributes('data-vc-theme')).toBe('light');
		expect(root.attributes('data-doc-theme')).toBe('light');
		wrapper.unmount();
	});

	it('keeps canvas module clicks inert while editing', async () => {
		const navigate = vi.fn();
		const document = createEmptyRendererDocument('sortable');
		document.blocks.push({
			id: 'actions',
			module: {
				type: 'actions',
				version: 1,
				props: { items: [{ label: 'Get started', to: '/guide', variant: 'primary' }] }
			},
			appearance: { marginTop: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 }
		});
		const wrapper = mount(Combo, {
			props: {
				modelValue: document,
				context: { services: { navigate } }
			}
		});
		await flushPromises();
		expect(wrapper.get('.docs-renderer-node--actions').classes()).toContain('is-editing');
		expect(wrapper.find('.docs-renderer-actions a').exists()).toBe(false);
		await wrapper.get('.docs-renderer-actions button').trigger('click');
		expect(navigate).not.toHaveBeenCalled();
		wrapper.unmount();
	});

	it('returns to page properties when clicking outside a selected module', async () => {
		const document = createEmptyRendererDocument('sortable');
		document.blocks.push({
			id: 'text',
			module: { type: 'text', version: 1, props: { text: 'Keep' } },
			appearance: { marginTop: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 }
		});
		const wrapper = mount(Combo, { props: { modelValue: document } });
		await flushPromises();
		const instance = comboVm(wrapper);
		instance.select('text');
		await flushPromises();
		expect(wrapper.findComponent(PageEditor).exists()).toBe(false);
		expect(wrapper.findComponent(TextEditor).exists()).toBe(true);
		expect(wrapper.get('.docs-renderer-panel-title small').text()).toBe('text');
		expect(wrapper.text()).toMatch(/Fill screen/);
		expect(wrapper.text()).toMatch(/Maximum width/);
		await wrapper.get('.docs-renderer-combo__stage').trigger('pointerdown');
		await flushPromises();
		expect(wrapper.findComponent(PageEditor).exists()).toBe(true);
		expect(wrapper.findComponent(TextEditor).exists()).toBe(false);
		expect(wrapper.get('.docs-renderer-panel-title small').text()).toBe('Page');
		expect(wrapper.text()).toMatch(/Canvas width/);
		instance.select('text');
		await flushPromises();
		await wrapper.get('.docs-renderer-editor').trigger('pointerdown');
		expect(wrapper.findComponent(TextEditor).exists()).toBe(true);
		expect(wrapper.get('.docs-renderer-panel-title small').text()).toBe('text');
		wrapper.unmount();
	});

	it('switches the canvas between sortable and draggable from page properties', async () => {
		const document = createEmptyRendererDocument('sortable');
		document.blocks.push({
			id: 'text',
			module: { type: 'text', version: 1, props: { text: 'Keep' } },
			appearance: { marginTop: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 }
		}, {
			id: 'space',
			module: { type: 'space', version: 1, props: { height: 24, background: '' } },
			appearance: { marginTop: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 }
		});
		const wrapper = mount(Combo, { props: { modelValue: document } });
		await flushPromises();
		wrapper.findComponent(PageEditor).vm.$emit('update:modelValue', {
			mode: 'draggable',
			width: 1180,
			height: 800,
			background: '#ffffff'
		});
		await flushPromises();
		const free = instanceDraggableDocument(wrapper);
		expect(free.layout.mode).toBe('draggable');
		expect(free.blocks.map(node => node.id)).toEqual(['text']);
		expect(free.blocks[0].placement).toEqual(expect.objectContaining({ y: 40, width: 280 }));
		expect(wrapper.find('.docs-renderer-frame--draggable').exists()).toBe(true);
		wrapper.findComponent(PageEditor).vm.$emit('update:modelValue', {
			mode: 'sortable',
			maxWidth: 1180,
			minHeight: 800,
			background: '#ffffff'
		});
		await flushPromises();
		const flow = instanceDocument(wrapper);
		expect(flow.layout.mode).toBe('sortable');
		expect(flow.blocks[0]).toEqual(expect.objectContaining({
			id: 'text',
			appearance: expect.objectContaining({ marginTop: 0, paddingLeft: 0 })
		}));
		expect(wrapper.find('.docs-renderer-frame--sortable').exists()).toBe(true);
		wrapper.unmount();
	});

	it('disables a widget when its module reaches maxInstances', async () => {
		const Viewer = defineComponent(() => () => h('div', 'limited'));
		const Editor = defineComponent(() => () => h('div'));
		const limited = defineRendererModule({
			identity: { type: 'limited', version: 1, label: 'Limited', category: 'Test' },
			widget: { visible: true },
			data: { create: () => ({}) },
			viewer: Viewer,
			editor: Editor,
			frames: { sortable: { maxInstances: 1 } }
		});
		const document = createEmptyRendererDocument('sortable');
		document.blocks.push({
			id: 'limited',
			module: { type: 'limited', version: 1, props: {} },
			appearance: { marginTop: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 }
		});
		const wrapper = mount(Combo, { props: { modelValue: document, modules: [limited] } });
		await flushPromises();
		expect(wrapper.get('.docs-renderer-widget__item').attributes('disabled')).toBeDefined();
	});

	it('renders draggable controls and the eight resize handles', async () => {
		const document = createEmptyRendererDocument('draggable');
		document.blocks.push({
			id: 'first',
			module: { type: 'text', version: 1, props: { text: 'First' } },
			placement: { x: 10, y: 20, width: 160, height: 80, rotate: 23, zIndex: 1 }
		}, {
			id: 'second',
			module: { type: 'title', version: 1, props: { text: 'Second', level: 2 } },
			placement: { x: 30, y: 40, width: 180, height: 90, rotate: -17, zIndex: 2 }
		});
		const wrapper = mount(Combo, { props: { modelValue: document } });
		await flushPromises();
		expect(wrapper.find('.docs-renderer-layers').exists()).toBe(false);
		const second = wrapper.findAll('[data-renderer-node-id="second"]')[0];
		await second.trigger('pointerdown');
		await flushPromises();
		expect(wrapper.findAll('.docs-renderer-selection__handle')).toHaveLength(8);
		expect(wrapper.find('.docs-renderer-selection__rotate').exists()).toBe(true);
		expect(wrapper.find('.docs-renderer-combo__stage').classes()).toContain('is-draggable');
		expect(wrapper.find('.docs-renderer-combo__stage-bar').exists()).toBe(false);
		await wrapper.findAll('button').find(button => button.text() === 'Grid')?.trigger('click');
		expect(wrapper.find('.docs-renderer-frame__artboard').classes()).toContain('has-grid');
		wrapper.unmount();
	});

	it('creates draggable modules at the drop point and validates a successful save', async () => {
		const document = createEmptyRendererDocument('draggable');
		const wrapper = mount(Combo, { props: { modelValue: document } });
		await flushPromises();
		wrapper.findComponent(DraggableFrame).vm.$emit('create', {
			type: 'text',
			index: 0,
			point: { x: 300, y: 200 }
		});
		await flushPromises();
		const created = instanceDraggableDocument(wrapper).blocks[0];
		expect(created.placement).toEqual(expect.objectContaining({ x: 160, y: 160, zIndex: 1 }));
		const result = await comboVm(wrapper).save();
		expect(result.valid).toBe(true);
		expect(wrapper.emitted('save')?.[0]?.[0]).toEqual(expect.objectContaining({ schemaVersion: 2 }));
	});

	it('syncs external documents and rejects invalid or cyclic replacements', async () => {
		const wrapper = mount(Combo, { props: { modelValue: createEmptyRendererDocument('sortable') } });
		const replacement = createEmptyRendererDocument('sortable');
		replacement.meta.title = 'External replacement';
		await wrapper.setProps({ modelValue: replacement });
		expect(instanceDocument(wrapper).meta.title).toBe('External replacement');

		await wrapper.setProps({ modelValue: invalidValue<RendererDocument>({ schemaVersion: 1 }) });
		expect(wrapper.emitted('error')?.at(-1)?.[0]).toEqual(expect.arrayContaining([
			expect.objectContaining({ severity: 'error' })
		]));
		const cyclic = createEmptyRendererDocument('sortable');
		const value: Record<string, unknown> = {};
		value.self = value;
		cyclic.meta = invalidValue<RendererDocument['meta']>(value);
		await wrapper.setProps({ modelValue: cyclic });
		expect(wrapper.emitted('error')?.at(-1)?.[0]).toContainEqual(expect.objectContaining({ code: 'document.json' }));
	});

	it('supports toolbar back, export and JSON file import without mutating invalid input', async () => {
		const document = createEmptyRendererDocument('sortable');
		document.meta.title = 'Exported';
		const wrapper = mount(Combo, { props: { modelValue: document }, attachTo: globalThis.document.body });
		await flushPromises();
		await wrapper.findAll('button').find(button => button.text().includes('Back'))?.trigger('click');
		expect(wrapper.emitted('back')).toHaveLength(1);

		const objectUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:renderer');
		const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
		const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
		await wrapper.findAll('button').find(button => button.text() === 'Export')?.trigger('click');
		expect(objectUrl).toHaveBeenCalled();
		expect(click).toHaveBeenCalled();
		expect(revoke).toHaveBeenCalledWith('blob:renderer');

		const input = wrapper.get('input[type="file"]');
		const inputClick = vi.spyOn(input.element as HTMLInputElement, 'click').mockImplementation(() => undefined);
		await wrapper.findAll('button').find(button => button.text() === 'Import')?.trigger('click');
		expect(inputClick).toHaveBeenCalled();
		const imported = createEmptyRendererDocument('sortable');
		imported.meta.title = 'Imported';
		Object.defineProperty(input.element, 'files', {
			configurable: true,
			value: [new File([JSON.stringify(imported)], 'page.json', { type: 'application/json' })]
		});
		await input.trigger('change');
		await flushPromises();
		expect(instanceDocument(wrapper).meta.title).toBe('Imported');

		Object.defineProperty(input.element, 'files', {
			configurable: true,
			value: [new File(['{broken'], 'broken.json', { type: 'application/json' })]
		});
		await input.trigger('change');
		await flushPromises();
		expect(instanceDocument(wrapper).meta.title).toBe('Imported');
		Object.defineProperty(input.element, 'files', { configurable: true, value: [] });
		await input.trigger('change');
		wrapper.unmount();
	});

	it('handles undo, redo and deletable keyboard commands outside form controls', async () => {
		const document = createEmptyRendererDocument('sortable');
		document.blocks.push({
			id: 'space',
			module: { type: 'space', version: 1, props: { height: 24, background: '' } },
			appearance: { marginTop: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 }
		});
		const wrapper = mount(Combo, { props: { modelValue: document } });
		await flushPromises();
		const instance = comboVm(wrapper);
		instance.select('space');
		await wrapper.get('.docs-renderer-combo').trigger('keydown', { key: 'Delete' });
		await flushPromises();
		expect(instanceDocument(wrapper).blocks).toHaveLength(0);
		await wrapper.findAll('button').find(button => button.text() === 'Undo')?.trigger('click');
		expect(instanceDocument(wrapper).blocks).toHaveLength(1);
		await wrapper.findAll('button').find(button => button.text() === 'Redo')?.trigger('click');
		expect(instanceDocument(wrapper).blocks).toHaveLength(0);
		await wrapper.get('.docs-renderer-combo').trigger('keydown', { key: 'z', ctrlKey: true });
		expect(instanceDocument(wrapper).blocks).toHaveLength(1);
		await wrapper.get('.docs-renderer-combo').trigger('keydown', { key: 'z', ctrlKey: true, shiftKey: true });
		expect(instanceDocument(wrapper).blocks).toHaveLength(0);

		await wrapper.find('input[type="file"]').trigger('keydown', { key: 'z', ctrlKey: true });
		expect(instanceDocument(wrapper).blocks).toHaveLength(0);
		wrapper.unmount();
	});

	it('copies, pastes and skips cutting grouped modules from the keyboard', async () => {
		const document = createEmptyRendererDocument('draggable');
		document.blocks.push({
			id: 'a',
			module: { type: 'text', version: 1, props: { text: 'A' } },
			placement: { x: 10, y: 20, width: 100, height: 80, rotate: 0, zIndex: 1 }
		}, {
			id: 'b',
			module: { type: 'title', version: 1, props: { text: 'B' } },
			placement: { x: 240, y: 180, width: 120, height: 70, rotate: 0, zIndex: 2 }
		});
		const wrapper = mount(Combo, { props: { modelValue: document } });
		await flushPromises();
		const instance = comboVm(wrapper);
		instance.select('a');
		await wrapper.get('.docs-renderer-combo').trigger('keydown', { key: 'c', ctrlKey: true });
		await wrapper.get('.docs-renderer-combo').trigger('keydown', { key: 'v', ctrlKey: true });
		await flushPromises();
		expect(instanceDraggableDocument(wrapper).blocks).toHaveLength(3);
		instance.select('a');
		await wrapper.get('.docs-renderer-combo').trigger('keydown', { key: 'x', ctrlKey: true });
		await flushPromises();
		expect(instanceDraggableDocument(wrapper).blocks.some(node => node.id === 'a')).toBe(false);
		wrapper.unmount();
	});

	it('opens preview from the toolbar and JSON from the stage bar', async () => {
		const wrapper = mount(Combo, {
			props: { modelValue: createEmptyRendererDocument('sortable') },
			attachTo: globalThis.document.body
		});
		await flushPromises();
		await wrapper.findAll('button').find(button => button.text() === 'Preview')?.trigger('click');
		await flushPromises();
		const previewClose = globalThis.document.body.querySelector<HTMLButtonElement>('.docs-renderer-preview-modal .vc-modal__close');
		previewClose?.click();
		await flushPromises();
		await wrapper.findAll('button').find(button => button.text() === 'Save')?.trigger('click');
		await flushPromises();
		expect(wrapper.emitted('save')).toHaveLength(1);
		expect(wrapper.findAll('button').some(button => button.text() === 'Clear draft')).toBe(false);

		expect(wrapper.findAll('button').some(button => button.text().includes('blocks'))).toBe(false);
		await wrapper.get('.docs-renderer-combo__stage-bar').trigger('click');
		await flushPromises();
		const cancel = [...globalThis.document.body.querySelectorAll<HTMLButtonElement>('.docs-renderer-json-modal button')]
			.find(button => button.textContent?.trim() === 'Cancel');
		cancel?.click();
		await flushPromises();
		wrapper.unmount();
	});

	it('keeps create constraints authoritative even when intent bypasses the Widget', async () => {
		const Viewer = defineComponent(() => () => h('div', 'limited'));
		const Editor = defineComponent(() => () => h('div'));
		const limited = defineRendererModule({
			identity: { type: 'limited', version: 1, label: 'Limited', category: 'Test' },
			widget: { visible: true, presets: [{ key: 'valid', label: 'Valid', create: () => ({ props: { preset: true } }) }] },
			data: { create: () => ({ base: true }) },
			viewer: Viewer,
			editor: Editor,
			frames: {
				sortable: {
					maxInstances: 1,
					create: () => ({ appearance: { marginTop: 12 }, props: { frame: true } })
				}
			}
		});
		const wrapper = mount(Combo, {
			props: { modelValue: createEmptyRendererDocument('sortable'), modules: [limited] }
		});
		await flushPromises();
		const frame = wrapper.findComponent(SortableFrame);
		frame.vm.$emit('create', { type: 'limited', presetKey: 'missing', index: 0 });
		frame.vm.$emit('create', { type: 'missing', index: 0 });
		await flushPromises();
		expect(instanceDocument(wrapper).blocks).toHaveLength(0);
		frame.vm.$emit('create', { type: 'limited', presetKey: 'valid', index: 0 });
		await flushPromises();
		expect(instanceDocument(wrapper).blocks[0]).toEqual(expect.objectContaining({
			module: expect.objectContaining({ props: { base: true, frame: true, preset: true } }),
			appearance: expect.objectContaining({ marginTop: 12 })
		}));
		frame.vm.$emit('create', { type: 'limited', presetKey: 'valid', index: 1 });
		await flushPromises();
		expect(instanceDocument(wrapper).blocks).toHaveLength(1);
	});

	it('restores a newer draft and persists later document changes', async () => {
		const key = `draft-${Date.now()}`;
		const cache = new RendererDraftCache();
		const draft = createEmptyRendererDocument('sortable');
		draft.meta.title = 'Recovered draft';
		await cache.set({ key, document: draft, updatedAt: 200 });
		const source = createEmptyRendererDocument('sortable');
		source.meta.updatedAt = 100;
		const wrapper = mount(Combo, { props: { modelValue: source, draftKey: key } });
		await vi.waitFor(() => expect(instanceDocument(wrapper).meta.title).toBe('Recovered draft'));
		await wrapper.findAll('.docs-renderer-widget__item').find(button => button.get('.docs-renderer-widget__label').text() === 'Text')?.trigger('click');
		await new Promise(resolve => setTimeout(resolve, 520));
		const persisted = await cache.get(key);
		expect(persisted?.document.blocks).toHaveLength(1);
		wrapper.unmount();
		await cache.remove(key);
	});

	it('clears the indexeddb draft and restores the source document', async () => {
		const key = `draft-clear-${Date.now()}`;
		const cache = new RendererDraftCache();
		const draft = createEmptyRendererDocument('sortable');
		draft.meta.title = 'Recovered draft';
		await cache.set({ key, document: draft, updatedAt: 200 });
		const source = createEmptyRendererDocument('sortable');
		source.meta.title = 'Source page';
		source.meta.updatedAt = 100;
		const wrapper = mount(Combo, { props: { modelValue: source, draftKey: key } });
		await vi.waitFor(() => expect(instanceDocument(wrapper).meta.title).toBe('Recovered draft'));
		const button = wrapper.get('.docs-renderer-combo__actions')
			.findAll('button')
			.find(item => item.text() === 'Clear draft');
		expect(button).toBeTruthy();
		await button!.trigger('click');
		await vi.waitFor(() => expect(instanceDocument(wrapper).meta.title).toBe('Source page'));
		expect(await cache.get(key)).toBeNull();
		wrapper.unmount();
	});

	it('removes the indexeddb draft after a successful save', async () => {
		const key = `draft-save-${Date.now()}`;
		const cache = new RendererDraftCache();
		const draft = createEmptyRendererDocument('sortable');
		draft.meta.title = 'Recovered draft';
		await cache.set({ key, document: draft, updatedAt: 200 });
		const source = createEmptyRendererDocument('sortable');
		source.meta.updatedAt = 100;
		const wrapper = mount(Combo, { props: { modelValue: source, draftKey: key } });
		await vi.waitFor(() => expect(instanceDocument(wrapper).meta.title).toBe('Recovered draft'));
		await wrapper.findAll('button').find(button => button.text() === 'Save')?.trigger('click');
		await flushPromises();
		expect(await cache.get(key)).toBeNull();
		wrapper.unmount();
	});
});

const instanceDocument = (wrapper: VueWrapper<InstanceType<typeof Combo>>) => (
	sortableDocumentOf(comboVm(wrapper).getDocument())
);

const instanceDraggableDocument = (wrapper: VueWrapper<InstanceType<typeof Combo>>) => (
	draggableDocumentOf(comboVm(wrapper).getDocument())
);
