import { rotatedBounds } from '../../../frame/draggable/geometry';
import type {
	RendererDraggableNode,
	RendererNode,
	RendererPlacement
} from '../../../types';
import { RENDERER_PAGE_TYPE, RENDERER_SELECTION_TYPE } from '../../../types';

export { RENDERER_SELECTION_TYPE };

export interface RendererSelectionProps {
	members: string[];
}

export interface MarqueeRect {
	left: number;
	top: number;
	right: number;
	bottom: number;
}

/**
 * 判断模块是否为自由布局组合框。
 * @param type 模块 type。
 * @returns 是否为 `selection`。
 */
export const isRendererSelectionModule = (type: string) => type === RENDERER_SELECTION_TYPE;

/**
 * 读取组合框内的成员 ID。非法数据会被丢掉，避免脏文档打断框选。
 * @param node 当前节点。
 * @returns 成员 ID 列表。
 */
export const selectionMemberIds = (node: Pick<RendererNode, 'module'> | undefined): string[] => {
	if (!node || !isRendererSelectionModule(node.module.type)) return [];
	const members = node.module.props.members;
	return Array.isArray(members)
		? [...new Set(members.filter((id): id is string => typeof id === 'string' && Boolean(id)))]
		: [];
};

/**
 * 当前文档里已经被某个组合框收纳的节点 ID。
 * @param blocks 当前文档节点。
 * @returns 成员 ID 集合。
 */
export const groupedMemberIds = (blocks: readonly Pick<RendererNode, 'module'>[]) => {
	const ids = new Set<string>();
	blocks.forEach(node => selectionMemberIds(node).forEach(id => ids.add(id)));
	return ids;
};

/**
 * 查找包含指定节点的组合框。
 * @param blocks 当前文档节点。
 * @param id 成员或组合框自身的 ID。
 * @returns 组合框节点；没有则返回 undefined。
 */
export const findSelectionGroup = <T extends RendererNode>(
	blocks: readonly T[],
	id: string
) => blocks.find(node => node.id === id && isRendererSelectionModule(node.module.type))
	|| blocks.find(node => selectionMemberIds(node).includes(id));

const rectsOverlap = (left: MarqueeRect, right: MarqueeRect) => !(
	left.right < right.left
	|| left.bottom < right.top
	|| right.right < left.left
	|| right.bottom < right.top
);

/**
 * 用成员旋转后的真实外包围盒生成组合框几何信息。
 * @param nodes 组合内的内容节点。
 * @returns 未旋转的包围盒 placement。
 */
export const selectionBoundsPlacement = (
	nodes: readonly RendererDraggableNode[]
): RendererPlacement => {
	const bounds = nodes.map(node => rotatedBounds(node.placement));
	const left = Math.min(...bounds.map(value => value.left));
	const top = Math.min(...bounds.map(value => value.top));
	const right = Math.max(...bounds.map(value => value.right));
	const bottom = Math.max(...bounds.map(value => value.bottom));
	return {
		x: left,
		y: top,
		width: Math.max(1, right - left),
		height: Math.max(1, bottom - top),
		rotate: 0,
		zIndex: Math.max(0, ...nodes.map(node => node.placement.zIndex))
	};
};

/**
 * 构造写入 `blocks` 的组合框节点。成员仍是扁平兄弟节点，组合关系只存在
 * `module.props.members` 里，不引入 `children`。
 * @param id 组合框 ID。
 * @param members 成员 ID。
 * @param placement 包围盒。
 * @param locked 是否锁定。
 * @returns 可写入文档的 draggable 节点。
 */
export const createRendererSelectionNode = (
	id: string,
	members: readonly string[],
	placement: RendererPlacement,
	locked = false
): RendererDraggableNode => ({
	id,
	...(locked ? { locked: true } : {}),
	module: {
		type: RENDERER_SELECTION_TYPE,
		version: 1,
		props: { members: [...members] }
	},
	placement: { ...placement }
});

export type MarqueeAction
	= | { type: 'select'; id: string }
		| { type: 'group'; memberIds: string[]; removeGroupIds: string[] }
		| { type: 'clear' };

/**
 * 按 wya-vm 框选规则决定是选中已有组合、选中单个模块，还是新建组合框。
 * @param blocks 当前自由布局节点。
 * @param rect 画布坐标系中的框选矩形。
 * @returns 框选结束后应执行的动作。
 */
export const resolveMarqueeAction = (
	blocks: readonly RendererDraggableNode[],
	rect: MarqueeRect
): MarqueeAction => {
	const lockedGroupMembers = new Set<string>();
	blocks.forEach((node) => {
		if (node.locked && isRendererSelectionModule(node.module.type)) {
			selectionMemberIds(node).forEach(id => lockedGroupMembers.add(id));
		}
	});
	const hits = blocks.filter((node) => {
		if (node.module.type === RENDERER_PAGE_TYPE) return false;
		if (node.locked) return false;
		if (lockedGroupMembers.has(node.id)) return false;
		const bounds = rotatedBounds(node.placement);
		return rectsOverlap(rect, bounds);
	});
	const groups = hits.filter(node => isRendererSelectionModule(node.module.type));
	const members = hits.filter(node => !isRendererSelectionModule(node.module.type));
	const memberIds = members.map(node => node.id);
	const covering = groups.find((node) => {
		const ids = selectionMemberIds(node);
		return memberIds.length > 0 && memberIds.every(id => ids.includes(id));
	});
	if (covering) return { type: 'select', id: covering.id };
	if (memberIds.length <= 1) {
		const candidates = [...members, ...groups];
		if (!candidates.length) return { type: 'clear' };
		const top = candidates.reduce((current, node) => {
			const currentIndex = blocks.findIndex(item => item.id === current.id);
			const nextIndex = blocks.findIndex(item => item.id === node.id);
			return nextIndex > currentIndex ? node : current;
		});
		return { type: 'select', id: top.id };
	}
	const removeGroupIds = blocks
		.filter(node => (
			isRendererSelectionModule(node.module.type)
			&& selectionMemberIds(node).some(id => memberIds.includes(id))
		))
		.map(node => node.id);
	return { type: 'group', memberIds, removeGroupIds };
};

