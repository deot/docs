// @vitest-environment jsdom

import { IconManager } from '@deot/vc';
import { flushPromises, mount } from '@vue/test-utils';
import {
	BuiltinModules,
	createEmptyRendererDocument,
	createRendererPageNode,
	isRendererPageModule,
	isRendererSelectionModule,
	rendererContentBlocks,
	rendererPublishedBlocks
} from '../src';
import type {
	RendererCreateContext,
	RendererModuleContext,
	RendererModuleDefinition,
	RendererSortableNode
} from '../src';
import { DraggableOnlyModules } from '../src/modules';
import { featureIconKind, listBuiltinIconTypes } from '../src/modules/sortable/features/icon';
import {
	collectImageResources,
	isDirectImageSource,
	toDisplayImageSrc
} from '../src/modules/shared/image-source';
import { resolveLocaleText, toRecord, validateNumberRange } from '../src/modules/shared/utils';

const moduleContext: RendererModuleContext = {
	scene: 'combo',
	frameMode: 'sortable',
	readonly: false,
	lang: 'en-US',
	services: { navigate: vi.fn() }
};
const document = createEmptyRendererDocument('sortable');
const createContext: RendererCreateContext = {
	frameMode: 'sortable',
	index: 0,
	document,
	context: moduleContext
};

const mountDefinition = async (definition: RendererModuleDefinition) => {
	const value = toRecord(definition.data.create(createContext));
	const node: RendererSortableNode = {
		id: definition.identity.type,
		module: {
			type: definition.identity.type,
			version: definition.identity.version,
			props: value
		},
		appearance: { marginTop: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 }
	};
	const viewer = mount(definition.viewer, {
		props: { node, context: { ...moduleContext, scene: 'renderer', readonly: true } }
	});
	const editor = mount(definition.editor, {
		props: { node, modelValue: value, context: moduleContext }
	});
	await flushPromises();
	return { value, viewer, editor };
};

