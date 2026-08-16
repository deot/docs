import {
	applyMarqueeAction,
	createRendererSelectionNode,
	expandRemovalIds,
	groupedMemberIds,
	resolveLayerChanges,
	resolveMarqueeAction,
	selectionBoundsPlacement,
	stackedDraggableNodes
} from '../src/modules/shared/selection';
import type { RendererDraggableNode } from '../src';

const node = (
	id: string,
	placement: Partial<RendererDraggableNode['placement']> = {},
	type = 'text'
): RendererDraggableNode => ({
	id,
	module: { type, version: 1, props: type === 'selection' ? { members: [] } : { text: id } },
	placement: {
		x: 0,
		y: 0,
		width: 40,
		height: 40,
		rotate: 0,
		zIndex: 1,
		...placement
	}
});

describe('renderer selection groups', () => {
	it('creates a group from two overlapping modules and reuses an existing group', () => {
		const a = node('a', { x: 0, y: 0, width: 80, height: 80, zIndex: 1 });
		const b = node('b', { x: 60, y: 60, width: 80, height: 80, zIndex: 2 });
		const action = resolveMarqueeAction([a, b], { left: 0, top: 0, right: 200, bottom: 200 });
		expect(action).toEqual({ type: 'group', memberIds: ['a', 'b'], removeGroupIds: [] });
		const grouped = applyMarqueeAction([a, b], action, 'g1') as RendererDraggableNode[];
		expect(grouped.at(-1)).toEqual(expect.objectContaining({
			id: 'g1',
			module: { type: 'selection', version: 1, props: { members: ['a', 'b'] } }
		}));
		expect(grouped.at(-1)?.placement).toEqual(selectionBoundsPlacement([a, b]));

		const again = resolveMarqueeAction(grouped, { left: 0, top: 0, right: 200, bottom: 200 });
		expect(again).toEqual({ type: 'select', id: 'g1' });
	});

	it('selects a single hit and ignores locked modules', () => {
		const a = node('a', { x: 0, y: 0, zIndex: 1 });
		const locked = { ...node('b', { x: 80, y: 0, zIndex: 2 }), locked: true };
		expect(resolveMarqueeAction([a, locked], { left: 70, top: 0, right: 130, bottom: 40 }))
			.toEqual({ type: 'clear' });
		expect(resolveMarqueeAction([a], { left: 0, top: 0, right: 20, bottom: 20 }))
			.toEqual({ type: 'select', id: 'a' });
	});

	it('expands group deletion to members and drops leftover groups', () => {
		const group = createRendererSelectionNode('g', ['a', 'b'], {
			x: 0, y: 0, width: 100, height: 100, rotate: 0, zIndex: 3
		});
		const blocks = [node('a'), node('b'), node('c'), group];
		expect(expandRemovalIds(blocks, ['g'], true)).toEqual(expect.arrayContaining(['g', 'a', 'b']));
		expect(expandRemovalIds(blocks, ['g'], false)).toEqual(['g']);
		expect(expandRemovalIds(blocks, ['a'], true)).toEqual(expect.arrayContaining(['a', 'g']));
	});

	it('restacks a group to the top together with its members', () => {
		const a = node('a', { zIndex: 1 });
		const b = node('b', { zIndex: 2 });
		const c = node('c', { zIndex: 3 });
		const group = createRendererSelectionNode('g', ['a', 'b'], {
			x: 0, y: 0, width: 80, height: 80, rotate: 0, zIndex: 2
		});
		const changes = resolveLayerChanges([a, b, c, group], 'g', 'top');
		expect(changes.map(item => item.id)).toEqual(expect.arrayContaining(['a', 'b', 'g']));
		expect(Math.max(...changes.map(item => item.after.zIndex))).toBeGreaterThan(3);
		expect(resolveLayerChanges([a, b, c], 'c', 'top')).toEqual([]);
		expect(resolveLayerChanges([a, b, c], 'a', 'up')[0]).toEqual(expect.objectContaining({
			id: 'a',
			after: expect.objectContaining({ zIndex: 2 })
		}));
		expect(resolveLayerChanges([a, b, c], 'c', 'down')[0]).toEqual(expect.objectContaining({
			id: 'c',
			after: expect.objectContaining({ zIndex: 2 })
		}));
		expect(resolveLayerChanges([a, b, c], 'a', 'bottom')).toEqual([]);
		const lowered = resolveLayerChanges([a, b, c], 'c', 'bottom');
		expect(Math.min(...lowered.map(item => item.after.zIndex))).toBeLessThan(1);
		expect(resolveLayerChanges([a, b, c], 'missing', 'up')).toEqual([]);
		expect(resolveLayerChanges([a, b, c], 'a', 'down')).toEqual([]);
		expect(resolveLayerChanges([a, b, c], 'c', 'up')).toEqual([]);
		const topGroup = createRendererSelectionNode('g-top', ['b', 'c'], {
			x: 0, y: 0, width: 80, height: 80, rotate: 0, zIndex: 3
		});
		expect(resolveLayerChanges([a, b, c, topGroup], 'g-top', 'top')).toEqual([]);
		const bottomGroup = createRendererSelectionNode('g-bottom', ['a', 'b'], {
			x: 0, y: 0, width: 80, height: 80, rotate: 0, zIndex: 0
		});
		const lowA = node('a', { zIndex: 0 });
		const lowB = node('b', { zIndex: 0 });
		expect(resolveLayerChanges([bottomGroup, lowA, lowB, c], 'g-bottom', 'bottom')).toEqual([]);
		expect(groupedMemberIds([topGroup, a, b, c]).has('c')).toBe(true);
		expect(stackedDraggableNodes([c, a, b]).map(item => item.id)).toEqual(['a', 'b', 'c']);
	});
});
