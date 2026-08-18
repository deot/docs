// @vitest-environment jsdom

import { defineComponent, h } from 'vue';
import {
	BuiltinModules,
	createEmptyRendererDocument,
	createRendererId,
	createRendererLayout,
	createRendererModuleCatalog,
	convertRendererDocumentFrame,
	defineRendererModule,
	normalizeRotation,
	prepareRendererDocument,
	rendererPageBackgroundCss,
	validateRendererDocument
} from '../src';
import type {
	RendererModuleContext,
	RendererDraggableDocument,
	RendererSortableDocument
} from '../src';
import { invalid } from './fixtures';
import { resolveSortableInsertionIndex } from '../src/document';

const Viewer = defineComponent(() => () => h('div', 'viewer'));
const Editor = defineComponent(() => () => h('div', 'editor'));
const context: RendererModuleContext = {
	scene: 'renderer',
	frameMode: 'sortable',
	readonly: true
};
const module = (options: { version?: number; maxInstances?: number } = {}) => defineRendererModule({
	identity: { type: 'test:text', version: options.version || 1, label: 'Text', category: 'Test' },
	widget: { visible: true },
	data: {
		create: () => ({ text: '' }),
		normalize: value => ({ text: String((value as { text?: string })?.text || '') }),
		migrate: value => ({ text: String((value as { value?: string }).value || '') }),
		validate: value => value.text
			? []
			: [{ path: '$.text', code: 'required', message: 'required', severity: 'error' as const }]
	},
	viewer: Viewer,
	editor: Editor,
	frames: { sortable: { maxInstances: options.maxInstances } }
});
const page = (blocks: RendererSortableDocument['blocks'] = []): RendererSortableDocument => ({
	schemaVersion: 2,
	meta: { id: 'page' },
	layout: { mode: 'sortable', maxWidth: 1180, minHeight: 600, background: '#fff' },
	blocks
});
const node = (id: string, props: Record<string, unknown> = { text: id }) => ({
	id,
	module: { type: 'test:text', version: 1, props },
	appearance: { marginTop: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 }
});

