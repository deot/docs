import type {
	RendererDocument,
	RendererDraggableNode,
	RendererNode,
	RendererPlacement,
	RendererSortableAppearance
} from '../types';
import { cloneRendererValue } from '../validate';
import type { HistoryStack } from './history';
import {
	cloneDocument,
	findNode,
	findNodeIndex
} from './document';
import type { SelectionSession } from './selection';

const sameValue = (left: unknown, right: unknown) => (
	JSON.stringify(left) === JSON.stringify(right)
);

export interface DocumentCommandHost {
	get document(): RendererDocument;
	set document(value: RendererDocument);
	history: HistoryStack;
	selection: SelectionSession;
}

/**
 * 文档命令集合。全部按稳定节点 ID 寻址，Store 是文档唯一写入口。
 * @param host
 */
export const createDocumentCommands = (host: DocumentCommandHost) => {
	const getNode = (id: string) => findNode(host.document, id);
	const getNodeIndex = (id: string) => findNodeIndex(host.document, id);

	const insertNode = (index: number, node: RendererNode) => {
		const value = cloneRendererValue(node) as RendererNode;
		const target = Math.min(Math.max(0, index), host.document.blocks.length);
		host.history.execute({
			label: 'insertNode',
			redo: () => host.document.blocks.splice(target, 0, cloneRendererValue(value) as never),
			undo: () => {
				const current = getNodeIndex(value.id);
				if (current >= 0) host.document.blocks.splice(current, 1);
			}
		});
		host.selection.select(value.id);
	};

	const removeNodes = (ids: readonly string[]) => {
		const targets = [...new Set(ids)]
			.map(id => ({ id, index: getNodeIndex(id) }))
			.filter(value => value.index >= 0)
			.map(value => ({ ...value, node: cloneRendererValue(host.document.blocks[value.index]) }))
			.sort((left, right) => left.index - right.index);
		if (!targets.length) return;
		host.history.execute({
			label: 'removeNodes',
			redo: () => {
				[...targets].reverse().forEach(({ id }) => {
					const current = getNodeIndex(id);
					if (current >= 0) host.document.blocks.splice(current, 1);
				});
				const removed = new Set(targets.map(value => value.id));
				host.selection.ids = host.selection.ids.filter(id => !removed.has(id));
			},
			undo: () => targets.forEach(({ index, node }) => {
				host.document.blocks.splice(index, 0, cloneRendererValue(node) as never);
			})
		});
	};

	const applyMove = (id: string, target: number) => {
		const current = getNodeIndex(id);
		if (current < 0) return;
		const next = Math.min(Math.max(0, target), host.document.blocks.length - 1);
		if (current === next) return;
		const [node] = host.document.blocks.splice(current, 1);
		host.document.blocks.splice(next, 0, node as never);
	};

	const moveNode = (id: string, index: number, options: { history?: boolean } = {}) => {
		const before = getNodeIndex(id);
		if (before < 0) return;
		const after = Math.min(Math.max(0, index), host.document.blocks.length - 1);
		if (before === after) return;
		if (options.history === false) {
			applyMove(id, after);
			return;
		}
		host.history.execute({
			label: 'moveNode',
			redo: () => applyMove(id, after),
			undo: () => applyMove(id, before)
		});
	};

	const commitMove = (id: string, before: number, after: number) => {
		const from = Math.min(Math.max(0, before), host.document.blocks.length - 1);
		const to = Math.min(Math.max(0, after), host.document.blocks.length - 1);
		if (from === to) return;
		const current = getNodeIndex(id);
		if (current !== to) applyMove(id, to);
		host.history.execute({
			label: 'moveNode',
			redo: () => applyMove(id, to),
			undo: () => applyMove(id, from)
		});
	};

	const updateProps = (id: string, value: Record<string, unknown>) => {
		const node = getNode(id);
		if (!node || sameValue(node.module.props, value)) return;
		const before = cloneRendererValue(node.module.props);
		const after = cloneRendererValue(value);
		const apply = (next: Record<string, unknown>) => {
			const target = getNode(id);
			if (target) target.module.props = cloneRendererValue(next);
		};
		host.history.execute({
			label: 'updateProps',
			mergeKey: `props:${id}`,
			redo: () => apply(after),
			undo: () => apply(before)
		});
	};

	const updateAppearance = (id: string, value: RendererSortableAppearance) => {
		const node = getNode(id);
		if (!node || !('appearance' in node) || sameValue(node.appearance, value)) return;
		const before = cloneRendererValue(node.appearance!);
		const after = cloneRendererValue(value);
		const apply = (next: RendererSortableAppearance) => {
			const target = getNode(id);
			if (target && 'appearance' in target) target.appearance = cloneRendererValue(next);
		};
		host.history.execute({
			label: 'updateAppearance',
			mergeKey: `appearance:${id}`,
			redo: () => apply(after),
			undo: () => apply(before)
		});
	};

	const updatePlacement = (
		id: string,
		value: RendererPlacement,
		options: { history?: boolean } = {}
	) => {
		const node = getNode(id) as RendererDraggableNode | undefined;
		if (!node?.placement || sameValue(node.placement, value)) return;
		if (options.history === false) {
			node.placement = cloneRendererValue(value);
			return;
		}
		const before = cloneRendererValue(node.placement);
		const after = cloneRendererValue(value);
		const apply = (next: RendererPlacement) => {
			const target = getNode(id) as RendererDraggableNode | undefined;
			if (target?.placement) target.placement = cloneRendererValue(next);
		};
		host.history.execute({
			label: 'updatePlacement',
			redo: () => apply(after),
			undo: () => apply(before)
		});
	};

	const commitPlacements = (
		values: Array<{ id: string; before: RendererPlacement; after: RendererPlacement }>
	) => {
		const changes = values.filter(value => !sameValue(value.before, value.after));
		if (!changes.length) return;
		const apply = (key: 'before' | 'after') => changes.forEach((value) => {
			const node = getNode(value.id) as RendererDraggableNode | undefined;
			if (node?.placement) node.placement = cloneRendererValue(value[key]);
		});
		apply('before');
		host.history.execute({
			label: 'updatePlacements',
			redo: () => apply('after'),
			undo: () => apply('before')
		});
	};

	const updateLayout = (value: RendererDocument['layout'], options: { history?: boolean } = {}) => {
		if (sameValue(host.document.layout, value)) return;
		if (options.history === false) {
			host.document.layout = cloneRendererValue(value) as never;
			return;
		}
		const before = cloneRendererValue(host.document.layout);
		const after = cloneRendererValue(value);
		const apply = (next: RendererDocument['layout']) => {
			host.document.layout = cloneRendererValue(next) as never;
		};
		host.history.execute({
			label: 'updateLayout',
			mergeKey: 'layout',
			redo: () => apply(after),
			undo: () => apply(before)
		});
	};

	const commitLayout = (
		before: RendererDocument['layout'],
		after: RendererDocument['layout']
	) => {
		if (sameValue(before, after)) return;
		const apply = (next: RendererDocument['layout']) => {
			host.document.layout = cloneRendererValue(next) as never;
		};
		apply(after);
		host.history.execute({
			label: 'updateLayout',
			redo: () => apply(after),
			undo: () => apply(before)
		});
	};

	const replaceDocument = (value: RendererDocument) => {
		const before = cloneDocument(host.document);
		const after = cloneDocument(value);
		host.history.execute({
			label: 'replaceDocument',
			redo: () => {
				host.document = cloneDocument(after);
				host.selection.clear();
			},
			undo: () => {
				host.document = cloneDocument(before);
				host.selection.clear();
			}
		});
	};

	const replaceBlocks = (
		next: readonly RendererNode[],
		selectIds: readonly string[] = []
	) => {
		const before = cloneRendererValue(host.document.blocks) as RendererNode[];
		const after = cloneRendererValue(next) as RendererNode[];
		const selectionBefore = [...host.selection.ids];
		const selectionAfter = [...selectIds];
		const apply = (blocks: RendererNode[], ids: readonly string[]) => {
			host.document.blocks.splice(
				0,
				host.document.blocks.length,
				...cloneRendererValue(blocks) as never[]
			);
			host.selection.set(ids, id => Boolean(getNode(id)));
		};
		host.history.execute({
			label: 'replaceBlocks',
			redo: () => apply(after, selectionAfter),
			undo: () => apply(before, selectionBefore)
		});
	};

	const updateLocked = (id: string, locked: boolean) => {
		const node = getNode(id);
		if (!node || Boolean(node.locked) === locked) return;
		const apply = (value: boolean) => {
			const target = getNode(id);
			if (!target) return;
			if (value) target.locked = true;
			else delete target.locked;
		};
		host.history.execute({
			label: 'updateLocked',
			redo: () => apply(locked),
			undo: () => apply(!locked)
		});
	};

	return {
		insertNode,
		removeNodes,
		moveNode,
		commitMove,
		updateProps,
		updateAppearance,
		updatePlacement,
		commitPlacements,
		updateLayout,
		commitLayout,
		replaceDocument,
		replaceBlocks,
		updateLocked
	};
};
