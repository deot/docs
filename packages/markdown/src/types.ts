import type {
	PlaygroundFiles,
	PlaygroundOptions,
	PlaygroundPreviewOptions,
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
	 */
	draggable?: boolean;

	/**
	 * 指示器高度，数字按 px 处理，也支持任意 CSS 长度。
	 */
	height?: number | string;

	/**
	 * 是否在悬停时展示文档块摘要，默认开启。
	 */
	preview?: boolean;

	/**
	 * 指示器所在侧，默认位于正文右侧。
	 */
	position?: 'left' | 'right';

	/**
	 * 指示器相对滚动容器垂直中心的偏移，数字按 px 处理，默认居中。
	 */
	top?: number | string;
}

export type MarkdownIndicatorConfig = boolean | MarkdownIndicatorOptions;
