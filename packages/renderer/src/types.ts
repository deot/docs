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
	/**
	 * 文档创建时间，Unix 毫秒。
	 */
	createdAt?: number;
	/**
	 * 文档最近一次保存时间，Unix 毫秒。
	 */
	updatedAt?: number;
}

export interface RendererSortableLayout {
	mode: 'sortable';
	/**
	 * 排序画布宽度。Combo 用它作为画板像素宽；发布页仍随实际容器铺开。
	 */
	maxWidth: number;
	/**
	 * 画布最小高度。省略或 `0` 表示随内容增高。
	 */
	minHeight?: number;
	/**
	 * 画布背景，任意 CSS 颜色或渐变。
	 */
	background: string;
}

export interface RendererDraggableLayout {
	mode: 'draggable';
	width: number;
	height: number;
	/**
	 * 画布背景，任意 CSS 颜色或渐变。
	 */
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
	/**
	 * 按实际容器铺满。未写时回退到模块 `frames.sortable.fullWidth`。
	 */
	fullWidth?: boolean;
	/**
	 * 内容最大宽度。`0` 与未填写等价，都不限制，正文跟着容器铺开。
	 */
	maxWidth?: number;
}

export interface RendererPlacement extends RendererCornerRadii {
	x: number;
	y: number;
	width: number;
	height: number;
	/**
	 * 顺时针旋转角，单位度。
	 */
	rotate: number;
	zIndex: number;
}

export interface RendererModuleValue<Props = Record<string, unknown>> {
	/**
	 * 模块目录中的 type，与 `identity.type` 对齐。
	 */
	type: string;
	/**
	 * 模块数据版本。与当前定义不一致时走 `data.migrate`。
	 */
	version: number;
	props: Props;
}

export interface RendererBaseNode<Props = Record<string, unknown>> {
	id: string;
	module: RendererModuleValue<Props>;
	/**
	 * 锁定后不可拖拽，对应 wya-vm 的 `disabled`。
	 */
	locked?: boolean;
}

export interface RendererSortableNode<Props = Record<string, unknown>> extends RendererBaseNode<Props> {
	appearance: RendererSortableAppearance;
	/**
	 * 排序节点不得带自由布局坐标。
	 */
	placement?: never;
	/**
	 * V2 扁平协议不使用嵌套 children。
	 */
	children?: never;
}

export interface RendererDraggableNode<Props = Record<string, unknown>> extends RendererBaseNode<Props> {
	placement: RendererPlacement;
	/**
	 * 自由布局节点不得带排序外观。
	 */
	appearance?: never;
	/**
	 * V2 扁平协议不使用嵌套 children。
	 */
	children?: never;
}

export type RendererNode<Props = Record<string, unknown>>
	= | RendererSortableNode<Props>
		| RendererDraggableNode<Props>;

export interface RendererSortableDocument {
	/**
	 * 协议版本，必须与 `RENDERER_SCHEMA_VERSION` 一致。
	 */
	schemaVersion: typeof RENDERER_SCHEMA_VERSION;
	meta: RendererDocumentMeta;
	layout: RendererSortableLayout;
	blocks: RendererSortableNode[];
}

export interface RendererDraggableDocument {
	/**
	 * 协议版本，必须与 `RENDERER_SCHEMA_VERSION` 一致。
	 */
	schemaVersion: typeof RENDERER_SCHEMA_VERSION;
	meta: RendererDocumentMeta;
	layout: RendererDraggableLayout;
	blocks: RendererDraggableNode[];
}

export type RendererDocument = RendererSortableDocument | RendererDraggableDocument;

export interface RendererServices {
	/**
	 * 把模块里的资源地址转成可请求 URL。`importer` 是当前文档逻辑地址。
	 */
	resolveAsset?: (source: string, importer?: string) => string | Promise<string>;
	/**
	 * 把模块声明的跳转目标转成站内路径或外链。
	 */
	resolveLink?: (target: string) => string;
	/**
	 * 实际执行跳转。缺省时由壳层按 `resolveLink` 结果导航。
	 */
	navigate?: (target: string) => void | Promise<void>;
	upload?: (file: File) => string | Promise<string>;
}

export interface RendererContext {
	lang?: string;
	locale?: Language;
	theme?: 'light' | 'dark';
	/**
	 * 宿主传入的当前路由快照，Renderer 本身不依赖 Vue Router 类型。
	 */
	route?: unknown;
	/**
	 * 当前文档的逻辑资源地址，供 `resolveAsset` 解析相对路径。
	 */
	source?: string;
	services?: RendererServices;
	/**
	 * 宿主自由附加的上下文，模块不得依赖未约定键。
	 */
	extra?: Record<string, unknown>;
}

export interface RendererModuleContext extends RendererContext {
	/**
	 * 只读 Renderer 或可编辑 Combo。同一模块可据此切换交互。
	 */
	scene: RendererScene;
	frameMode: RendererFrameMode;
	/**
	 * Combo 预览态为 true，禁止写入文档。
	 */
	readonly: boolean;
}

