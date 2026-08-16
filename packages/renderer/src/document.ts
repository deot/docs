import type { RendererModuleCatalog } from './catalog';
import type {
	RendererDocument,
	RendererDraggableDocument,
	RendererDraggableNode,
	RendererFrameMode,
	RendererIssue,
	RendererLayout,
	RendererModuleContext,
	RendererNode,
	RendererSortableAppearance,
	RendererSortableDocument,
	RendererSortableNode,
	RendererValidationResult
} from './types';
import {
	RENDERER_PAGE_TYPE,
	RENDERER_SELECTION_TYPE,
	RENDERER_SORTABLE_CANVAS_WIDTH
} from './types';
import {
	cloneRendererValue,
	isRendererJsonSafe,
	isRendererRecord,
	normalizeRotation,
	validateRendererDocument
} from './validate';
import { createRendererId } from './utils/id';
import { pickRendererCornerRadii } from './utils/radius';
import { rotatedBounds } from './frame/draggable/geometry';

interface PrepareRendererOptions {
	unknownModuleSeverity?: 'error' | 'warning';
}

/**
 * 创建可以直接交给 Renderer 或 Combo 的空白 V2 文档。
 * @param mode 目标画布模式。
 * @returns 具有模式默认布局的空文档。
 */
export function createEmptyRendererDocument(
	mode?: 'sortable'
): RendererSortableDocument;
export function createEmptyRendererDocument(
	mode: 'draggable'
): RendererDraggableDocument;
export function createEmptyRendererDocument(
	mode: RendererDocument['layout']['mode'] = 'sortable'
): RendererDocument {
	if (mode === 'draggable') {
		return {
			schemaVersion: 2,
			meta: { id: createRendererId(), title: '' },
			layout: {
				mode: 'draggable',
				width: 1200,
				height: 800,
				background: '#ffffff'
			},
			blocks: []
		};
	}
	return {
		schemaVersion: 2,
		meta: { id: createRendererId(), title: '' },
		layout: {
			mode: 'sortable',
			maxWidth: RENDERER_SORTABLE_CANVAS_WIDTH,
			background: '#ffffff'
		},
		blocks: []
	};
}

const DEFAULT_SORTABLE_APPEARANCE: RendererSortableAppearance = {
	marginTop: 0,
	marginBottom: 0,
	paddingTop: 0,
	paddingBottom: 0,
	paddingLeft: 0,
	paddingRight: 0
};

/**
 * 按目标画布模式生成完整 layout，切换时保留背景并映射画布尺寸。
 * @param mode 目标模式。
 * @param source 当前 layout，用于继承背景和尺寸。
 * @returns 目标模式的完整 layout。
 */
export const createRendererLayout = (
	mode: RendererFrameMode,
	source?: RendererLayout
): RendererLayout => {
	const background = source?.background || '#ffffff';
	if (mode === 'sortable') {
		const minHeight = source?.mode === 'sortable' ? source.minHeight || 0 : 0;
		return {
			mode: 'sortable',
			maxWidth: source?.mode === 'sortable'
				? source.maxWidth
				: source?.mode === 'draggable' ? source.width : RENDERER_SORTABLE_CANVAS_WIDTH,
			...(minHeight > 0 ? { minHeight } : {}),
			background
		};
	}
	return {
		mode: 'draggable',
		width: source?.mode === 'draggable'
			? source.width
			: source?.mode === 'sortable' ? source.maxWidth : 1200,
		height: source?.mode === 'draggable'
			? source.height
			: source?.mode === 'sortable' ? Math.max(source.minHeight || 0, 800) : 800,
		background
	};
};

const convertibleDefinition = async (
	node: RendererNode,
	mode: RendererLayout['mode'],
	catalog: RendererModuleCatalog
) => {
	let definition;
	try {
		definition = await catalog.get(node.module.type);
	} catch {
		return null;
	}
	if (!definition?.frames[mode]) return null;
	if (node.module.type === RENDERER_PAGE_TYPE || node.module.type === RENDERER_SELECTION_TYPE) {
		return null;
	}
	return definition;
};

const isSortableDocument = (value: RendererDocument): value is RendererSortableDocument => (
	value.layout.mode === 'sortable'
);
const isDraggableDocument = (value: RendererDocument): value is RendererDraggableDocument => (
	value.layout.mode === 'draggable'
);

/**
 * 把文档转换到另一种画布模式：保留仍支持目标 Frame 的模块，丢掉不兼容节点。
 * sortable 使用默认 appearance；draggable 按 initialPlacement 纵向堆叠。
 * @param document 当前文档。
 * @param layout 目标 layout（必须是完整的 sortable 或 draggable 形状）。
 * @param catalog 模块目录，用于判断 Frame 能力。
 * @returns 转换后的新文档。
 */
