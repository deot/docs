import { reactive, readonly } from 'vue';
import type {
	RendererDocument,
	RendererDraggableNode,
	RendererNode,
	RendererPlacement,
	RendererSortableAppearance
} from '../types';
import { RENDERER_PAGE_TYPE } from '../types';
import { createRendererId } from '../utils/id';
import { cloneRendererValue } from '../validate';
import {
	applyMarqueeAction,
	createRendererSelectionNode,
	expandRemovalIds,
	findSelectionGroup,
	isRendererSelectionModule,
	resolveLayerChanges,
	resolveMarqueeAction,
	selectionBoundsPlacement,
	selectionMemberIds,
	type LayerDirection,
	type MarqueeRect
} from '../modules/shared/selection/group';
import { createDocumentCommands, type DocumentCommandHost } from './commands';
import { cloneDocument, findNode, findNodeIndex } from './document';
import { HistoryStack } from './history';
import { SelectionSession } from './selection';
import { ViewportSession } from './viewport';

interface ClipboardPayload {
	primary: RendererDraggableNode;
	members: RendererDraggableNode[];
}

/**
 * Combo 的实例级 Store。文档命令按稳定节点 ID 寻址，选择、缩放和辅助线等
 * 会话状态与可序列化文档分离；历史、选择、视口分文件实现，但仍是一个实例。
 */
export class RendererStore {
	private state: { document: RendererDocument };
	private history: HistoryStack;
	private selection: SelectionSession;
	private viewportSession: ViewportSession;
	private clipboardSession: ClipboardPayload | null = null;
	private commands: ReturnType<typeof createDocumentCommands>;

	constructor(document: RendererDocument, options: { historyLimit?: number } = {}) {
		this.state = reactive({
			document: cloneDocument(document)
		});
		this.history = new HistoryStack(options.historyLimit);
		this.selection = reactive(new SelectionSession()) as SelectionSession;
		this.viewportSession = new ViewportSession();
		const self = this;
		const host: DocumentCommandHost = {
			get document() {
				return self.state.document;
			},
			set document(value: RendererDocument) {
				self.state.document = value;
			},
			history: this.history,
			selection: this.selection
		};
		this.commands = createDocumentCommands(host);
	}

	get document() {
		return readonly(this.state.document) as Readonly<RendererDocument>;
	}

	get selectedIds() {
		return readonly(this.selection.ids) as readonly string[];
	}

	get selectedId() {
		return this.selection.selectedId;
	}

	get viewport() {
		return this.viewportSession.snapshot;
	}

	get canUndo() {
		return this.history.canUndo;
	}

	get canRedo() {
		return this.history.canRedo;
	}

	get hasClipboard() {
		return Boolean(this.clipboardSession);
	}

	getNode(id: string) {
		return findNode(this.state.document, id);
	}

	getNodeIndex(id: string) {
		return findNodeIndex(this.state.document, id);
	}

	setSelection(ids: string[]) {
		const next = this.state.document.layout.mode === 'sortable' && ids.length > 1
			? ids.slice(-1)
			: ids;
		this.selection.set(next, id => Boolean(this.getNode(id)));
	}

	select(id: string | null, additive = false) {
		this.selection.select(
			id,
			this.state.document.layout.mode === 'sortable' ? false : additive
		);
	}

	insertNode(index: number, node: RendererNode) {
		this.commands.insertNode(index, node);
	}

	removeNode(id: string) {
		this.removeNodes([id]);
	}

	removeNodes(ids: readonly string[]) {
		this.commands.removeNodes(expandRemovalIds(this.state.document.blocks, ids, true));
	}

	moveNode(id: string, index: number, options: { history?: boolean } = {}) {
		this.commands.moveNode(id, index, options);
	}

	commitMove(id: string, before: number, after: number) {
		this.commands.commitMove(id, before, after);
	}

	updateProps(id: string, value: Record<string, unknown>) {
		this.commands.updateProps(id, value);
	}

	updateAppearance(id: string, value: RendererSortableAppearance) {
		this.commands.updateAppearance(id, value);
	}

	updatePlacement(id: string, value: RendererPlacement, options: { history?: boolean } = {}) {
		this.commands.updatePlacement(id, value, options);
	}

	commitPlacement(id: string, before: RendererPlacement, after: RendererPlacement) {
		this.commitPlacements([{ id, before, after }]);
	}

	commitPlacements(values: Array<{ id: string; before: RendererPlacement; after: RendererPlacement }>) {
		this.commands.commitPlacements(values);
	}

	updateLayout(value: RendererDocument['layout'], options: { history?: boolean } = {}) {
		this.commands.updateLayout(value, options);
	}

	commitLayout(before: RendererDocument['layout'], after: RendererDocument['layout']) {
		this.commands.commitLayout(before, after);
	}

	replaceDocument(value: RendererDocument) {
		this.commands.replaceDocument(value);
	}

	resetExternal(value: RendererDocument) {
		this.state.document = cloneDocument(value);
		this.selection.clear();
		this.viewportSession.resetSession();
		this.history.clear();
	}

