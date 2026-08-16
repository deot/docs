import { defineRendererModule } from '../../../catalog';
import { RENDERER_PAGE_TYPE, RENDERER_SORTABLE_CANVAS_WIDTH } from '../../../types';
import type { RendererLayout, RendererNode } from '../../../types';
import {
	localeText,
	toEnumValue,
	toLength,
	toRecord,
	toStringValue,
	validateNumberRange
} from '../utils';
import Editor from './editor.vue';
import Viewer from './viewer.vue';

export { RENDERER_PAGE_TYPE };

/**
 * 判断模块是否为默认画布模块。
 * @param type 模块 type。
 * @returns 是否为 `page`。
 */
export const isRendererPageModule = (type: string) => type === RENDERER_PAGE_TYPE;

/**
 * 内容模块列表，排除默认画布 `page`，避免它出现在排序流或缩略图里。
 * @param blocks 当前文档节点。
 * @returns 不含 page 的节点。
 */
export const rendererContentBlocks = <T extends { module: { type: string } }>(
	blocks: readonly T[]
) => blocks.filter(node => !isRendererPageModule(node.module.type));

const EMPTY_APPEARANCE = {
	marginTop: 0,
	marginBottom: 0,
	paddingTop: 0,
	paddingBottom: 0,
	paddingLeft: 0,
	paddingRight: 0
};

/**
 * 构造属性面板使用的虚拟 page 节点。画布属性仍写在 `document.layout`。
 * @param layout 当前文档 layout。
 * @returns 与当前 Frame 形态匹配的虚拟节点。
 */
export const createRendererPageNode = (layout: RendererLayout): RendererNode => {
	const module = {
		type: RENDERER_PAGE_TYPE,
		version: 1,
		props: { ...layout }
	};
	if (layout.mode === 'sortable') {
		return { id: RENDERER_PAGE_TYPE, module, appearance: { ...EMPTY_APPEARANCE } };
	}
	return {
		id: RENDERER_PAGE_TYPE,
		module,
		placement: {
			x: 0,
			y: 0,
			width: layout.width,
			height: layout.height,
			rotate: 0,
			zIndex: 0
		}
	};
};

const toLayout = (value: unknown): RendererLayout => {
	const record = toRecord(value);
	const background = toStringValue(record.background, '#ffffff');
	if (toEnumValue(record.mode, ['sortable', 'draggable'] as const, 'sortable') === 'draggable') {
		return {
			mode: 'draggable',
			width: toLength(record.width, 1200),
			height: toLength(record.height, 800),
			background
		};
	}
	const minHeight = toLength(record.minHeight, 0);
	return {
		mode: 'sortable',
		maxWidth: toLength(record.maxWidth, toLength(record.width, RENDERER_SORTABLE_CANVAS_WIDTH)),
		...(minHeight > 0 ? { minHeight } : {}),
		background
	};
};

export const PageModule = defineRendererModule<RendererLayout>({
	identity: {
		type: RENDERER_PAGE_TYPE,
		version: 1,
		label: localeText('Page', '页面'),
		category: localeText('Basic', '基础')
	},
	widget: { visible: false },
	data: {
		create: context => toLayout(context.document.layout),
		normalize: toLayout,
		validate: (value) => {
			if (value.mode === 'sortable') {
				return [
					...validateNumberRange(value.maxWidth, '$.maxWidth', { min: 320, max: 3840 }),
					...validateNumberRange(value.minHeight || 0, '$.minHeight', { min: 0, max: 2000 })
				];
			}
			return [
				...validateNumberRange(value.width, '$.width', { min: 320, max: 3840 }),
				...validateNumberRange(value.height, '$.height', { min: 320, max: 3840 })
			];
		}
	},
	viewer: Viewer,
	editor: Editor,
	frames: {
		sortable: {
			maxInstances: 1,
			insertion: 'first',
			movable: false,
			deletable: false,
			widget: { visible: false }
		},
		draggable: {
			maxInstances: 1,
			movable: false,
			resizable: true,
			rotatable: false,
			deletable: false,
			handles: ['e', 's', 'se'],
			containment: 'none',
			widget: { visible: false },
			initialPlacement: () => ({ x: 0, y: 0, width: 1200, height: 800, rotate: 0, zIndex: 0 })
		}
	}
});