/**
 * 在现有 blocks 上应用框选动作，返回下一份节点列表。
 * @param blocks 当前自由布局节点。
 * @param action 框选动作。
 * @param groupId 新建组合框时使用的 ID。
 * @returns 下一份 blocks；无需改文档时返回原数组。
 */
export const applyMarqueeAction = (
	blocks: readonly RendererDraggableNode[],
	action: MarqueeAction,
	groupId: string
): RendererDraggableNode[] | readonly RendererDraggableNode[] => {
	if (action.type !== 'group') return blocks;
	const remaining = blocks.filter(node => !action.removeGroupIds.includes(node.id));
	const members = remaining.filter(node => action.memberIds.includes(node.id));
	if (members.length < 2) return blocks;
	return [
		...remaining,
		createRendererSelectionNode(groupId, action.memberIds, selectionBoundsPlacement(members))
	];
};

/**
 * 删除组合框时同时带走成员；拆组则只删除组合框本身。
 * 若删除后某个组合不足两个成员，该组合框也会被清掉。
 * @param blocks 当前节点。
 * @param ids 用户指定删除的 ID。
 * @param withMembers 是否删除组合内的成员。
 * @returns 需要从文档移除的 ID。
 */
export const expandRemovalIds = (
	blocks: readonly RendererNode[],
	ids: readonly string[],
	withMembers = true
) => {
	const removing = new Set(ids);
	if (withMembers) {
		blocks.forEach((node) => {
			if (removing.has(node.id)) {
				selectionMemberIds(node).forEach(id => removing.add(id));
			}
		});
	}
	blocks.forEach((node) => {
		if (!isRendererSelectionModule(node.module.type) || removing.has(node.id)) return;
		const remaining = selectionMemberIds(node).filter(id => !removing.has(id));
		if (remaining.length < 2) removing.add(node.id);
	});
	return [...removing];
};

/**
 * 按 zIndex（相同则按文档顺序）得到可叠放的节点。
 * @param blocks 当前自由布局节点。
 * @returns 从底到顶的节点。
 */
export const stackedDraggableNodes = (blocks: readonly RendererDraggableNode[]) => (
	blocks
		.map((node, index) => ({ node, index }))
		.filter(item => item.node.module.type !== RENDERER_PAGE_TYPE)
		.sort((left, right) => (
			left.node.placement.zIndex - right.node.placement.zIndex
			|| left.index - right.index
		))
		.map(item => item.node)
);

export type LayerDirection = 'top' | 'bottom' | 'up' | 'down';

/**
 * 计算置顶 / 置底 / 上移一层 / 下移一层后的 zIndex。组合框置顶置底时，
 * 成员会跟着一起调整，避免框还在最上层、内容仍被挡住。
 * @param blocks 当前自由布局节点。
 * @param id 目标节点。
 * @param direction 叠放方向。
 * @returns 需要写入的 placement 变更；无需变化时返回空数组。
 */
export const resolveLayerChanges = (
	blocks: readonly RendererDraggableNode[],
	id: string,
	direction: LayerDirection
): Array<{ id: string; before: RendererPlacement; after: RendererPlacement }> => {
	const target = blocks.find(node => node.id === id);
	if (!target) return [];
	const stack = stackedDraggableNodes(blocks);
	const index = stack.findIndex(node => node.id === id);
	if (index < 0) return [];
	const memberIds = selectionMemberIds(target);
	const related = direction === 'up' || direction === 'down'
		? [target]
		: [
				...stack.filter(node => memberIds.includes(node.id)),
				target
			];
	const zValues = stack.map(node => node.placement.zIndex);
	const max = Math.max(0, ...zValues);
	const min = Math.min(0, ...zValues);
	const assign = new Map<string, number>();
	if (direction === 'top') {
		if (index === stack.length - 1 && memberIds.every((memberId) => {
			const memberIndex = stack.findIndex(node => node.id === memberId);
			return memberIndex >= stack.length - 1 - memberIds.length;
		})) return [];
		let next = max + 1;
		related.forEach((node) => {
			assign.set(node.id, next);
			next += 1;
		});
	} else if (direction === 'bottom') {
		if (index === 0 && memberIds.every((memberId) => {
			const memberIndex = stack.findIndex(node => node.id === memberId);
			return memberIndex >= 0 && memberIndex <= memberIds.length;
		})) return [];
		let next = min - 1;
		[...related].reverse().forEach((node) => {
			assign.set(node.id, next);
			next -= 1;
		});
	} else if (direction === 'up') {
		const above = stack[index + 1];
		if (!above) return [];
		assign.set(target.id, above.placement.zIndex);
		assign.set(above.id, target.placement.zIndex);
	} else {
		const below = stack[index - 1];
		if (!below) return [];
		assign.set(target.id, below.placement.zIndex);
		assign.set(below.id, target.placement.zIndex);
	}
	return [...assign].flatMap(([nodeId, zIndex]) => {
		const node = blocks.find(item => item.id === nodeId);
		if (!node || node.placement.zIndex === zIndex) return [];
		return [{ id: nodeId, before: { ...node.placement }, after: { ...node.placement, zIndex } }];
	});
};