describe('built-in renderer modules', () => {
	it('keeps the draggable-only module bucket empty for the first release', () => {
		expect(DraggableOnlyModules).toEqual([]);
		expect(BuiltinModules).toHaveLength(15);
	});

	it('keeps the default page module out of the widget library and document blocks', () => {
		const definition = BuiltinModules.find(item => 'identity' in item && item.identity.type === 'page');
		if (!definition || !('identity' in definition)) throw new Error('page unavailable');
		expect(definition.widget.visible).toBe(false);
		expect(definition.frames.sortable?.widget?.visible).toBe(false);
		expect(definition.frames.draggable?.widget?.visible).toBe(false);
		expect(definition.frames.sortable?.maxInstances).toBe(1);
		expect(definition.frames.sortable?.movable).toBe(false);
		expect(definition.frames.sortable?.deletable).toBe(false);
		expect(isRendererPageModule(definition.identity.type)).toBe(true);
		const layout = createEmptyRendererDocument('draggable').layout;
		const node = createRendererPageNode(layout);
		expect(node.id).toBe('page');
		expect(rendererContentBlocks([node, { module: { type: 'text' } }])).toEqual([{ module: { type: 'text' } }]);
		expect(createEmptyRendererDocument().blocks).toEqual([]);
		expect(definition.data.create(createContext)).toEqual(document.layout);
		expect(definition.data.normalize?.({
			mode: 'draggable',
			width: 800,
			height: 600,
			background: '#000000'
		})).toEqual({
			mode: 'draggable',
			width: 800,
			height: 600,
			background: '#000000'
		});
		expect(definition.data.normalize?.({
			mode: 'sortable',
			maxWidth: 1000,
			minHeight: 480,
			background: '#fff'
		})).toEqual({
			mode: 'sortable',
			maxWidth: 1000,
			minHeight: 480,
			background: '#fff'
		});
		expect(definition.data.normalize?.({
			mode: 'sortable',
			maxWidth: 1000,
			background: '#fff'
		})).toEqual({
			mode: 'sortable',
			maxWidth: 1000,
			background: '#fff'
		});
		expect(definition.data.validate?.({
			mode: 'draggable',
			width: 800,
			height: 600,
			background: '#000000'
		})).toEqual([]);
		expect(definition.frames.draggable?.initialPlacement()).toEqual(
			expect.objectContaining({ width: 1200, height: 800 })
		);
	});

	it('keeps the selection group module out of the widget library and published canvas', () => {
		const definition = BuiltinModules.find(item => 'identity' in item && item.identity.type === 'selection');
		if (!definition || !('identity' in definition)) throw new Error('selection unavailable');
		expect(definition.widget.visible).toBe(false);
		expect(definition.frames.sortable).toBeUndefined();
		expect(definition.frames.draggable?.widget?.visible).toBe(false);
		expect(definition.frames.draggable?.resizable).toBe(false);
		expect(definition.frames.draggable?.rotatable).toBe(false);
		expect(definition.frames.draggable?.initialPlacement()).toEqual(
			expect.objectContaining({ width: 1, height: 1 })
		);
		expect(definition.data.normalize?.({ members: ['a', 'a', 1, ''] })).toEqual({ members: ['a'] });
		expect(rendererPublishedBlocks([
			{ module: { type: 'page' } },
			{ module: { type: 'selection' } },
			{ module: { type: 'text' } }
		])).toEqual([{ module: { type: 'text' } }]);
	});

	it('creates hero and cta blocks full-width in the sortable frame', () => {
		const hero = BuiltinModules.find(item => 'identity' in item && item.identity.type === 'hero');
		const cta = BuiltinModules.find(item => 'identity' in item && item.identity.type === 'cta');
		const features = BuiltinModules.find(item => 'identity' in item && item.identity.type === 'features');
		if (!hero || !('identity' in hero)) throw new Error('hero unavailable');
		if (!cta || !('identity' in cta)) throw new Error('cta unavailable');
		if (!features || !('identity' in features)) throw new Error('features unavailable');
		expect(hero.frames.sortable?.fullWidth).toBe(true);
		expect(cta.frames.sortable?.fullWidth).toBe(true);
		expect(hero.frames.sortable?.maxWidth).toBeUndefined();
		expect(features.frames.sortable?.fullWidth).toBe(false);
		expect(hero.frames.sortable?.create?.(createContext)).toEqual({
			appearance: { fullWidth: true }
		});
	});

	it('mounts every widget, viewer and dedicated editor', async () => {
		for (const definition of BuiltinModules) {
			if (!('identity' in definition)) continue;
			const { value, viewer, editor } = await mountDefinition(definition);
			expect(viewer.exists()).toBe(true);
			expect(editor.exists()).toBe(true);
			if (definition.identity.type === 'selection') {
				expect(definition.frames.sortable).toBeUndefined();
				expect(definition.frames.draggable).toBeDefined();
			} else expect(definition.frames.sortable).toBeDefined();
			if (['hero', 'features', 'steps', 'faq', 'cta', 'list', 'ads'].includes(definition.identity.type)) {
				expect(definition.frames.draggable).toBeDefined();
			}
			if (['space', 'area'].includes(definition.identity.type)) {
				expect(definition.frames.draggable).toBeUndefined();
			}
			expect(definition.data.normalize?.(value) || value).toBeTruthy();
			definition.data.validate?.(value);
			definition.integrations?.collectResources?.(value);
			definition.integrations?.collectSearchText?.(value);

			for (const input of editor.findAll('input:not([disabled]), textarea')) {
				if (input.element instanceof HTMLInputElement && input.element.type === 'file') continue;
				await input.setValue(input.element instanceof HTMLInputElement && input.element.type === 'number' ? '12' : 'Changed');
			}
			viewer.unmount();
			editor.unmount();
		}
	});

	it('paints text background on a marginless div', () => {
		const definition = BuiltinModules.find(item => 'identity' in item && item.identity.type === 'text');
		if (!definition || !('identity' in definition)) throw new Error('text unavailable');
		const appearance = { marginTop: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 };
		const painted = mount(definition.viewer, {
			props: {
				node: {
					id: 'text',
					module: { type: 'text', version: 1, props: { text: 'Hello', background: '#ed4014' } },
					appearance
				},
				context: moduleContext
			}
		});
		expect(painted.element.tagName).toBe('DIV');
		expect(painted.attributes('style')).toContain('background: rgb(237, 64, 20)');
		painted.unmount();

		const plain = mount(definition.viewer, {
			props: {
				node: {
					id: 'text-plain',
					module: { type: 'text', version: 1, props: { text: 'Hello' } },
					appearance
				},
				context: moduleContext
			}
		});
		expect(plain.attributes('style') || '').not.toContain('background');
		plain.unmount();
	});

	it('adds, updates, reorders and removes array editor rows immutably', async () => {
		const definition = BuiltinModules.find(item => 'identity' in item && item.identity.type === 'features');
		if (!definition || !('identity' in definition)) throw new Error('features unavailable');
		const { editor, value } = await mountDefinition(definition);
		expect(Array.isArray(value.items) ? value.items : []).toHaveLength(3);
		const add = editor.findAll('button').find(button => button.text() === 'Add item');
		await add?.trigger('click');
		const emittedAfterAdd = editor.emitted('update:modelValue')?.at(-1)?.[0] as { items: unknown[] };
		expect(emittedAfterAdd.items).toHaveLength(4);
		await editor.setProps({ modelValue: emittedAfterAdd });

		const sortRows = editor.findAll('.vc-sort-list__item');
		await sortRows[0].trigger('dragstart');
		await sortRows[1].trigger('dragenter');
		await sortRows[0].trigger('dragend');
		const rows = editor.findAll('.docs-renderer-array-editor__item');
		const remove = rows[0].findAll('button').at(-1);
		await remove?.trigger('click');
		expect(editor.emitted('update:modelValue')?.length).toBeGreaterThanOrEqual(3);
	});

	it('routes internal actions through host services and leaves external links native', async () => {
		const definition = BuiltinModules.find(item => 'identity' in item && item.identity.type === 'actions');
		if (!definition || !('identity' in definition)) throw new Error('actions unavailable');
		const navigate = vi.fn();
		const published = { ...moduleContext, scene: 'renderer' as const, readonly: true, services: { navigate } };
		const node: RendererSortableNode = {
			id: 'actions',
			module: {
				type: 'actions',
				version: 1,
				props: {
					items: [
						{ label: 'Internal', to: '/guide', variant: 'primary' },
						{ label: 'External', to: 'https://example.com', variant: 'default' }
					]
				}
			},
			appearance: { marginTop: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 }
		};
		const wrapper = mount(definition.viewer, {
			props: { node, context: published }
		});
		const links = wrapper.findAll('a');
		await links[0].trigger('click');
		expect(navigate).toHaveBeenCalledWith('/guide');
		expect(links[1].attributes('href')).toBe('https://example.com');
		expect(navigate).toHaveBeenCalledTimes(1);
	});

	it('renders native action styles from variant, size and color', () => {
		const definition = BuiltinModules.find(item => 'identity' in item && item.identity.type === 'actions');
		if (!definition || !('identity' in definition)) throw new Error('actions unavailable');
		const wrapper = mount(definition.viewer, {
			props: {
				node: {
					id: 'actions',
					module: {
						type: 'actions',
						version: 1,
						props: {
							items: [
								{
									label: 'Go',
									to: '/guide',
									variant: 'primary',
									size: 'large',
									color: '#14b8a6',
									textColor: '#111111'
								},
								{ label: 'More', to: '/x', variant: 'ghost' }
							]
						}
					},
					appearance: { marginTop: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 }
				},
				context: { ...moduleContext, scene: 'renderer', readonly: true }
			}
		});
		const actions = wrapper.findAll('.docs-renderer-action');
		expect(actions[0].element.tagName).toBe('A');
		expect(actions[0].classes()).toEqual(expect.arrayContaining(['is-solid', 'is-large']));
		expect(actions[0].attributes('style')).toContain('--docs-renderer-action-color: #14b8a6');
		expect(actions[0].attributes('style')).toContain('--docs-renderer-action-text: #111111');
		expect(actions[1].classes()).toContain('is-ghost');
	});

	it('does not run action navigation while the canvas is being edited', async () => {
		const definition = BuiltinModules.find(item => 'identity' in item && item.identity.type === 'actions');
		if (!definition || !('identity' in definition)) throw new Error('actions unavailable');
		const navigate = vi.fn();
		const node: RendererSortableNode = {
			id: 'actions',
			module: {
				type: 'actions',
				version: 1,
				props: {
					items: [{ label: 'Get started', to: '/guide', variant: 'primary' }]
				}
			},
			appearance: { marginTop: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 }
		};
		const wrapper = mount(definition.viewer, {
			props: { node, context: { ...moduleContext, services: { navigate } } }
		});
		expect(wrapper.find('a').exists()).toBe(false);
		await wrapper.find('button').trigger('click');
		expect(navigate).not.toHaveBeenCalled();
	});

	it('keeps unsafe, blank, modified and failed action navigation isolated', async () => {
		const definition = BuiltinModules.find(item => 'identity' in item && item.identity.type === 'actions');
		if (!definition || !('identity' in definition)) throw new Error('actions unavailable');
		const navigate = vi.fn().mockRejectedValue(new Error('navigation failed'));
		const resolveLink = vi.fn((value: string) => `/base${value}`);
		const node: RendererSortableNode = {
			id: 'actions',
			module: {
				type: 'actions',
				version: 1,
				props: {
					items: [
						{ label: 'Blank', to: '' },
						{ label: 'Unsafe', to: 'javascript:alert(1)' },
						{ label: 'Internal', to: '/guide' },
						{ label: 'New tab', to: '/new', target: '_blank' },
						{ label: 'Protocol', to: '//example.com' }
					]
				}
			},
			appearance: { marginTop: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 }
		};
		const wrapper = mount(definition.viewer, {
			props: { node, context: { ...moduleContext, scene: 'renderer', readonly: true, services: { navigate, resolveLink } } }
		});
		expect(wrapper.findAll('button')[0].attributes('disabled')).toBeDefined();
		const links = wrapper.findAll('a');
		expect(links[0].attributes('href')).toBe('');
		expect(links[1].attributes('href')).toBe('/base/guide');
		expect(links[2].attributes('target')).toBe('_blank');
		expect(links[2].attributes('rel')).toBe('noopener noreferrer');
		const modifiedClick = new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true });
		modifiedClick.preventDefault();
		links[1].element.dispatchEvent(modifiedClick);
		expect(navigate).not.toHaveBeenCalled();
		await links[1].trigger('click');
		await flushPromises();
		expect(navigate).toHaveBeenCalledWith('/guide');
		expect(navigate).toHaveBeenCalledTimes(1);

		await wrapper.setProps({ context: { ...moduleContext, scene: 'renderer', readonly: true, services: { resolveLink } } });
		await wrapper.findAll('a')[1].trigger('click');
		expect(navigate).toHaveBeenCalledTimes(1);
	});

	it('resolves light and dark image resources and clears both on failure', async () => {
		const definition = BuiltinModules.find(item => 'identity' in item && item.identity.type === 'image');
		if (!definition || !('identity' in definition)) throw new Error('image unavailable');
		const node: RendererSortableNode = {
			id: 'image',
			module: {
				type: 'image',
				version: 1,
				props: {
					src: './light.png', dark: './dark.png', alt: 'Preview',
					fit: 'cover', borderRadius: -10, eager: true
				}
			},
			appearance: { marginTop: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 }
		};
		const resolveAsset = vi.fn(async (source: string, importer?: string) => `${importer}:${source}`);
		const wrapper = mount(definition.viewer, {
			props: {
				node,
				context: { ...moduleContext, source: 'README.md', services: { resolveAsset } }
			}
		});
		await flushPromises();
		const images = wrapper.findAll('img');
		expect(images.map(image => image.attributes('src'))).toEqual([
			'README.md:./light.png',
			'README.md:./dark.png'
		]);
		expect(images[0].attributes('loading')).toBe('eager');
		expect(images[0].attributes('style')).toContain('object-fit: cover');
		expect(wrapper.attributes('style')).toContain('border-radius: 0px');

		await wrapper.setProps({
			context: {
				...moduleContext,
				source: 'README.md',
				services: { resolveAsset: async () => { throw new Error('offline'); } }
			}
		});
		await flushPromises();
		expect(wrapper.findAll('img')).toHaveLength(0);
		wrapper.unmount();

		const inline = 'data:image/png;base64,iVBORw0KGgo=';
		const prefixed = vi.fn(async (source: string) => `cdn:${source}`);
		const data = mount(definition.viewer, {
			props: {
				node: {
					...node,
					module: {
						...node.module,
						props: { ...node.module.props, src: inline, dark: 'iVBORw0KGgoAAAANSUhEUg==' }
					}
				},
				context: { ...moduleContext, services: { resolveAsset: prefixed } }
			}
		});
		await flushPromises();
		expect(prefixed).not.toHaveBeenCalled();
		expect(data.findAll('img').map(image => image.attributes('src'))).toEqual([
			inline,
			'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg=='
		]);
		data.unmount();
	});

	it('classifies feature icons and lists IconManager types dynamically', () => {
		expect(featureIconKind('')).toBe('none');
		expect(featureIconKind('  ')).toBe('none');
		expect(featureIconKind('star')).toBe('type');
		expect(featureIconKind('https://example.com/icon.png')).toBe('url');
		expect(featureIconKind('http://example.com/icon.png')).toBe('url');
		expect(featureIconKind('data:image/png;base64,iVBORw0KGgo=')).toBe('url');
		expect(featureIconKind('iVBORw0KGgoAAAANSUhEUg==')).toBe('url');
		expect(isDirectImageSource('blob:https://docs.local/1')).toBe(true);
		expect(toDisplayImageSrc('iVBORw0KGgoAAAANSUhEUg==')).toBe('data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==');
		expect(listBuiltinIconTypes()).toEqual(expect.arrayContaining(['search']));
		IconManager.icons['docs-test-icon'] = {
			viewBox: '0 0 1024 1024',
			path: ['M0 0']
		};
		expect(listBuiltinIconTypes()).toContain('docs-test-icon');
		delete IconManager.icons['docs-test-icon'];
	});

	it('clamps feature columns while preserving an explicit zero gap', () => {
		const definition = BuiltinModules.find(item => 'identity' in item && item.identity.type === 'features');
		if (!definition || !('identity' in definition)) throw new Error('features unavailable');
		const node: RendererSortableNode = {
			id: 'features',
			module: { type: 'features', version: 1, props: { columns: 0, gap: 0, items: [] } },
			appearance: { marginTop: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 }
		};
		const wrapper = mount(definition.viewer, { props: { node, context: moduleContext } });
		expect(wrapper.get('.docs-renderer-features__grid').attributes('style')).toContain('--docs-renderer-columns: 1');
		expect(wrapper.get('.docs-renderer-features__grid').attributes('style')).toContain('gap: 0px');
	});

	it('paints hero and feature accents from module props', () => {
		const heroDefinition = BuiltinModules.find(item => 'identity' in item && item.identity.type === 'hero');
		const featuresDefinition = BuiltinModules.find(item => 'identity' in item && item.identity.type === 'features');
		if (!heroDefinition || !('identity' in heroDefinition)) throw new Error('hero unavailable');
		if (!featuresDefinition || !('identity' in featuresDefinition)) throw new Error('features unavailable');
		const hero = mount(heroDefinition.viewer, {
			props: {
				node: {
					id: 'hero',
					module: {
						type: 'hero',
						version: 1,
						props: {
							title: 'Painted',
							align: 'center',
							accent: '#14b8a6',
							accentSecondary: '#f59e0b',
							showVisual: false,
							minHeight: 360,
							highlights: [{ value: '3', label: 'Themes', color: '#ed4014' }]
						}
					},
					appearance: { marginTop: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 }
				},
				context: moduleContext
			}
		});
		expect(hero.classes()).toEqual(expect.arrayContaining(['is-center', 'is-plain']));
		expect(hero.attributes('style')).toContain('--docs-renderer-accent: #14b8a6');
		expect(hero.attributes('style')).toContain('--docs-renderer-accent-2: #f59e0b');
		expect(hero.attributes('style')).toContain('min-height: 360px');
		expect(hero.find('.docs-renderer-hero__visual').exists()).toBe(false);
		expect(hero.get('.docs-renderer-hero__stat').text()).toContain('Themes');
		expect(hero.get('.docs-renderer-hero__stat').attributes('style'))
			.toContain('--docs-renderer-stat-color: #ed4014');
		hero.unmount();

		const features = mount(featuresDefinition.viewer, {
			props: {
				node: {
					id: 'features',
					module: {
						type: 'features',
						version: 1,
						props: {
							eyebrow: 'Set',
							title: 'Packed',
							items: [{ title: 'One', description: 'Desc', badge: 'Core', icon: '', accent: '#ed4014' }]
						}
					},
					appearance: { marginTop: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 }
				},
				context: moduleContext
			}
		});
		expect(features.classes()).toContain('is-center');
		expect(features.attributes('style')).toContain('max-width: var(--docs-renderer-content-width, 100%)');
		expect(features.get('.docs-renderer-features__heading').text()).toBe('Packed');
		expect(features.get('.docs-renderer-features__eyebrow').text()).toBe('Set');
		expect(features.get('.docs-renderer-features__badge').text()).toBe('Core');
		expect(features.get('.docs-renderer-features__index').text()).toBe('O');
		expect(features.find('.vc-icon').exists()).toBe(false);
		expect(features.get('.docs-renderer-features__item').attributes('style'))
			.toContain('--docs-renderer-card-accent: #ed4014');
		features.unmount();

		const lettered = mount(featuresDefinition.viewer, {
			props: {
				node: {
					id: 'features-letter',
					module: {
						type: 'features',
						version: 1,
						props: { items: [{ title: 'Search', description: 'Find' }] }
					},
					appearance: { marginTop: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 }
				},
				context: moduleContext
			}
		});
		expect(lettered.get('.docs-renderer-features__index').text()).toBe('S');
		lettered.unmount();

		const typed = mount(featuresDefinition.viewer, {
			props: {
				node: {
					id: 'features-type',
					module: {
						type: 'features',
						version: 1,
						props: { items: [{ title: 'Search', icon: 'search' }] }
					},
					appearance: { marginTop: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 }
				},
				context: moduleContext
			}
		});
		expect(typed.find('.vc-icon').exists()).toBe(true);
		typed.unmount();

		const remote = mount(featuresDefinition.viewer, {
			props: {
				node: {
					id: 'features-url',
					module: {
						type: 'features',
						version: 1,
						props: { items: [{ title: 'Remote', icon: 'https://example.com/icon.png' }] }
					},
					appearance: { marginTop: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 }
				},
				context: moduleContext
			}
		});
		expect(remote.get('.docs-renderer-features__media').attributes('src')).toBe('https://example.com/icon.png');
		remote.unmount();

		const encoded = mount(featuresDefinition.viewer, {
			props: {
				node: {
					id: 'features-base64',
					module: {
						type: 'features',
						version: 1,
						props: { items: [{ title: 'Inline', icon: 'iVBORw0KGgoAAAANSUhEUg==' }] }
					},
					appearance: { marginTop: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 }
				},
				context: moduleContext
			}
		});
		expect(encoded.get('.docs-renderer-features__media').attributes('src'))
			.toBe('data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==');
		encoded.unmount();

		const left = mount(featuresDefinition.viewer, {
			props: {
				node: {
					id: 'features-left',
					module: {
						type: 'features',
						version: 1,
						props: { align: 'left', title: 'Packed', items: [{ title: 'One' }] }
					},
					appearance: { marginTop: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 }
				},
				context: moduleContext
			}
		});
		expect(left.classes()).toContain('is-left');
		left.unmount();
	});

	it('renders steps, faq and cta landing modules', () => {
		const stepsDefinition = BuiltinModules.find(item => 'identity' in item && item.identity.type === 'steps');
		const faqDefinition = BuiltinModules.find(item => 'identity' in item && item.identity.type === 'faq');
		const ctaDefinition = BuiltinModules.find(item => 'identity' in item && item.identity.type === 'cta');
		if (!stepsDefinition || !('identity' in stepsDefinition)) throw new Error('steps unavailable');
		if (!faqDefinition || !('identity' in faqDefinition)) throw new Error('faq unavailable');
		if (!ctaDefinition || !('identity' in ctaDefinition)) throw new Error('cta unavailable');
		const appearance = { marginTop: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 };
		const steps = mount(stepsDefinition.viewer, {
			props: {
				node: {
					id: 'steps',
					module: {
						type: 'steps',
						version: 1,
						props: {
							title: 'Flow',
							columns: 0,
							items: [{ title: 'Write', description: 'Now', icon: 'A', accent: '#2d8cf0' }]
						}
					},
					appearance
				},
				context: moduleContext
			}
		});
		expect(steps.classes()).toContain('is-center');
		expect(steps.attributes('style')).toContain('max-width: var(--docs-renderer-content-width, 100%)');
		expect(steps.get('.docs-renderer-steps__list').attributes('style')).toContain('--docs-renderer-columns: 1');
		expect(steps.get('.docs-renderer-steps__list').classes()).toContain('is-vertical');
		expect(steps.get('.docs-renderer-steps__index').text()).toBe('A');
		expect(steps.find('.docs-renderer-steps__marker').exists()).toBe(true);
		expect(steps.find('.docs-renderer-steps__rail').exists()).toBe(true);
		expect(steps.get('.docs-renderer-steps__item').attributes('style')).toContain('--docs-renderer-card-accent: #2d8cf0');
		steps.unmount();

		const process = mount(stepsDefinition.viewer, {
			props: {
				node: {
					id: 'steps-process',
					module: {
						type: 'steps',
						version: 1,
						props: {
							columns: 4,
							items: [
								{ title: 'Write' },
								{ title: 'Review' },
								{ title: 'Ship' }
							]
						}
					},
					appearance
				},
				context: moduleContext
			}
		});
		expect(process.get('.docs-renderer-steps__list').classes()).toContain('is-horizontal');
		expect(process.findAll('.docs-renderer-steps__item')[0].classes()).not.toContain('is-row-end');
		expect(process.findAll('.docs-renderer-steps__item')[2].classes()).toContain('is-row-end');
		expect(process.findAll('.docs-renderer-steps__index')[0].text()).toBe('1');
		process.unmount();

		const faq = mount(faqDefinition.viewer, {
			props: {
				node: {
					id: 'faq',
					module: {
						type: 'faq',
						version: 1,
						props: {
							title: 'Ask',
							items: [
								{ question: 'One?', answer: 'Yes' },
								{ question: 'Two?', answer: 'No' }
							]
						}
					},
					appearance
				},
				context: moduleContext
			}
		});
		expect(faq.classes()).toContain('is-center');
		expect(faq.attributes('style')).toContain('max-width: var(--docs-renderer-content-width, 100%)');
		expect(faq.findAll('.docs-renderer-faq__item')).toHaveLength(2);
		expect(faq.get('.docs-renderer-faq__item').attributes('open')).toBeDefined();
		expect(faqDefinition.data.validate?.(faqDefinition.data.normalize?.({ items: [{ question: '', answer: '' }] })!))
			.toContainEqual(expect.objectContaining({ code: 'question.required' }));
		faq.unmount();

		const cta = mount(ctaDefinition.viewer, {
			props: {
				node: {
					id: 'cta',
					module: {
						type: 'cta',
						version: 1,
						props: {
							title: 'Go',
							align: 'center',
							accent: '#873bf4',
							actions: []
						}
					},
					appearance
				},
				context: moduleContext
			}
		});
		expect(cta.classes()).toEqual(expect.arrayContaining(['is-center']));
		expect(cta.attributes('style')).toContain('--docs-renderer-accent: #873bf4');
		cta.unmount();
	});

	it('renders ad slots with tile or scrolling layouts and keeps unsafe hrefs inert', async () => {
		const definition = BuiltinModules.find(item => 'identity' in item && item.identity.type === 'ads');
		if (!definition || !('identity' in definition)) throw new Error('ads unavailable');
		const navigate = vi.fn();
		const resolveAsset = vi.fn(async (source: string) => `cdn:${source}`);
		const appearance = { marginTop: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 };
		const node: RendererSortableNode = {
			id: 'ads',
			module: {
				type: 'ads',
				version: 1,
				props: {
					layout: 'scroll',
					style: 'card',
					columns: 2,
					height: 200,
					speed: 5,
					items: [
						{ src: './one.png', href: 'https://example.com', title: 'One' },
						{ src: './two.png', href: 'javascript:alert(1)', title: 'Bad' },
						{ src: '', href: '/guide', title: 'Internal' }
					]
				}
			},
			appearance
		};
		const wrapper = mount(definition.viewer, {
			props: {
				node,
				context: { ...moduleContext, scene: 'renderer', readonly: true, services: { navigate, resolveAsset } }
			}
		});
		await flushPromises();
		expect(wrapper.classes()).toEqual(expect.arrayContaining(['is-scroll', 'is-card', 'is-looping']));
		expect(wrapper.attributes('style')).toContain('--docs-renderer-ads-height: 200px');
		expect(wrapper.findAll('.docs-renderer-ads__item')).toHaveLength(6);
		expect(wrapper.findAll('img').map(image => image.attributes('src'))).toEqual([
			'cdn:./one.png', 'cdn:./two.png', 'cdn:./one.png', 'cdn:./two.png'
		]);
		const links = wrapper.findAll('a');
		expect(links).toHaveLength(4);
		expect(links[0].attributes('href')).toBe('https://example.com');
		expect(links[0].attributes('target')).toBe('_blank');
		expect(links[0].attributes('rel')).toBe('noopener noreferrer');
		expect(links.some(link => (link.attributes('href') || '').startsWith('javascript:'))).toBe(false);
		await links[1].trigger('click', { button: 0 });
		expect(navigate).toHaveBeenCalledWith('/guide');

		await wrapper.setProps({
			node: {
				...node,
				module: {
					...node.module,
					props: { ...node.module.props, layout: 'tile', style: 'notice' }
				}
			}
		});
		expect(wrapper.classes()).toEqual(expect.arrayContaining(['is-tile', 'is-notice']));
		expect(wrapper.classes()).not.toContain('is-looping');
		expect(wrapper.findAll('.docs-renderer-ads__item')).toHaveLength(3);
		wrapper.unmount();

		const editing = mount(definition.viewer, {
			props: { node, context: moduleContext }
		});
		await flushPromises();
		expect(editing.find('a').exists()).toBe(false);
		await editing.get('.docs-renderer-ads__item').trigger('click');
		expect(navigate).toHaveBeenCalledTimes(1);
		editing.unmount();
	});

	it('normalizes imported module data and reports invalid business values', () => {
		const definitions = new Map(BuiltinModules.flatMap(definition => (
			'identity' in definition ? [[definition.identity.type, definition] as const] : []
		)));
		const title = definitions.get('title');
		const actions = definitions.get('actions');
		const features = definitions.get('features');
		const hero = definitions.get('hero');
		const list = definitions.get('list');
		const ads = definitions.get('ads');
		if (!title || !actions || !features || !hero || !list || !ads) throw new Error('built-in modules unavailable');

		const normalizedTitle = title.data.normalize?.({
			text: 10,
			level: 9,
			fontSize: 200,
			align: 'invalid'
		});
		expect(normalizedTitle).toEqual(expect.objectContaining({ text: '', align: 'left' }));
		expect(title.data.validate?.(normalizedTitle!)).toEqual(expect.arrayContaining([
			expect.objectContaining({ path: '$.text' }),
			expect.objectContaining({ path: '$.level' }),
			expect.objectContaining({ path: '$.fontSize' })
		]));

		const normalizedActions = actions.data.normalize?.({
			items: [{ label: 'Unsafe', to: 'javascript:alert(1)', variant: 'primary' }]
		});
		expect(actions.data.validate?.(normalizedActions!)).toContainEqual(
			expect.objectContaining({ code: 'action.target.unsafe' })
		);
		expect(features.data.normalize?.({})).toEqual(expect.objectContaining({ align: 'center' }));
		expect(hero.data.normalize?.({ highlights: [{ value: '3', label: 'Themes' }] })).toEqual(
			expect.objectContaining({
				highlights: [{ value: '3', label: 'Themes', color: '' }]
			})
		);
		expect(features.data.validate?.(features.data.normalize?.({ items: [] })!))
			.toContainEqual(expect.objectContaining({ code: 'items.min' }));
		expect(list.data.validate?.(list.data.normalize?.({ items: [] })!))
			.toContainEqual(expect.objectContaining({ code: 'items.min' }));
		expect(ads.data.validate?.(ads.data.normalize?.({
			items: [{ src: '', href: 'javascript:alert(1)', title: '' }]
		})!)).toEqual(expect.arrayContaining([
			expect.objectContaining({ code: 'ads.href.unsafe' }),
			expect.objectContaining({ code: 'ads.content.required' })
		]));
		expect(ads.integrations?.collectResources?.({
			items: [{ src: './ad.png', href: 'https://example.com', title: 'Ad' }]
		} as never)).toEqual([{ type: 'module', source: './ad.png' }]);
		expect(ads.integrations?.collectResources?.({
			items: [{ src: 'data:image/png;base64,iVBORw0KGgo=', title: 'Inline' }]
		} as never)).toEqual([]);
		expect(collectImageResources(['light.png', 'https://cdn.example.com/x.png', 'data:image/png;base64,aaa']))
			.toEqual([{ type: 'module', source: 'light.png' }]);

		expect(validateNumberRange(Number.NaN, '$.value', {}))
			.toContainEqual(expect.objectContaining({ code: 'number.finite' }));
		expect(validateNumberRange(1.5, '$.value', { integer: true }))
			.toContainEqual(expect.objectContaining({ code: 'number.integer' }));
		expect(validateNumberRange(-1, '$.value', { min: 0 }))
			.toContainEqual(expect.objectContaining({ code: 'number.min' }));

		expect(title.frames.draggable?.initialPlacement()).toEqual(expect.objectContaining({ width: 360 }));
		expect(actions.frames.draggable?.initialPlacement()).toEqual(expect.objectContaining({ width: 260 }));
		const image = definitions.get('image');
		expect(image?.frames.draggable?.initialPlacement()).toEqual(expect.objectContaining({ width: 320 }));
		expect(image?.integrations?.collectResources?.({ src: 'light.png', dark: 'dark.png' } as never))
			.toEqual([{ type: 'module', source: 'light.png' }, { type: 'module', source: 'dark.png' }]);
		expect(image?.integrations?.collectResources?.({
			src: 'data:image/png;base64,iVBORw0KGgo=',
			dark: 'https://cdn.example.com/x.png'
		} as never)).toEqual([]);
		expect(features.data.validate?.(features.data.normalize?.({
			columns: 2,
			gap: 10,
			items: [{ title: '', description: '' }]
		})!)).toContainEqual(expect.objectContaining({ code: 'title.required' }));
		expect(features.integrations?.collectSearchText?.({ items: [null, { title: 'One', description: 'Desc' }] } as never))
			.toEqual([{ title: '', text: '' }, { title: 'One', text: 'Desc' }]);

		expect(resolveLocaleText('Plain', moduleContext)).toBe('Plain');
		expect(resolveLocaleText({ 'zh-CN': '中文', 'en-US': 'English' }, {
			...moduleContext,
			locale: { name: 'zh-CN' } as never
		})).toBe('中文');
		expect(resolveLocaleText({ 'en-US': 'English' }, { ...moduleContext, locale: { name: 'fr-FR' } as never }))
			.toBe('English');
		expect(resolveLocaleText({ 'fr-FR': 'Français' }, moduleContext)).toBe('Français');
		expect(resolveLocaleText({}, moduleContext)).toBe('');
	});
});
