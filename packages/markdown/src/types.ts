import type {
	PlaygroundExpandable,
	PlaygroundFiles,
	PlaygroundOptions,
	PlaygroundPreviewInset,
	PlaygroundPreviewOptions,
	PlaygroundPreviewScroller,
	PlaygroundView,
	PlaygroundViewport
} from '@deot/docs-playground';

/**
 * `::: playground` 的 JSON5 配置，字段对齐 playground 组件 props。
 * 运行时校验留在 markdown.ts，避免静态导入 playground 实现破坏懒加载。
 * @see packages/playground/src/playground.vue
 */
export interface MarkdownPlaygroundConfig {
	/**
	 * 多文件模式下的入口文件名，对应 playground `entry`。
	 */
	entry?: string;
	/**
	 * 运行时顶栏标题，对应 playground `title`。
	 */
	title?: string;
	/**
	 * 标题锚点 id，对应 playground `id`；未传时由 title 按 markdown heading 规则生成。
	 */
	id?: string;
	views?: PlaygroundView[];
	viewport?: PlaygroundViewport;
	/**
	 * 视口切换菜单的候选项。只有一项时不显示菜单。
	 */
	viewportOptions?: PlaygroundViewport[];
	/**
	 * 只渲染无工具栏的运行时预览。
	 */
	styleless?: boolean;
	options?: PlaygroundOptions;
	previewInset?: PlaygroundPreviewInset;
	/**
	 * 预览是否可展开。未传不显示控件；`true` 展开到剩余视口；正数为目标高度 px。
	 */
	expandable?: PlaygroundExpandable;
	/**
	 * 是否在 iframe 内用 `@deot/vc` Scroller 替换原生滚动条。默认关闭。
	 */
	previewScroller?: PlaygroundPreviewScroller;
	previewOptions?: PlaygroundPreviewOptions;
}

interface MarkdownPlaygroundFilesMount {
	files: PlaygroundFiles;
	/**
	 * 入口文件名。缺省时由 playground 自行挑选。
	 */
	entry?: string;
}

interface MarkdownPlaygroundModelMount {
	/**
	 * 单文件模板字符串，内部会转成 `files`。
	 */
	modelValue?: string;
}

export type MarkdownPlaygroundMountProps
	= MarkdownPlaygroundFilesMount | MarkdownPlaygroundModelMount;

export interface MarkdownIndicatorOptions {
	/**
	 * 是否允许按住指示器拖动浏览文档，默认开启。
	 * 关闭后仍可点击轨道按比例定位，只是不再跟手拖动。
	 */
	draggable?: boolean;

	/**
	 * 指示器高度，数字按 px 处理，也支持任意 CSS 长度。
	 * 未配置时按正文与滚动容器可视高度封顶（与大纲一致）；数字配置也不会超过该封顶。
	 * 小地图为固定高度条，不再内部滚动。
	 */
	height?: number | string;

	/**
	 * 是否在悬停时展示文档块摘要，默认开启。
	 */
	preview?: boolean;

	/**
	 * 指示器所在侧，默认位于正文左侧。
	 */
	position?: 'left' | 'right';

	/**
	 * 相对滚动容器顶部的 sticky 偏移，数字按 px 处理，默认贴顶。
	 */
	top?: number | string;
}

export type MarkdownIndicatorConfig = boolean | MarkdownIndicatorOptions;

/**
 * Markdown 排版皮肤。与站点 light/dark（`data-doc-theme`）正交。
 */
export type MarkdownTheme = 'default' | 'traditional';
