import type { Component } from 'vue';
import type { Language } from '@deot/docs-locale';

export const RENDERER_SCHEMA_VERSION = 2 as const;
export const RENDERER_MAX_NODES = 500;
export const RENDERER_MAX_VALUE_DEPTH = 20;
/** 排序画布默认宽度。 */
export const RENDERER_SORTABLE_CANVAS_WIDTH = 1920;
/** 排序模块默认内容最大宽度。 */
export const RENDERER_SORTABLE_CONTENT_WIDTH = 1200;
/** 默认画布模块，对应 wya-vm 的 `page`，不进入组件库。 */
export const RENDERER_PAGE_TYPE = 'page';
/** 自由布局组合框，对应 wya-vm 的 `@wya/vm/selection`，不进入组件库。 */
export const RENDERER_SELECTION_TYPE = 'selection';

export type RendererFrameMode = 'sortable' | 'draggable';
export type RendererScene = 'renderer' | 'combo';
export type RendererFit = 'none' | 'width' | 'contain';
export type RendererLocaleText = string | Record<string, string>;

export interface RendererDocumentMeta {
	id: string;
	title?: string;
	description?: string;
	createdAt?: number;
	updatedAt?: number;
}

export interface RendererSortableLayout {
	mode: 'sortable';
	/**
	 * 排序画布宽度。Combo 用它作为画板像素宽；发布页仍随实际容器铺开。
	 */
	maxWidth: number;
	/** 画布最小高度。省略或 `0` 表示随内容增高。 */
	minHeight?: number;
	background: string;
}

export interface RendererDraggableLayout {
	mode: 'draggable';
	width: number;
	height: number;
	background: string;
}

export type RendererLayout = RendererSortableLayout | RendererDraggableLayout;

/** 模块圆角。未设置独立四角时使用 `borderRadius`。 */
export interface RendererCornerRadii {
	borderRadius?: number;
	borderRadiusTopLeft?: number;
	borderRadiusTopRight?: number;
	borderRadiusBottomRight?: number;
	borderRadiusBottomLeft?: number;
}

export interface RendererSortableAppearance extends RendererCornerRadii {
	marginTop: number;
	marginBottom: number;
	paddingTop: number;
	paddingBottom: number;
	paddingLeft?: number;
	paddingRight?: number;
	/** 按实际容器铺满。未写时回退到模块 `frames.sortable.fullWidth`。 */
	fullWidth?: boolean;
	/** 内容最大宽度。`0` 与未填写等价，都不限制，正文跟着容器铺开。 */
	maxWidth?: number;
}

export interface RendererPlacement extends RendererCornerRadii {
	x: number;
	y: number;
	width: number;
	height: number;
	rotate: number;
	zIndex: number;
}

export interface RendererModuleValue<Props = Record<string, unknown>> {
	type: string;
	version: number;
	props: Props;
}

export interface RendererBaseNode<Props = Record<string, unknown>> {
	id: string;
	module: RendererModuleValue<Props>;
	/** 锁定后不可拖拽，对应 wya-vm 的 `disabled`。 */
	locked?: boolean;
}

export interface RendererSortableNode<Props = Record<string, unknown>> extends RendererBaseNode<Props> {
	appearance: RendererSortableAppearance;
	placement?: never;
	children?: never;
}

export interface RendererDraggableNode<Props = Record<string, unknown>> extends RendererBaseNode<Props> {
	placement: RendererPlacement;
	appearance?: never;
	children?: never;
}

export type RendererNode<Props = Record<string, unknown>>
	= | RendererSortableNode<Props>
		| RendererDraggableNode<Props>;

export interface RendererSortableDocument {
	schemaVersion: typeof RENDERER_SCHEMA_VERSION;
	meta: RendererDocumentMeta;
	layout: RendererSortableLayout;
	blocks: RendererSortableNode[];
}

export interface RendererDraggableDocument {
	schemaVersion: typeof RENDERER_SCHEMA_VERSION;
	meta: RendererDocumentMeta;
	layout: RendererDraggableLayout;
	blocks: RendererDraggableNode[];
}

export type RendererDocument = RendererSortableDocument | RendererDraggableDocument;

export interface RendererServices {
	resolveAsset?: (source: string, importer?: string) => string | Promise<string>;
	resolveLink?: (target: string) => string;
	navigate?: (target: string) => void | Promise<void>;
	upload?: (file: File) => string | Promise<string>;
}