export const convertRendererDocumentFrame = async (
	document: RendererDocument,
	layout: RendererLayout,
	catalog: RendererModuleCatalog
): Promise<RendererDocument> => {
	if (layout.mode === 'sortable') {
		if (isSortableDocument(document)) {
			return {
				schemaVersion: document.schemaVersion,
				meta: cloneRendererValue(document.meta),
				layout: cloneRendererValue(layout),
				blocks: cloneRendererValue(document.blocks)
			};
		}
		const blocks: RendererSortableNode[] = [];
		for (const node of document.blocks) {
			if (!await convertibleDefinition(node, layout.mode, catalog)) continue;
			blocks.push({
				id: node.id,
				module: cloneRendererValue(node.module),
				appearance: {
					...DEFAULT_SORTABLE_APPEARANCE,
					...pickRendererCornerRadii(node.placement)
				}
			});
		}
		return {
			schemaVersion: document.schemaVersion,
			meta: cloneRendererValue(document.meta),
			layout: cloneRendererValue(layout),
			blocks
		};
	}
	if (isDraggableDocument(document)) {
		return {
			schemaVersion: document.schemaVersion,
			meta: cloneRendererValue(document.meta),
			layout: cloneRendererValue(layout),
			blocks: cloneRendererValue(document.blocks)
		};
	}
	const blocks: RendererDraggableNode[] = [];
	let nextTop = 40;
	for (const node of document.blocks) {
		const definition = await convertibleDefinition(node, layout.mode, catalog);
		if (!definition) continue;
		const placement = {
			...definition.frames.draggable!.initialPlacement(),
			...pickRendererCornerRadii(node.appearance),
			y: nextTop,
			zIndex: blocks.length + 1
		};
		nextTop += placement.height + 24;
		blocks.push({
			id: node.id,
			module: cloneRendererValue(node.module),
			placement
		});
	}
	return {
		schemaVersion: document.schemaVersion,
		meta: cloneRendererValue(document.meta),
		layout: {
			...layout,
			height: Math.max(layout.height, nextTop + 40)
		},
		blocks
	};
};

const frameCapability = (
	definition: Awaited<ReturnType<RendererModuleCatalog['get']>>,
	mode: RendererDocument['layout']['mode']
) => definition?.frames[mode];

/**
 * 按模块声明的首位、末位规则收敛 sortable 的最终插入位置。
 * 创建和重排共用该函数，避免编辑过程中产生只能在保存时才发现的非法顺序。
 * @param blocks 当前 sortable 节点列表。
 * @param catalog 当前 Combo 的只读模块目录。
 * @param type 待插入或重排的模块类型。
 * @param desiredIndex 指针命中的期望位置。
 * @param excludeId 重排时从边界计算中排除的节点。
 * @returns 满足模块顺序约束的最终位置。
 */
export const resolveSortableInsertionIndex = async (
	blocks: readonly RendererSortableNode[],
	catalog: RendererModuleCatalog,
	type: string,
	desiredIndex: number,
	excludeId?: string
) => {
	const remaining = blocks.filter(node => node.id !== excludeId);
	const definitions = await Promise.all(remaining.map(node => catalog.get(node.module.type)));
	const targetDefinition = await catalog.get(type);
	const insertion = targetDefinition?.frames.sortable?.insertion || 'any';
	if (insertion === 'first') return 0;
	if (insertion === 'last') return remaining.length;

	let minimum = 0;
	let maximum = remaining.length;
	definitions.forEach((definition, index) => {
		const current = definition?.frames.sortable?.insertion || 'any';
		if (current === 'first') minimum = Math.max(minimum, index + 1);
		if (current === 'last') maximum = Math.min(maximum, index);
	});
	return Math.min(Math.max(minimum, desiredIndex), Math.max(minimum, maximum));
};

/**
 * 在文档进入 Store、保存、搜索或资源收集前完成模块版本迁移和属性规范化。
 * 交互中的 pointermove 不调用该函数，避免每帧重新克隆整份文档。
 * @param value 待规范化的未知文档数据。
 * @param catalog 当前实例的只读模块目录。
 * @param context 模块迁移与校验上下文。
 * @param options 未知模块等校验策略。
 * @returns 完成迁移、规范化和模块校验后的结果。
 */
