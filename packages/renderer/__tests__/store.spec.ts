import { RendererStore } from '../src/store';
import type { RendererDraggableDocument, RendererSortableDocument } from '../src';

const appearance = { marginTop: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 };
const sortable = (): RendererSortableDocument => ({
	schemaVersion: 2,
	meta: { id: 'sortable' },
	layout: { mode: 'sortable', maxWidth: 1000, minHeight: 600, background: '#fff' },
	blocks: [{ id: 'a', module: { type: 'text', version: 1, props: { text: 'A' } }, appearance }]
});
const draggable = (): RendererDraggableDocument => ({
	schemaVersion: 2,
	meta: { id: 'draggable' },
	layout: { mode: 'draggable', width: 1000, height: 600, background: '#fff' },
	blocks: [{
		id: 'a',
		module: { type: 'text', version: 1, props: { text: 'A' } },
		placement: { x: 10, y: 20, width: 100, height: 80, rotate: 0, zIndex: 1 }
	}]
});

describe('RendererStore', () => {
	it('owns immutable input and command history', () => {
		const input = sortable();
		const store = new RendererStore(input);
		store.insertNode(1, { id: 'b', module: { type: 'text', version: 1, props: {} }, appearance });
		expect(store.document.blocks.map(item => item.id)).toEqual(['a', 'b']);
		expect(input.blocks).toHaveLength(1);
		store.moveNode('b', 0);
		store.updateProps('b', { text: 'B' });
		store.updateAppearance('b', { ...appearance, marginTop: 12 });
		expect(store.getNode('b')?.module.props).toEqual({ text: 'B' });
		store.undo();
		expect(store.getNode('b')?.appearance?.marginTop).toBe(0);
		store.redo();
		expect(store.getNode('b')?.appearance?.marginTop).toBe(12);
	});

	it('keeps session state outside the document', () => {
		const store = new RendererStore(sortable());
		store.select('a');
		store.updateViewport({ scale: 1.5, showGrid: true });
		expect(store.selectedId).toBe('a');
		expect(store.viewport.scale).toBe(1.5);
		expect(JSON.stringify(store.document)).not.toContain('showGrid');
	});

	it('commits transient placement as one undoable command', () => {
		const store = new RendererStore(draggable());
		const before = { ...(store.getNode('a') as { placement: RendererDraggableDocument['blocks'][0]['placement'] }).placement };
		const after = { ...before, x: 120, rotate: 37 };
		store.updatePlacement('a', after, { history: false });
		store.commitPlacement('a', before, after);
		expect(store.getNode('a')?.placement?.x).toBe(120);
		store.undo();
		expect(store.getNode('a')?.placement?.x).toBe(10);
	});

	it('removes selections and resets external documents', () => {
		const store = new RendererStore(sortable());
		store.insertNode(1, { id: 'b', module: { type: 'text', version: 1, props: {} }, appearance });
		store.setSelection(['a', 'b']);
		expect(store.selectedIds).toEqual(['b']);
		store.removeNodes(['a', 'b']);
		expect(store.document.blocks).toHaveLength(0);
		store.undo();
		expect(store.document.blocks.map(node => node.id)).toEqual(['a', 'b']);
		store.select('a');
		store.removeNode('a');
		expect(store.selectedIds).toEqual([]);
		store.updateViewport({ guideX: [10], guideY: [20] });
		store.resetExternal(sortable());
		expect(store.document.blocks).toHaveLength(1);
		expect(store.viewport.guideX).toEqual([]);
		expect(store.viewport.guideY).toEqual([]);
		expect(store.canUndo).toBe(false);
	});

	it('commits a multi-selection move as one history entry', () => {
		const value = draggable();
		value.blocks.push({
			id: 'b',
			module: { type: 'text', version: 1, props: { text: 'B' } },
			placement: { x: 20, y: 40, width: 100, height: 80, rotate: 0, zIndex: 2 }
		});
		const store = new RendererStore(value);
		const changes = value.blocks.map(node => ({
			id: node.id,
			before: { ...node.placement },
			after: { ...node.placement, x: node.placement.x + 100 }
		}));
		changes.forEach(change => store.updatePlacement(change.id, change.after, { history: false }));
		store.commitPlacements(changes);
		expect(store.document.blocks.map(node => node.placement.x)).toEqual([110, 120]);
		store.undo();
		expect(store.document.blocks.map(node => node.placement.x)).toEqual([10, 20]);
	});

	it('normalizes selection and ignores commands that cannot change the document', () => {
		const store = new RendererStore(sortable());
		store.setSelection(['missing', 'a', 'a']);
		expect(store.selectedIds).toEqual(['a']);
		store.select('a', true);
		expect(store.selectedIds).toEqual(['a']);
		store.select(null);
		expect(store.selectedIds).toEqual([]);

		store.moveNode('missing', 0);
		store.moveNode('a', 0);
		store.updateProps('missing', {});
		store.updateProps('a', { text: 'A' });
		store.updateAppearance('missing', appearance);
		store.updateAppearance('a', appearance);
		store.updatePlacement('missing', { x: 0, y: 0, width: 1, height: 1, rotate: 0, zIndex: 0 });
		store.removeNodes(['missing']);
		store.commitPlacements([]);
		store.undo();
		store.redo();
		expect(store.document.blocks.map(node => node.id)).toEqual(['a']);
		expect(store.canUndo).toBe(false);
	});

	it('clamps insertion and movement indexes and restores removed nodes at stable positions', () => {
		const store = new RendererStore(sortable());
		store.insertNode(-20, { id: 'first', module: { type: 'text', version: 1, props: {} }, appearance });
		store.insertNode(99, { id: 'last', module: { type: 'text', version: 1, props: {} }, appearance });
		expect(store.document.blocks.map(node => node.id)).toEqual(['first', 'a', 'last']);
		store.moveNode('first', 99);
		expect(store.document.blocks.map(node => node.id)).toEqual(['a', 'last', 'first']);
		store.setSelection(['a', 'first']);
		store.removeNodes(['first', 'missing', 'a', 'a']);
		expect(store.document.blocks.map(node => node.id)).toEqual(['last']);
		store.undo();
		expect(store.document.blocks.map(node => node.id)).toEqual(['a', 'last', 'first']);
	});

	it('merges rapid property and layout edits into one history entry', () => {
		vi.useFakeTimers();
		vi.setSystemTime(1_000);
		const store = new RendererStore(sortable());
		store.updateProps('a', { text: 'B' });
		vi.setSystemTime(1_200);
		store.updateProps('a', { text: 'C' });
		expect(store.getNode('a')?.module.props).toEqual({ text: 'C' });
		store.undo();
		expect(store.getNode('a')?.module.props).toEqual({ text: 'A' });
		store.redo();
		expect(store.getNode('a')?.module.props).toEqual({ text: 'C' });

		const first = { ...store.document.layout, maxWidth: 900 } as RendererSortableDocument['layout'];
		const second = { ...store.document.layout, maxWidth: 800 } as RendererSortableDocument['layout'];
		store.updateLayout(first);
		vi.setSystemTime(1_400);
		store.updateLayout(second);
		store.undo();
		expect(store.document.layout).toEqual(expect.objectContaining({ maxWidth: 1000 }));
		vi.useRealTimers();
	});

	it('limits history, replaces documents and supports transient placement updates', () => {
		const store = new RendererStore(draggable(), { historyLimit: 2 });
		const original = store.getNode('a')!.placement!;
		store.updatePlacement('a', { ...original, x: 30 }, { history: false });
		expect(store.getNode('a')?.placement?.x).toBe(30);
		store.updatePlacement('a', { ...original, x: 40 });
		store.updatePlacement('a', { ...original, x: 50 });
		store.updatePlacement('a', { ...original, x: 60 });
		store.undo();
		store.undo();
		store.undo();
		expect(store.getNode('a')?.placement?.x).toBe(40);

		const replacement = sortable();
		replacement.meta.title = 'Replacement';
		store.replaceDocument(replacement);
		expect(store.document.meta.title).toBe('Replacement');
		expect(store.selectedIds).toEqual([]);
		store.undo();
		expect(store.document.layout.mode).toBe('draggable');
		store.redo();
		expect(store.document.layout.mode).toBe('sortable');
	});

	it('commits only valid multi-placement targets and skips unchanged values', () => {
		const value = draggable();
		value.blocks.push({
			id: 'b',
			module: { type: 'text', version: 1, props: {} },
			placement: { x: 20, y: 20, width: 20, height: 20, rotate: 0, zIndex: 2 }
		});
		const store = new RendererStore(value);
		const a = { ...store.getNode('a')!.placement! };
		const b = { ...store.getNode('b')!.placement! };
		store.commitPlacements([
			{ id: 'a', before: a, after: a },
			{ id: 'b', before: b, after: { ...b, y: 90 } },
			{ id: 'missing', before: b, after: { ...b, y: 120 } }
		]);
		expect(store.getNode('b')?.placement?.y).toBe(90);
		store.undo();
		expect(store.getNode('b')?.placement?.y).toBe(20);
	});

	it('supports history-free live moves and a single commitMove entry', () => {
		const store = new RendererStore(sortable());
		store.insertNode(1, { id: 'b', module: { type: 'text', version: 1, props: {} }, appearance });
		store.insertNode(2, { id: 'c', module: { type: 'text', version: 1, props: {} }, appearance });
		const historyDepth = store.canUndo;
		store.moveNode('a', 2, { history: false });
		expect(store.document.blocks.map(node => node.id)).toEqual(['b', 'c', 'a']);
		expect(store.canUndo).toBe(historyDepth);
		store.commitMove('a', 0, 2);
		store.undo();
		expect(store.document.blocks.map(node => node.id)).toEqual(['a', 'b', 'c']);
		store.redo();
		expect(store.document.blocks.map(node => node.id)).toEqual(['b', 'c', 'a']);
		store.commitMove('a', 2, 2);
		store.moveNode('a', 2, { history: false });
		expect(store.document.blocks.map(node => node.id)).toEqual(['b', 'c', 'a']);
		store.moveNode('c', 0);
		expect(store.document.blocks.map(node => node.id)).toEqual(['c', 'b', 'a']);
		store.undo();
		expect(store.document.blocks.map(node => node.id)).toEqual(['b', 'c', 'a']);
	});

	it('commits live layout updates as one undoable command', () => {
		const store = new RendererStore(draggable());
		const before = { ...store.document.layout };
		store.updateLayout({ ...before, width: 1100 } as RendererDraggableDocument['layout'], { history: false });
		expect(store.document.layout).toEqual(expect.objectContaining({ width: 1100 }));
		expect(store.canUndo).toBe(false);
		store.commitLayout(before, store.document.layout);
		expect(store.canUndo).toBe(true);
		store.undo();
		expect(store.document.layout).toEqual(expect.objectContaining({ width: 1000 }));
		store.redo();
		expect(store.document.layout).toEqual(expect.objectContaining({ width: 1100 }));
		store.commitLayout(store.document.layout, store.document.layout);
		expect(store.document.layout).toEqual(expect.objectContaining({ width: 1100 }));
	});

	it('groups, locks, copies and pastes free-layout selections as one history entry', () => {
		const value = draggable();
		value.blocks.push({
			id: 'b',
			module: { type: 'text', version: 1, props: { text: 'B' } },
			placement: { x: 20, y: 40, width: 100, height: 80, rotate: 0, zIndex: 2 }
		});
		const store = new RendererStore(value);
		store.createSelectionFromIds(['a', 'b']);
		const groupId = store.selectedId;
		expect(groupId).toBeTruthy();
		expect(store.document.blocks).toHaveLength(3);
		expect(store.getNode(groupId!)?.module.props).toEqual({ members: ['a', 'b'] });
		store.undo();
		expect(store.document.blocks.map(node => node.id)).toEqual(['a', 'b']);
		store.redo();
		store.copySelection();
		expect(store.hasClipboard).toBe(true);
		store.pasteClipboard({ x: 400, y: 300 });
		expect(store.document.blocks).toHaveLength(6);
		store.setLocked(groupId!, true);
		expect(store.getNode(groupId!)?.locked).toBe(true);
		store.applyLayer(groupId!, 'top');
		store.removeNode(groupId!);
		expect(store.getNode('a')).toBeUndefined();
		expect(store.getNode('b')).toBeUndefined();
		store.undo();
		store.ungroupNode(groupId!);
		expect(store.getNode(groupId!)).toBeUndefined();
		expect(store.getNode('a')).toBeTruthy();
		expect(store.getNode('b')).toBeTruthy();
	});

	it('ignores invalid clipboard, grouping and layer commands', () => {
		const sortableStore = new RendererStore(sortable());
		sortableStore.copySelection();
		sortableStore.select('a');
		sortableStore.copySelection();
		expect(sortableStore.hasClipboard).toBe(false);
		sortableStore.pasteClipboard();
		sortableStore.createSelectionFromIds(['a']);
		sortableStore.applyMarquee({ left: 0, top: 0, right: 10, bottom: 10 });
		expect(sortableStore.applyLayer('a', 'top')).toBe(false);

		const store = new RendererStore(draggable());
		store.copySelection();
		expect(store.hasClipboard).toBe(false);
		store.pasteClipboard();
		store.createSelectionFromIds(['a']);
		store.createSelectionFromIds(['a', 'missing']);
		store.ungroupNode('a');
		store.setLocked('a', false);
		store.setLocked('missing', true);
		expect(store.applyLayer('a', 'top')).toBe(false);
		store.select('a');
		store.copySelection();
		store.select('a', true);
		expect(store.selectedIds).toEqual([]);
		store.select('a', true);
		expect(store.selectedIds).toEqual(['a']);
		store.applyMarquee({ left: 0, top: 0, right: 5, bottom: 5 });
		expect(store.selectedIds).toEqual([]);
		store.applyMarquee({ left: 0, top: 0, right: 200, bottom: 120 });
		expect(store.selectedIds).toEqual(['a']);
		store.pasteClipboard();
		expect(store.document.blocks).toHaveLength(2);

		const pair = draggable();
		pair.blocks.push({
			id: 'b',
			module: { type: 'text', version: 1, props: { text: 'B' } },
			placement: { x: 20, y: 40, width: 100, height: 80, rotate: 0, zIndex: 2 }
		});
		const grouped = new RendererStore(pair);
		grouped.applyMarquee({ left: 0, top: 0, right: 400, bottom: 300 });
		expect(grouped.document.blocks.some(node => node.module.type === 'selection')).toBe(true);
	});
});