export interface RendererIssue {
	/**
	 * JSON Pointer，如 `$.blocks[0].module.props.title`。
	 */
	path: string;
	/**
	 * 稳定错误码，如 `value.enum`，供测试与 i18n 对照。
	 */
	code: string;
	message: string;
	severity: 'error' | 'warning';
	nodeId?: string;
}

export interface RendererValidationResult {
	valid: boolean;
	issues: RendererIssue[];
	/**
	 * 规范化后的文档。结构非法、无法继续解析时缺省。
	 */
	document?: RendererDocument;
}

export interface RendererResourceReference {
	/**
	 * Gateway 资源类型，如 `markdown`、`style`。
	 */
	type: string;
	/**
	 * 逻辑资源地址。
	 */
	source: string;
}

export interface RendererSearchFragment {
	title?: string;
	text: string;
	/**
	 * 可滚动定位的标题锚点，不含 `#`。
	 */
	anchor?: string;
}

export interface RendererNodeDraft<Props extends object = object> {
	props?: Partial<Props> & Record<string, unknown>;
	appearance?: Partial<RendererSortableAppearance>;
	placement?: Partial<RendererPlacement>;
}

export interface RendererCreateContext {
	frameMode: RendererFrameMode;
	/**
	 * 组件库选中的预设 key。未走预设时缺省。
	 */
	presetKey?: string;
	/**
	 * 新节点将插入的 `blocks` 下标。
	 */
	index: number;
	document: Readonly<RendererDocument>;
	context: RendererContext;
}

export interface RendererWidgetPreset<Props extends object = object> {
	/**
	 * 预设稳定键，同一模块内不可重复。
	 */
	key: string;
	label: RendererLocaleText;
	/**
	 * 组件库缩略图。组件实例或图片 URL。
	 */
	preview?: Component | string;
	create?: (context: RendererCreateContext) => RendererNodeDraft<Props>;
}

export interface RendererWidgetDefinition<Props extends object = object> {
	/**
	 * 是否出现在组件库。`page` / `selection` 等内置模块为 false。
	 */
	visible?: boolean;
	component?: Component;
	presets?: RendererWidgetPreset<Props>[];
}

export interface RendererSortableCapability<Props extends object = object> {
	maxInstances?: number;
	/**
	 * 新节点允许插入的位置：任意、必须首位或必须末位。
	 */
	insertion?: 'any' | 'first' | 'last';
	movable?: boolean;
	deletable?: boolean;
	/**
	 * 新建节点时默认铺满实际容器。实例可用 `appearance.fullWidth` 覆盖。
	 */
	fullWidth?: boolean;
	/**
	 * 未铺满时新建节点的默认内容宽。铺满模块默认不写，除非实例自己设定。
	 */
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
	/**
	 * 固定宽高比 `width / height`。省略则自由拉伸。
	 */
	aspectRatio?: number;
	movable?: boolean;
	resizable?: boolean;
	rotatable?: boolean;
	deletable?: boolean;
	widget?: RendererWidgetDefinition<Props>;
	create?: (context: RendererCreateContext) => RendererNodeDraft<Props>;
	handles?: RendererResizeHandle[];
	/**
	 * `canvas` 时旋转后的包围盒不得超出画布；`none` 不限制。
	 */
	containment?: 'canvas' | 'none';
	viewer?: Component;
	editor?: Component;
}

export interface RendererModuleDefinition<Props extends object = object> {
	identity: {
		/**
		 * 协议 type，写入 `module.type`。
		 */
		type: string;
		/**
		 * 当前数据 schema 版本，写入 `module.version`。
		 */
		version: number;
		label: RendererLocaleText;
		category: RendererLocaleText;
	};
	widget: RendererWidgetDefinition<Props>;
	data: {
		/**
		 * 新建节点时的默认 props。
		 */
		create(context: RendererCreateContext): Props;
		normalize?(value: unknown): Props;
		validate?(value: Props): RendererIssue[];
		/**
		 * 把旧 `module.version` 的数据升到当前 identity.version。
		 */
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
		/**
		 * 从 props 收集需要 Gateway 预取的资源。
		 */
		collectResources?(props: unknown): RendererResourceReference[];
		collectSearchText?(props: unknown): RendererSearchFragment[];
	};
}

export interface RendererLazyModuleSource {
	type: string;
	/**
	 * 首次用到该 type 时再加载定义，避免把全部模块打进首包。
	 */
	load: () => Promise<RendererModuleDefinition | { default: RendererModuleDefinition }>;
}

export type RendererModuleSource = RendererModuleDefinition | RendererLazyModuleSource;

export interface RendererModuleViewerProps {
	node: Readonly<RendererNode>;
	context: Readonly<RendererModuleContext>;
}

export interface RendererModuleEditorProps {
	node: Readonly<RendererNode>;
	/**
	 * 当前模块可编辑的 props 快照，不是整篇文档。
	 */
	modelValue: Readonly<Record<string, unknown>>;
	context: Readonly<RendererModuleContext>;
}

export interface RendererArrayEditorOptions<T = unknown> {
	/**
	 * 列表项稳定 key。缺省时用下标，重排会抖动。
	 */
	itemKey?: keyof T | ((item: T, index: number) => string);
	createItem: () => T;
	min?: number;
	max?: number;
	deletable?: boolean;
	reorderable?: boolean;
}