describe('renderer protocol', () => {
	it('maps empty and default white page backgrounds to the docs theme token', () => {
		expect(rendererPageBackgroundCss('')).toBe('var(--docs-background-color)');
		expect(rendererPageBackgroundCss('#fff')).toBe('var(--docs-background-color)');
		expect(rendererPageBackgroundCss('#FFFFFF')).toBe('var(--docs-background-color)');
		expect(rendererPageBackgroundCss('#f5f5f5')).toBe('#f5f5f5');
		expect(rendererPageBackgroundCss('transparent')).toBe('transparent');
	});

	it('creates empty documents for both independent frames', () => {
		expect(createEmptyRendererDocument('sortable').layout.mode).toBe('sortable');
		expect(createEmptyRendererDocument('draggable').layout.mode).toBe('draggable');
		expect(createRendererLayout('draggable', createEmptyRendererDocument('sortable').layout)).toEqual({
			mode: 'draggable',
			width: 1920,
			height: 800,
			background: '#ffffff'
		});
		expect(createRendererLayout('sortable').mode).toBe('sortable');
		expect(createRendererLayout('draggable')).toEqual(expect.objectContaining({ width: 1200 }));
		expect(createEmptyRendererDocument().blocks).toEqual([]);
		expect(createEmptyRendererDocument('sortable').layout).toEqual({
			mode: 'sortable',
			maxWidth: 1920,
			background: '#ffffff'
		});
		const unbounded = page();
		delete unbounded.layout.minHeight;
		expect(validateRendererDocument(unbounded).valid).toBe(true);
	});

	it('converts documents between frames and drops unsupported modules', async () => {
		const catalog = createRendererModuleCatalog(BuiltinModules);
		const sortable = createEmptyRendererDocument('sortable');
		sortable.blocks.push({
			id: 'text',
			module: { type: 'text', version: 1, props: { text: 'Keep' } },
			appearance: { marginTop: 8, marginBottom: 0, paddingTop: 0, paddingBottom: 0, borderRadius: 12 }
		}, {
			id: 'space',
			module: { type: 'space', version: 1, props: { height: 24, background: '' } },
			appearance: { marginTop: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 }
		}, {
			id: 'page',
			module: { type: 'page', version: 1, props: {} },
			appearance: { marginTop: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 }
		});
		const draggable = await convertRendererDocumentFrame(
			sortable,
			createRendererLayout('draggable', sortable.layout),
			catalog
		) as RendererDraggableDocument;
		expect(draggable.layout.mode).toBe('draggable');
		expect(draggable.blocks.map(item => item.id)).toEqual(['text']);
		expect(draggable.blocks[0].placement.y).toBe(40);
		expect(draggable.blocks[0].placement.borderRadius).toBe(12);
		const landing = createEmptyRendererDocument('sortable');
		landing.blocks.push({
			id: 'hero',
			module: { type: 'hero', version: 1, props: { title: 'Keep' } },
			appearance: { marginTop: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0, fullWidth: true }
		});
		const freeLanding = await convertRendererDocumentFrame(
			landing,
			createRendererLayout('draggable', landing.layout),
			catalog
		) as RendererDraggableDocument;
		expect(freeLanding.blocks.map(item => item.id)).toEqual(['hero']);
		const restored = await convertRendererDocumentFrame(
			draggable,
			createRendererLayout('sortable', draggable.layout),
			catalog
		) as RendererSortableDocument;
		expect(restored.layout.mode).toBe('sortable');
		expect(restored.blocks[0].appearance).toEqual(expect.objectContaining({
			marginTop: 0,
			paddingLeft: 0,
			borderRadius: 12
		}));
		const unchanged = await convertRendererDocumentFrame(sortable, sortable.layout, catalog);
		expect(unchanged.layout).toEqual(sortable.layout);
		const missing = createEmptyRendererDocument('sortable');
		missing.blocks.push({
			id: 'gone',
			module: { type: 'missing', version: 1, props: {} },
			appearance: { marginTop: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 }
		});
		const skipped = await convertRendererDocumentFrame(
			missing,
			createRendererLayout('draggable', missing.layout),
			catalog
		);
		expect(skipped.blocks).toHaveLength(0);
		const failing = createRendererModuleCatalog([{
			type: 'boom',
			load: async () => {
				throw new Error('unavailable');
			}
		}]);
		const broken = createEmptyRendererDocument('sortable');
		broken.blocks.push({
			id: 'boom',
			module: { type: 'boom', version: 1, props: {} },
			appearance: { marginTop: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 }
		});
		const ignored = await convertRendererDocumentFrame(
			broken,
			createRendererLayout('draggable', broken.layout),
			failing
		);
		expect(ignored.blocks).toHaveLength(0);
	});

	it('validates flat sortable and draggable documents', () => {
		const sortable = page([node('a')]);
		sortable.blocks[0].appearance.paddingLeft = 16;
		sortable.blocks[0].appearance.paddingRight = 20;
		sortable.blocks[0].appearance.fullWidth = true;
		sortable.blocks[0].appearance.maxWidth = 0;
		sortable.blocks[0].appearance.borderRadius = 8;
		sortable.blocks[0].appearance.borderRadiusTopLeft = 4;
		expect(validateRendererDocument(sortable).valid).toBe(true);
		const draggable = createEmptyRendererDocument('draggable');
		if (draggable.layout.mode !== 'draggable') throw new Error('unexpected mode');
		draggable.blocks.push({
			id: 'free',
			module: { type: 'test:free', version: 1, props: {} },
			placement: {
				x: -10, y: 20, width: 100, height: 80, rotate: 47, zIndex: 2, borderRadius: 6
			}
		});
		expect(validateRendererDocument(draggable).valid).toBe(true);
	});

	it('rejects children, cross-frame fields and unsafe JSON', () => {
		const result = validateRendererDocument({
			...page(),
			blocks: [{
				...node('bad'),
				children: [],
				placement: { x: 0, y: 0, width: 10, height: 10, rotate: 0, zIndex: 0 },
				module: { type: 'test:text', version: 1, props: { value: Number.NaN } }
			}]
		});
		expect(result.valid).toBe(false);
		expect(result.issues.map(item => item.code)).toEqual(expect.arrayContaining([
			'node.children.unsupported',
			'placement.unsupported',
			'module.props'
		]));
	});

	it('rejects unsafe values outside module props and invalid meta fields', () => {
		const cyclic: Record<string, unknown> = {};
		cyclic.self = cyclic;
		const document = page();
		Object.assign(document.meta, {
			title: 1,
			updatedAt: -1,
			extra: cyclic
		});
		const result = validateRendererDocument(document);
		expect(result.document).toBeUndefined();
		expect(result.issues.map(issue => issue.code)).toEqual(expect.arrayContaining([
			'document.json',
			'document.title',
			'number.nonNegative'
		]));
		expect(validateRendererDocument({
			...page(),
			meta: new (class Meta { id = 'class-instance'; })()
		}).issues).toContainEqual(expect.objectContaining({ code: 'document.id' }));
	});

	it('normalizes arbitrary rotations', () => {
		expect(normalizeRotation(405)).toBe(45);
		expect(normalizeRotation(-405)).toBe(-45);
		expect(normalizeRotation(Number.NaN)).toBe(0);
	});

	it('uses a UUID fallback when randomUUID is unavailable', () => {
		const original = globalThis.crypto;
		vi.stubGlobal('crypto', {
			getRandomValues: (value: Uint32Array) => {
				value[0] = 1;
				value[1] = 2;
				return value;
			}
		});
		const first = createRendererId();
		const second = createRendererId();
		expect(first).toMatch(/^renderer-/u);
		expect(second).not.toBe(first);
		vi.stubGlobal('crypto', original);
	});

	it('keeps catalogs instance-local and retries failed lazy loads', async () => {
		let attempts = 0;
		const catalog = createRendererModuleCatalog([{
			type: 'test:text',
			load: async () => {
				attempts += 1;
				if (attempts === 1) throw new Error('offline');
				return module();
			}
		}]);
		await expect(catalog.get('test:text')).rejects.toThrow('offline');
		expect(await catalog.get('test:text')).toEqual(expect.objectContaining({ identity: expect.objectContaining({ type: 'test:text' }) }));
		expect(attempts).toBe(2);
		expect(() => createRendererModuleCatalog([module(), module()])).toThrow('already exists');
	});

	it('skips an unavailable lazy module without hiding healthy widgets', async () => {
		const catalog = createRendererModuleCatalog([
			module(),
			{ type: 'test:offline', load: async () => { throw new Error('offline'); } }
		]);
		expect((await catalog.list()).map(item => item.identity.type)).toEqual(['test:text']);
	});

	it('rejects invalid module versions, frames and duplicate preset keys', () => {
		expect(() => createRendererModuleCatalog([{
			...module(),
			identity: { ...module().identity, version: 0 }
		}])).toThrow('positive integer');
		expect(() => createRendererModuleCatalog([{
			...module(),
			frames: {}
		}])).toThrow('at least one frame');
		expect(() => createRendererModuleCatalog([{
			...module(),
			widget: { presets: [{ key: 'same', label: 'A' }, { key: 'same', label: 'B' }] }
		}])).toThrow('duplicated');
		expect(() => createRendererModuleCatalog([{
			...module(),
			frames: { sortable: { maxInstances: 0 } }
		}])).toThrow('maxInstances');
		expect(() => createRendererModuleCatalog([{
			...module(),
			frames: { sortable: { maxWidth: 0 } }
		}])).toThrow('maxWidth');
		expect(() => createRendererModuleCatalog([{
			...module(),
			frames: {
				draggable: {
					initialPlacement: () => ({
						x: 0, y: 0, width: 100, height: 100, rotate: 0, zIndex: 1
					}),
					minWidth: 200,
					maxWidth: 100
				}
			}
		}])).toThrow('minWidth');
	});

	it('validates draggable size, aspect ratio and rotated containment rules', async () => {
		const free = defineRendererModule({
			...module(),
			identity: { ...module().identity, type: 'test:free' },
			frames: {
				draggable: {
					initialPlacement: () => ({
						x: 0, y: 0, width: 100, height: 100, rotate: 0, zIndex: 1
					}),
					minWidth: 80,
					maxWidth: 240,
					aspectRatio: 2,
					containment: 'canvas'
				}
			}
		});
		const document = createEmptyRendererDocument('draggable');
		document.blocks.push({
			id: 'free',
			module: { type: 'test:free', version: 1, props: { text: 'free' } },
			placement: { x: -20, y: 0, width: 60, height: 60, rotate: 45, zIndex: 1 }
		});
		const result = await prepareRendererDocument(
			document,
			createRendererModuleCatalog([free]),
			{ ...context, frameMode: 'draggable' }
		);
		expect(result.issues.map(issue => issue.code)).toEqual(expect.arrayContaining([
			'module.placement.minWidth',
			'module.placement.aspectRatio',
			'module.placement.containment'
		]));
	});

	it('migrates module props and reports max-instance violations', async () => {
		const definition = module({ version: 2, maxInstances: 1 });
		const catalog = createRendererModuleCatalog([definition]);
		const value = page([
			{ ...node('a', { value: 'Migrated' }), module: { type: 'test:text', version: 1, props: { value: 'Migrated' } } },
			node('b')
		]);
		const result = await prepareRendererDocument(value, catalog, context);
		expect(result.valid).toBe(false);
		expect(result.document?.blocks[0].module).toEqual(expect.objectContaining({ version: 2, props: { text: 'Migrated' } }));
		expect(result.issues).toContainEqual(expect.objectContaining({ code: 'module.maxInstances' }));
	});

	it('does not accept unsafe data returned by module normalization', async () => {
		const unsafe = defineRendererModule({
			...module(),
			data: {
				...module().data,
				normalize: () => invalid<{ text: string }>({ execute: () => undefined })
			}
		});
		const result = await prepareRendererDocument(
			page([node('unsafe')]),
			createRendererModuleCatalog([unsafe]),
			context
		);
		expect(result.valid).toBe(false);
		expect(result.issues).toContainEqual(expect.objectContaining({
			code: 'module.normalize.unsafe',
			nodeId: 'unsafe'
		}));
		expect(result.document?.blocks[0].module.props).toEqual({ text: 'unsafe' });
	});

	it('uses the same sortable insertion boundaries for creation and reorder', async () => {
		const first = defineRendererModule({
			...module(),
			identity: { ...module().identity, type: 'test:first' },
			frames: { sortable: { insertion: 'first', maxInstances: 1 } }
		});
		const last = defineRendererModule({
			...module(),
			identity: { ...module().identity, type: 'test:last' },
			frames: { sortable: { insertion: 'last', maxInstances: 1 } }
		});
		const catalog = createRendererModuleCatalog([first, module(), last]);
		const blocks = [
			{ ...node('first'), module: { ...node('first').module, type: 'test:first' } },
			node('middle'),
			{ ...node('last'), module: { ...node('last').module, type: 'test:last' } }
		];
		expect(await resolveSortableInsertionIndex(blocks, catalog, 'test:text', 0)).toBe(1);
		expect(await resolveSortableInsertionIndex(blocks, catalog, 'test:text', 3)).toBe(2);
		expect(await resolveSortableInsertionIndex(blocks, catalog, 'test:first', 2)).toBe(0);
		expect(await resolveSortableInsertionIndex(blocks, catalog, 'test:last', 0)).toBe(3);
	});

	it('exports a frozen built-in module list without global registration', () => {
		expect(Object.isFrozen(BuiltinModules)).toBe(true);
		expect(BuiltinModules.map(value => 'identity' in value ? value.identity.type : value.type)).toEqual([
			'page', 'selection', 'space', 'title', 'text', 'list', 'image', 'area', 'actions', 'hero', 'features', 'steps', 'faq', 'cta', 'ads'
		]);
	});

	it('reports malformed layouts, node shapes and document limits without throwing', () => {
		expect(validateRendererDocument(null).issues).toContainEqual(expect.objectContaining({ code: 'document.type' }));
		expect(validateRendererDocument({ ...page(), layout: null }).issues)
			.toContainEqual(expect.objectContaining({ code: 'layout.type' }));
		expect(validateRendererDocument({ ...page(), layout: { mode: 'unknown' } }).issues)
			.toContainEqual(expect.objectContaining({ code: 'layout.mode' }));
		expect(validateRendererDocument({ ...page(), blocks: null }).issues)
			.toContainEqual(expect.objectContaining({ code: 'document.blocks' }));

		const sortableResult = validateRendererDocument({
			...page(),
			blocks: [
				null,
				{ id: '', module: null, appearance: null },
				{
					id: 'invalid',
					module: { type: '', version: 0, props: [] },
					appearance: null
				},
				{
					id: 'invalid',
					module: { type: 'test:text', version: 1, props: {} },
					appearance: {
						marginTop: -1,
						marginBottom: Number.NaN,
						paddingTop: 0,
						paddingBottom: 0,
						paddingLeft: -2,
						fullWidth: 'yes',
						borderRadius: -3
					}
				}
			]
		});
		expect(sortableResult.issues.map(issue => issue.code)).toEqual(expect.arrayContaining([
			'node.type',
			'node.id',
			'node.id.duplicate',
			'module.type',
			'module.name',
			'module.version',
			'module.props',
			'appearance.type',
			'appearance.fullWidth',
			'number.nonNegative',
			'number.finite'
		]));

		const invalidDraggable = createEmptyRendererDocument('draggable');
		Object.assign(invalidDraggable.layout, { width: 0, height: -1, background: 1 });
		const draggableResult = validateRendererDocument({
			...invalidDraggable,
			blocks: [{
				id: 'free',
				module: { type: 'test:free', version: 1, props: {} },
				placement: null,
				appearance: {}
			}]
		});
		expect(draggableResult.issues.map(issue => issue.code)).toEqual(expect.arrayContaining([
			'number.positive',
			'layout.background',
			'placement.type',
			'appearance.unsupported'
		]));

		const locked = createEmptyRendererDocument('draggable');
		expect(validateRendererDocument({
			...locked,
			blocks: [{
				id: 'locked',
				module: { type: 'text', version: 1, props: {} },
				placement: { x: 0, y: 0, width: 10, height: 10, rotate: 0, zIndex: 1 },
				locked: 'yes'
			}]
		}).issues)
			.toContainEqual(expect.objectContaining({ code: 'node.locked' }));

		const oversized = page(Array.from({ length: 501 }, (_, index) => node(`node-${index}`)));
		expect(validateRendererDocument(oversized).issues)
			.toContainEqual(expect.objectContaining({ code: 'document.nodes' }));
	});

	it('reports module loading, frame, ordering and version failures independently', async () => {
		const onlyDraggable = defineRendererModule({
			...module(),
			identity: { ...module().identity, type: 'test:free' },
			frames: {
				draggable: {
					initialPlacement: () => ({ x: 0, y: 0, width: 100, height: 100, rotate: 0, zIndex: 1 })
				}
			}
		});
		const noMigration = defineRendererModule({
			...module({ version: 2 }),
			identity: { ...module({ version: 2 }).identity, type: 'test:no-migration' },
			data: { ...module({ version: 2 }).data, migrate: undefined }
		});
		const throwing = defineRendererModule({
			...module(),
			identity: { ...module().identity, type: 'test:throwing' },
			data: { ...module().data, normalize: () => { throw 'normalize failed'; } }
		});
		const first = defineRendererModule({
			...module(),
			identity: { ...module().identity, type: 'test:first' },
			frames: { sortable: { insertion: 'first' } }
		});
		const last = defineRendererModule({
			...module(),
			identity: { ...module().identity, type: 'test:last' },
			frames: { sortable: { insertion: 'last' } }
		});
		const value = page([
			node('middle'),
			{ ...node('first'), module: { type: 'test:first', version: 1, props: { text: 'first' } } },
			{ ...node('last'), module: { type: 'test:last', version: 1, props: { text: 'last' } } },
			{ ...node('unknown'), module: { type: 'test:unknown', version: 1, props: {} } },
			{ ...node('frame'), module: { type: 'test:free', version: 1, props: {} } },
			{ ...node('future'), module: { type: 'test:text', version: 9, props: {} } },
			{ ...node('migration'), module: { type: 'test:no-migration', version: 1, props: {} } },
			{ ...node('throwing'), module: { type: 'test:throwing', version: 1, props: {} } },
			{ ...node('offline'), module: { type: 'test:offline', version: 1, props: {} } }
		]);
		const catalog = createRendererModuleCatalog([
			module(), first, last, onlyDraggable, noMigration, throwing,
			{ type: 'test:offline', load: async () => { throw 'offline'; } }
		]);
		const result = await prepareRendererDocument(value, catalog, context, { unknownModuleSeverity: 'warning' });
		expect(result.issues.map(issue => issue.code)).toEqual(expect.arrayContaining([
			'module.insertion.first',
			'module.insertion.last',
			'module.unknown',
			'module.frame',
			'module.version.future',
			'module.migration.missing',
			'module.normalize',
			'module.load'
		]));
		expect(result.issues.find(issue => issue.code === 'module.unknown')?.severity).toBe('warning');
	});

	it('validates every catalog capability boundary and lazy-module identity', async () => {
		expect(() => createRendererModuleCatalog([{
			...module(),
			identity: { ...module().identity, type: '' }
		}])).toThrow('empty');
		expect(() => createRendererModuleCatalog([{ type: '', load: async () => module() }])).toThrow('empty');
		expect(() => createRendererModuleCatalog([{
			...module(),
			frames: {
				draggable: {
					initialPlacement: () => ({ x: 0, y: 0, width: 1, height: 1, rotate: 0, zIndex: 1 }),
					minHeight: 200,
					maxHeight: 100
				}
			}
		}])).toThrow('minHeight');
		expect(() => createRendererModuleCatalog([{
			...module(),
			frames: {
				draggable: {
					initialPlacement: () => ({ x: 0, y: 0, width: 1, height: 1, rotate: 0, zIndex: 1 }),
					aspectRatio: Number.NaN
				}
			}
		}])).toThrow('aspectRatio');
		expect(() => createRendererModuleCatalog([{
			...module(),
			widget: { presets: [{ key: '', label: 'Empty' }] }
		}])).toThrow('duplicated');

		const catalog = createRendererModuleCatalog([module()]);
		expect(catalog.has('test:text')).toBe(true);
		expect(catalog.has('missing')).toBe(false);
		expect(await catalog.get('missing')).toBeNull();
		const mismatch = createRendererModuleCatalog([{
			type: 'expected',
			load: async () => ({ default: module() })
		}]);
		await expect(mismatch.get('expected')).rejects.toThrow('mismatch');
	});

	it('uses Math.random when no Crypto random source exists', () => {
		const original = globalThis.crypto;
		vi.stubGlobal('crypto', undefined);
		vi.spyOn(Math, 'random').mockReturnValue(0.25);
		expect(createRendererId()).toMatch(/^renderer-/u);
		vi.restoreAllMocks();
		vi.stubGlobal('crypto', original);
	});
});
