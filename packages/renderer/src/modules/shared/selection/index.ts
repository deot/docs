import { defineRendererModule } from '../../../catalog';
import { RENDERER_SELECTION_TYPE } from '../../../types';
import { localeText, toArrayValue, toRecord, toStringValue } from '../utils';
import {
	isRendererSelectionModule
} from './group';
import type { RendererSelectionProps } from './group';
import Editor from './editor.vue';
import Viewer from './viewer.vue';

export { RENDERER_SELECTION_TYPE };
export {
	applyMarqueeAction,
	createRendererSelectionNode,
	expandRemovalIds,
	findSelectionGroup,
	groupedMemberIds,
	isRendererSelectionModule,
	resolveLayerChanges,
	resolveMarqueeAction,
	selectionBoundsPlacement,
	selectionMemberIds,
	stackedDraggableNodes
} from './group';
export type {
	LayerDirection,
	MarqueeAction,
	MarqueeRect,
	RendererSelectionProps
} from './group';

/**
 * 发布预览只渲染内容模块：画布 `page` 和组合框都不进入只读画布。
 * @param blocks 当前文档节点。
 * @returns 不含 page / selection 的节点。
 */
export const rendererPublishedBlocks = <T extends { module: { type: string } }>(
	blocks: readonly T[]
) => blocks.filter(node => (
	node.module.type !== 'page' && !isRendererSelectionModule(node.module.type)
));

export const SelectionModule = defineRendererModule<RendererSelectionProps>({
	identity: {
		type: RENDERER_SELECTION_TYPE,
		version: 1,
		label: localeText('Selection', '组合'),
		category: localeText('Basic', '基础')
	},
	widget: { visible: false },
	data: {
		create: () => ({ members: [] }),
		normalize: value => ({
			members: [...new Set(toArrayValue(toRecord(value).members, item => toStringValue(item)).filter(Boolean))]
		}),
		validate: () => []
	},
	viewer: Viewer,
	editor: Editor,
	frames: {
		draggable: {
			widget: { visible: false },
			movable: true,
			resizable: false,
			rotatable: false,
			deletable: true,
			containment: 'none',
			initialPlacement: () => ({ x: 0, y: 0, width: 1, height: 1, rotate: 0, zIndex: 1 })
		}
	}
});