export interface RendererContext {
	lang?: string;
	locale?: Language;
	theme?: 'light' | 'dark';
	route?: unknown;
	source?: string;
	services?: RendererServices;
	extra?: Record<string, unknown>;
}

export interface RendererModuleContext extends RendererContext {
	scene: RendererScene;
	frameMode: RendererFrameMode;
	readonly: boolean;
}

export interface RendererIssue {
	path: string;
	code: string;
	message: string;
	severity: 'error' | 'warning';
	nodeId?: string;
}

export interface RendererValidationResult {
	valid: boolean;
	issues: RendererIssue[];
	document?: RendererDocument;
}

export interface RendererResourceReference {
	type: string;
	source: string;
}

export interface RendererSearchFragment {
	title?: string;
	text: string;
	anchor?: string;
}

export interface RendererNodeDraft<Props extends object = object> {
	props?: Partial<Props> & Record<string, unknown>;
	appearance?: Partial<RendererSortableAppearance>;
	placement?: Partial<RendererPlacement>;
}

export interface RendererCreateContext {
	frameMode: RendererFrameMode;
	presetKey?: string;
	index: number;
	document: Readonly<RendererDocument>;
	context: RendererContext;
}

export interface RendererWidgetPreset<Props extends object = object> {
	key: string;
	label: RendererLocaleText;
	preview?: Component | string;
	create?: (context: RendererCreateContext) => RendererNodeDraft<Props>;
}

export interface RendererWidgetDefinition<Props extends object = object> {
	visible?: boolean;
	component?: Component;
	presets?: RendererWidgetPreset<Props>[];
}

export interface RendererSortableCapability<Props extends object = object> {
	maxInstances?: number;
	insertion?: 'any' | 'first' | 'last';
	movable?: boolean;
	deletable?: boolean;
	/** 新建节点时默认铺满实际容器。实例可用 `appearance.fullWidth` 覆盖。 */
	fullWidth?: boolean;
	/** 未铺满时新建节点的默认内容宽。铺满模块默认不写，除非实例自己设定。 */
	maxWidth?: number;
	widget?: RendererWidgetDefinition<Props>;
	create?: (context: RendererCreateContext) => RendererNodeDraft<Props>;
	viewer?: Component;
	editor?: Component;
}

export type RendererResizeHandle = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';

export interface RendererDraggableCapability<Props extends object = object> {
	initialPlacement: () => RendererPlacement;
	maxInstances?: number;
	minWidth?: number;
	minHeight?: number;
	maxWidth?: number;
	maxHeight?: number;
	aspectRatio?: number;
	movable?: boolean;
	resizable?: boolean;
	rotatable?: boolean;
	deletable?: boolean;
	widget?: RendererWidgetDefinition<Props>;
	create?: (context: RendererCreateContext) => RendererNodeDraft<Props>;
	handles?: RendererResizeHandle[];
	containment?: 'canvas' | 'none';
	viewer?: Component;
	editor?: Component;
}

export interface RendererModuleDefinition<Props extends object = object> {
	identity: {
		type: string;
		version: number;
		label: RendererLocaleText;
		category: RendererLocaleText;
	};
	widget: RendererWidgetDefinition<Props>;
	data: {
		create(context: RendererCreateContext): Props;
		normalize?(value: unknown): Props;
		validate?(value: Props): RendererIssue[];
		migrate?(
			value: unknown,
			fromVersion: number,
			context: RendererModuleContext
		): Props;
	};
	viewer: Component;
	editor: Component;
	frames: {
		sortable?: RendererSortableCapability<Props>;
		draggable?: RendererDraggableCapability<Props>;
	};
	integrations?: {
		collectResources?(props: Props): RendererResourceReference[];
		collectSearchText?(props: Props): RendererSearchFragment[];
	};
}

export interface RendererLazyModuleSource {
	type: string;
	load: () => Promise<RendererModuleDefinition | { default: RendererModuleDefinition }>;
}

export type RendererModuleSource = RendererModuleDefinition | RendererLazyModuleSource;

export interface RendererModuleViewerProps {
	node: Readonly<RendererNode>;
	context: Readonly<RendererModuleContext>;
}

export interface RendererModuleEditorProps {
	node: Readonly<RendererNode>;
	modelValue: Readonly<Record<string, unknown>>;
	context: Readonly<RendererModuleContext>;
}

export interface RendererArrayEditorOptions<T = unknown> {
	itemKey?: keyof T | ((item: T, index: number) => string);
	createItem: () => T;
	min?: number;
	max?: number;
	deletable?: boolean;
	reorderable?: boolean;
}