export const prepareRendererDocument = async (
	value: unknown,
	catalog: RendererModuleCatalog,
	context: RendererModuleContext,
	options: PrepareRendererOptions = {}
): Promise<RendererValidationResult> => {
	const structural = validateRendererDocument(value);
	if (!structural.document) return structural;
	const document = cloneRendererValue(structural.document);
	const issues: RendererIssue[] = [...structural.issues];
	const counts = new Map<string, number>();

	for (let index = 0; index < document.blocks.length; index += 1) {
		const node = document.blocks[index];
		const path = `$.blocks[${index}]`;
		let definition;
		try {
			definition = await catalog.get(node.module.type);
		} catch (reason) {
			issues.push({
				path: `${path}.module.type`,
				code: 'module.load',
				message: reason instanceof Error ? reason.message : String(reason),
				severity: 'error',
				nodeId: node.id
			});
			continue;
		}
		if (!definition) {
			issues.push({
				path: `${path}.module.type`,
				code: 'module.unknown',
				message: `未知模块：${node.module.type}`,
				severity: options.unknownModuleSeverity || 'error',
				nodeId: node.id
			});
			continue;
		}
		const capability = frameCapability(definition, document.layout.mode);
		if (!capability) {
			issues.push({
				path: `${path}.module.type`,
				code: 'module.frame',
				message: `模块 ${node.module.type} 不支持 ${document.layout.mode}`,
				severity: 'error',
				nodeId: node.id
			});
			continue;
		}
		const count = (counts.get(node.module.type) || 0) + 1;
		counts.set(node.module.type, count);
		if (capability.maxInstances && count > capability.maxInstances) {
			issues.push({
				path,
				code: 'module.maxInstances',
				message: `模块 ${node.module.type} 最多允许 ${capability.maxInstances} 个实例`,
				severity: 'error',
				nodeId: node.id
			});
		}
		if (document.layout.mode === 'sortable') {
			const insertion = definition.frames.sortable?.insertion || 'any';
			if (insertion === 'first' && index !== 0) {
				issues.push({ path, code: 'module.insertion.first', message: `${node.module.type} 必须位于首位`, severity: 'error', nodeId: node.id });
			}
			if (insertion === 'last' && index !== document.blocks.length - 1) {
				issues.push({ path, code: 'module.insertion.last', message: `${node.module.type} 必须位于末位`, severity: 'error', nodeId: node.id });
			}
		} else if (node.placement) {
			const placement = node.placement;
			placement.rotate = normalizeRotation(placement.rotate);
			const draggable = definition.frames.draggable!;
			const placementPath = `${path}.placement`;
			const sizeRules = [
				['width', 'minWidth', 'minimum'] as const,
				['width', 'maxWidth', 'maximum'] as const,
				['height', 'minHeight', 'minimum'] as const,
				['height', 'maxHeight', 'maximum'] as const
			];
			sizeRules.forEach(([sizeKey, ruleKey, direction]) => {
				const limit = draggable[ruleKey];
				const size = placement[sizeKey];
				const invalid = direction === 'minimum'
					? typeof limit === 'number' && size < limit
					: typeof limit === 'number' && size > limit;
				if (invalid) issues.push({
					path: `${placementPath}.${sizeKey}`,
					code: `module.placement.${ruleKey}`,
					message: `${sizeKey} 不符合模块 ${ruleKey} 约束`,
					severity: 'error',
					nodeId: node.id
				});
			});
			if (
				draggable.aspectRatio
				&& Math.abs(placement.width / placement.height - draggable.aspectRatio) > 0.001
			) {
				issues.push({
					path: placementPath,
					code: 'module.placement.aspectRatio',
					message: `模块宽高比必须为 ${draggable.aspectRatio}`,
					severity: 'error',
					nodeId: node.id
				});
			}
			if (draggable.containment !== 'none' && document.layout.mode === 'draggable') {
				const bounds = rotatedBounds(placement);
				if (
					bounds.left < -0.001
					|| bounds.top < -0.001
					|| bounds.right > document.layout.width + 0.001
					|| bounds.bottom > document.layout.height + 0.001
				) {
					issues.push({
						path: placementPath,
						code: 'module.placement.containment',
						message: '模块旋转后的边界不能超出画布',
						severity: 'error',
						nodeId: node.id
					});
				}
			}
		}

		let props: unknown = node.module.props;
		if (node.module.version > definition.identity.version) {
			issues.push({
				path: `${path}.module.version`,
				code: 'module.version.future',
				message: `不支持模块版本 ${node.module.version}`,
				severity: 'error',
				nodeId: node.id
			});
			continue;
		}
		if (node.module.version < definition.identity.version && !definition.data.migrate) {
			issues.push({
				path: `${path}.module.version`,
				code: 'module.migration.missing',
				message: `模块 ${node.module.type} 缺少迁移能力`,
				severity: 'error',
				nodeId: node.id
			});
			continue;
		}
		try {
			if (node.module.version < definition.identity.version) {
				props = definition.data.migrate!(props, node.module.version, context);
			}
			const normalized = definition.data.normalize
				? definition.data.normalize(props)
				: cloneRendererValue(props);
			if (!isRendererRecord(normalized) || !isRendererJsonSafe(normalized)) {
				issues.push({
					path: `${path}.module.props`,
					code: 'module.normalize.unsafe',
					message: `模块 ${node.module.type} 规范化后必须返回 JSON-safe 对象`,
					severity: 'error',
					nodeId: node.id
				});
				continue;
			}
			node.module.props = normalized;
			node.module.version = definition.identity.version;
			(definition.data.validate?.(normalized) || []).forEach(issue => issues.push({
				...issue,
				path: `${path}.module.props${issue.path === '$' ? '' : issue.path.replace(/^\$/u, '')}`,
				nodeId: node.id
			}));
		} catch (reason) {
			issues.push({
				path: `${path}.module.props`,
				code: 'module.normalize',
				message: reason instanceof Error ? reason.message : String(reason),
				severity: 'error',
				nodeId: node.id
			});
		}
	}

	const valid = !issues.some(issue => issue.severity === 'error');
	return { valid, issues, document };
};