	updateViewport(value: Partial<typeof this.viewportSession.state>) {
		this.viewportSession.update(value);
	}

	ungroupNode(id: string) {
		const node = this.getNode(id);
		if (!node || !isRendererSelectionModule(node.module.type)) return;
		const members = selectionMemberIds(node);
		this.commands.removeNodes(expandRemovalIds(this.state.document.blocks, [id], false));
		this.setSelection(members.filter(memberId => Boolean(this.getNode(memberId))));
	}

	setLocked(id: string, locked: boolean) {
		this.commands.updateLocked(id, locked);
	}

	applyLayer(id: string, direction: LayerDirection) {
		if (this.state.document.layout.mode !== 'draggable') return false;
		const changes = resolveLayerChanges(
			this.state.document.blocks as RendererDraggableNode[],
			id,
			direction
		);
		if (!changes.length) return false;
		this.commitPlacements(changes);
		return true;
	}

	applyMarquee(rect: MarqueeRect) {
		if (this.state.document.layout.mode !== 'draggable') return;
		const blocks = this.state.document.blocks as RendererDraggableNode[];
		const action = resolveMarqueeAction(blocks, rect);
		if (action.type === 'clear') {
			this.select(null);
			return;
		}
		if (action.type === 'select') {
			this.select(action.id);
			return;
		}
		const groupId = createRendererId();
		const next = applyMarqueeAction(blocks, action, groupId);
		if (next === blocks) {
			this.select(action.memberIds[0] || null);
			return;
		}
		this.commands.replaceBlocks(next, [groupId]);
	}

	copySelection() {
		const node = this.selectedId ? this.getNode(this.selectedId) : undefined;
		if (!node || node.module.type === RENDERER_PAGE_TYPE || !('placement' in node) || !node.placement) {
			return;
		}
		const members = selectionMemberIds(node)
			.map(id => this.getNode(id) as RendererDraggableNode | undefined)
			.filter((value): value is RendererDraggableNode => Boolean(value?.placement));
		this.clipboardSession = {
			primary: cloneRendererValue(node) as RendererDraggableNode,
			members: cloneRendererValue(members)
		};
	}

	pasteClipboard(point?: { x: number; y: number }) {
		if (!this.clipboardSession || this.state.document.layout.mode !== 'draggable') return;
		const { primary, members } = this.clipboardSession;
		const idMap = new Map<string, string>([
			[primary.id, createRendererId()],
			...members.map(node => [node.id, createRendererId()] as const)
		]);
		const delta = point
			? { x: point.x - primary.placement.x, y: point.y - primary.placement.y }
			: { x: 10, y: 10 };
		const maxZ = Math.max(
			0,
			...this.state.document.blocks.map(node => node.placement?.zIndex || 0)
		);
		const cloneNode = (node: RendererDraggableNode, index: number): RendererDraggableNode => {
			const next = cloneRendererValue(node);
			next.id = idMap.get(node.id) || createRendererId();
			delete next.locked;
			next.placement = {
				...next.placement,
				x: next.placement.x + delta.x,
				y: next.placement.y + delta.y,
				zIndex: maxZ + 1 + index
			};
			if (isRendererSelectionModule(next.module.type)) {
				next.module.props = {
					...next.module.props,
					members: selectionMemberIds(next).map(id => idMap.get(id)).filter((id): id is string => Boolean(id))
				};
			}
			return next;
		};
		const pastedMembers = members.map((node, index) => cloneNode(node, index));
		const pastedPrimary = cloneNode(primary, pastedMembers.length);
		if (isRendererSelectionModule(pastedPrimary.module.type) && pastedMembers.length >= 2) {
			pastedPrimary.placement = selectionBoundsPlacement(pastedMembers);
			pastedPrimary.placement.zIndex = maxZ + 1 + pastedMembers.length;
		}
		this.commands.replaceBlocks(
			[...this.state.document.blocks, ...pastedMembers, pastedPrimary],
			[pastedPrimary.id]
		);
	}

	createSelectionFromIds(memberIds: readonly string[]) {
		if (this.state.document.layout.mode !== 'draggable') return;
		const blocks = this.state.document.blocks as RendererDraggableNode[];
		const members = memberIds
			.map(id => blocks.find(node => node.id === id))
			.filter((node): node is RendererDraggableNode => Boolean(node));
		if (members.length < 2) return;
		const groupId = createRendererId();
		const next = applyMarqueeAction(blocks, {
			type: 'group',
			memberIds: members.map(node => node.id),
			removeGroupIds: blocks
				.filter(node => (
					isRendererSelectionModule(node.module.type)
					&& selectionMemberIds(node).some(id => memberIds.includes(id))
				))
				.map(node => node.id)
		}, groupId);
		if (next === blocks) return;
		this.commands.replaceBlocks(next, [groupId]);
	}

	undo() {
		this.history.undo();
		this.setSelection([...this.selection.ids]);
	}

	redo() {
		this.history.redo();
		this.setSelection([...this.selection.ids]);
	}
}

export { findSelectionGroup, createRendererSelectionNode };
