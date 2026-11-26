import type { ImportMap, SandboxProps, StoreState } from '@vue/repl';

export type PlaygroundFiles = Record<string, string>;

export type PlaygroundView = 'runtime' | 'files';

/** runtime / files 预览共用的文件快照。 */
export interface PlaygroundFilesProps {
	/**
	 * 文件名到源码。键是虚拟路径，如 `App.vue`。
	 */
	files: PlaygroundFiles;
	/**
	 * 作为 `@vue/repl` `mainFile` 的入口文件名，必须是 `files` 中的键。
	 */
	entry: string;
}

/** 预览切换条共用的视图状态。 */
export interface PlaygroundViewsProps {
	views: PlaygroundView[];
	/**
	 * 当前预览：运行时沙箱或文件树。
	 */
	activeView: PlaygroundView;
}

/**
 * 预览视口。`auto` 随内容增高；数字表示宽度 px；元组为宽高 px。
 */
export type PlaygroundViewport = 'auto' | number | [width: number, height: number];

/** 预览区内边距。数字为统一像素值，元组依次为垂直、水平像素值。 */
export type PlaygroundPreviewInset = number | [vertical: number, horizontal: number];

/**
 * 预览高度是否可展开。
 * `undefined` 不显示展开控件；`true` 展开到剩余视口；正数为展开目标高度（px）。
 */
export type PlaygroundExpandable = true | number;

/**
 * 左代码、右预览。
 * `true` 使用默认最大高度；正数是整块最大高度（px）。
 */
export type PlaygroundMobile = true | number;

/** 预览底栏可切换的 CSS 变量值。`auto` 表示不写入。 */
export type PlaygroundPreviewVariableValue = 'auto' | (string & {});

/** 带底栏文字的变量值，例如 `{ label: '375', value: '0.5px' }`。 */
export interface PlaygroundPreviewVariableOption {
	/** 底栏显示的文字。 */
	label: string;
	/** 写入预览根的值。`auto` 表示不写入。 */
	value: PlaygroundPreviewVariableValue;
}

/**
 * 预览变量的联动：`source` 生效时，同一节点的 `target` 改写为 `var(source)`。
 * 默认 `[{ source: '--rem', target: '--vc-rem', auto: 'min(calc(100cqw / 750), 0.64px)' }]`。
 */
export interface PlaygroundPreviewVariableLink {
	/** 底栏切换的变量。 */
	source: `--${string}`;
	/** 组件库实际读取的变量。显式选中它时以它为准。 */
	target: `--${string}`;
	/**
	 * local 且 mobile 时，`source` 与 `target` 都没有值（或为 `auto`）时写给 `target` 的值。
	 * local 预览没有自己的视口，`100vw` 是整页宽度，这里通常按预览列的 `cqw` 计算。iframe 不使用。
	 */
	auto?: string;
}

/** `false` 关闭全部联动。 */
export type PlaygroundPreviewVariableLinks = readonly PlaygroundPreviewVariableLink[] | false;

/**
 * 预览根上可切换的 CSS 变量。
 * 只作用在当前预览，不写宿主页面。
 */
export interface PlaygroundPreviewVariable {
	/**
	 * CSS 自定义属性名，必须以 `--` 开头。
	 */
	name: `--${string}`;
	/**
	 * 可切换的值。`auto` 表示移除该变量，交给预览自己的级联。
	 * 写成 `{ label, value }` 时底栏显示 `label`。
	 */
	values: Array<PlaygroundPreviewVariableValue | PlaygroundPreviewVariableOption>;
	/**
	 * 初始值，必须是 `values` 中某项的值。缺省取第一项。
	 */
	default?: PlaygroundPreviewVariableValue;
	/**
	 * 底栏标签。缺省为去掉 `--` 后的变量名。
	 */
	label?: string;
}

export type PlaygroundOptions = Omit<Partial<StoreState>,
	'builtinImportMap' | 'files' | 'activeFilename' | 'mainFile' | 'template'
> & {
	/**
	 * npm CDN 前缀，用于默认 import map 和预览样式。
	 * 例如 `https://cdn.jsdelivr.net/npm` 或 `https://esm.unpkg.com`。
	 * launch 已选定节点时使用 `$docs.runtime.cdn`，否则使用此配置。
	 */
	cdnURL?: string;
	/**
	 * 实例层 import，合并时高于站点默认和管理页覆盖。
	 * `files` / `mainFile` 仍由 playground 自己管理。
	 */
	builtinImportMap?: ImportMap;
};

export type PlaygroundPreviewOptions = SandboxProps['previewOptions'];

/**
 * 是否在 iframe 内用 `@deot/vc` Scroller 替换原生滚动条。
 * 默认关闭；开启后会动态探测 `Scroller`，不存在则回退原生滚动。
 */
export type PlaygroundPreviewScroller = boolean;
