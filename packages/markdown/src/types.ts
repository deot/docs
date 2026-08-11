export interface MarkdownIndicatorOptions {
	/** 是否允许按住指示器拖动浏览文档，默认开启。 */
	draggable?: boolean;

	/** 指示器高度，数字按 px 处理，也支持任意 CSS 长度。 */
	height?: number | string;

	/** 是否在悬停时展示文档块摘要，默认开启。 */
	preview?: boolean;

	/** 指示器所在侧，默认位于正文右侧。 */
	position?: 'left' | 'right';

	/** 指示器相对滚动容器顶部的距离，数字按 px 处理。 */
	top?: number | string;
}

export type MarkdownIndicatorConfig = boolean | MarkdownIndicatorOptions;
