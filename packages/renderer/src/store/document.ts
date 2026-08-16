import type { RendererDocument, RendererNode } from '../types';
import { cloneRendererValue } from '../validate';

export const cloneDocument = (value: RendererDocument): RendererDocument => (
	cloneRendererValue(value) as RendererDocument
);

export const findNode = (document: RendererDocument, id: string) => (
	document.blocks.find(node => node.id === id) as RendererNode | undefined
);

export const findNodeIndex = (document: RendererDocument, id: string) => (
	document.blocks.findIndex(node => node.id === id)
);
