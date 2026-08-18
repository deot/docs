import type { RouteLocationNormalizedGeneric } from 'vue-router';
import { createEmptyRendererDocument } from '@deot/docs-renderer';
import type { RendererCreateContext } from '@deot/docs-renderer';
import type { DocsConfig, DocsRuntime, ResourceIdentity } from '../../src/types';
import type { ResourceContentRecord } from '../../src/modules/gateway';

// 仅用于故意构造非法输入。
export const invalid = <T>(value: unknown) => value as T;

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

export const createDocsRuntime = (overrides: Partial<DocsRuntime> = {}): DocsRuntime => ({
	mode: 'development',
	...overrides
});

export const createDocsConfig = (overrides: Partial<DocsConfig> = {}): DocsConfig => ({
	locales: { 'zh-CN': { label: '简体中文' } },
	routes: {},
	...overrides
});

export const createRouteShape = (
	path: string,
	params: RouteLocationNormalizedGeneric['params'] = {}
): RouteLocationNormalizedGeneric => ({
	path,
	name: undefined,
	params,
	query: {},
	hash: '',
	fullPath: path,
	matched: [],
	meta: {},
	redirectedFrom: undefined
});

export const createContentRecord = (
	overrides: Partial<ResourceContentRecord> = {}
): ResourceContentRecord => ({
	identity: overrides.identity || {
		namespace: 'docs',
		lang: 'zh-CN',
		type: 'page',
		source: './index.page.json'
	} satisfies ResourceIdentity,
	url: '/',
	status: 'success',
	requestStatus: 'success',
	requestStatusUpdatedAt: 0,
	statusHistory: [],
	contentHistoryId: null,
	contentHistoryIndex: null,
	content: '',
	hash: 'hash',
	updatedAt: 0,
	checkedAt: 0,
	accessedAt: 0,
	...overrides
});

export const createRendererCreateContext = (
	overrides: Partial<RendererCreateContext> = {}
): RendererCreateContext => ({
	frameMode: 'sortable',
	index: 0,
	document: createEmptyRendererDocument('sortable'),
	context: {},
	...overrides
});
