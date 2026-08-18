import type {
	RendererDocument,
	RendererDocumentMeta,
	RendererDraggableNode,
	RendererLayout,
	RendererNode
} from '../types';
import { RENDERER_SCHEMA_VERSION } from '../types';
import { cloneRendererValue } from '../validate';

/**
 * Store 内部可写文档。`blocks` 使用节点联合，避免对判别联合做 splice
 * 时落入交叉类型。对外仍通过 `RendererStore.document` 暴露 `RendererDocument`。
 */
export interface WritableRendererDocument {
	/**
	 * 协议版本，必须与 `RENDERER_SCHEMA_VERSION` 一致。
	 */
	schemaVersion: typeof RENDERER_SCHEMA_VERSION;
	meta: RendererDocumentMeta;
	layout: RendererLayout;
	/**
	 * 可写节点列表。对外 `RendererStore.document.blocks` 仍是判别联合。
	 */
	blocks: RendererNode[];
}

export const cloneDocument = (
	value: RendererDocument | WritableRendererDocument
): WritableRendererDocument => cloneRendererValue(value);

export const findNode = (
	document: Pick<WritableRendererDocument, 'blocks'>,
	id: string
) => document.blocks.find(node => node.id === id);

export const findNodeIndex = (
	document: Pick<WritableRendererDocument, 'blocks'>,
	id: string
) => document.blocks.findIndex(node => node.id === id);

export const isDraggableNode = (node: RendererNode): node is RendererDraggableNode => (
	Boolean(node.placement)
);
