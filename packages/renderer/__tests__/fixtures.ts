import type { VueWrapper } from '@vue/test-utils';
import {
	Combo,
	createEmptyRendererDocument
} from '../src';
import type {
	RendererCreateContext,
	RendererDocument,
	RendererDraggableDocument,
	RendererModuleContext,
	RendererSortableDocument
} from '../src';

// 仅用于故意构造非法输入。
export const invalid = <T>(value: unknown) => value as T;

export const comboVm = (wrapper: VueWrapper<InstanceType<typeof Combo>>) => wrapper.vm;

export const htmlElementOf = (
	value: { readonly element: EventTarget | Node | null } | EventTarget | Node | null | undefined
): HTMLElement => {
	const node = value && typeof value === 'object' && 'element' in value
		? value.element
		: value;
	if (!(node instanceof HTMLElement)) throw new TypeError('expected HTMLElement');
	return node;
};

export const closestHTMLElement = (
	value: { readonly element: EventTarget | Node | null } | EventTarget | Node | null | undefined,
	selector: string
): HTMLElement | null => {
	const node = value && typeof value === 'object' && 'element' in value
		? value.element
		: value;
	if (!(node instanceof Element)) return null;
	const found = node.closest(selector);
	return found instanceof HTMLElement ? found : null;
};

export const sortableDocumentOf = (document: RendererDocument): RendererSortableDocument => {
	if (document.layout.mode !== 'sortable') {
		throw new Error(`expected sortable document, got ${document.layout.mode}`);
	}
	return document as RendererSortableDocument;
};

export const draggableDocumentOf = (document: RendererDocument): RendererDraggableDocument => {
	if (document.layout.mode !== 'draggable') {
		throw new Error(`expected draggable document, got ${document.layout.mode}`);
	}
	return document as RendererDraggableDocument;
};

export const createRendererModuleContext = (
	overrides: Partial<RendererModuleContext> = {}
): RendererModuleContext => ({
	scene: 'renderer',
	frameMode: 'sortable',
	readonly: true,
	...overrides
});

export const createRendererCreateContext = (
	overrides: Partial<RendererCreateContext> = {}
): RendererCreateContext => ({
	frameMode: 'sortable',
	index: 0,
	document: createEmptyRendererDocument('sortable'),
	context: createRendererModuleContext(),
	...overrides
});
