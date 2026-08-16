import type { MarkdownIndicatorConfig, MarkdownIndicatorOptions } from '@deot/docs-markdown';
import type { RendererIssue } from '@deot/docs-renderer';

export interface DocsMarkdownOptions {
	/** 文档指示器。`false` 关闭；`true` 或对象开启，对象可配位置、预览等。 */
	indicator?: MarkdownIndicatorConfig;
	/** 预留给后续 Markdown 渲染选项。 */
	[key: string]: unknown;
}

export interface DocsMarkdownProps {
	/** 站点相对路径或 http(s) 地址。无内联 `content` 时拉取后按 Markdown 解析。 */
	source: string;
	/** 内联 Markdown 文本。只要是字符串就优先于 `source`。 */
	content?: string;
	/** 渲染配置。未知字段原样保留，便于后续扩展。 */
	options?: DocsMarkdownOptions;
}

const INDICATOR_POSITIONS = new Set(['left', 'right']);

const isPlainObject = (value: unknown): value is Record<string, unknown> => (
	Boolean(value) && typeof value === 'object' && !Array.isArray(value)
);

/**
 * 规范化指示器配置。非法值丢弃，合法对象只保留已知字段。
 * @param value 原始 indicator。
 * @returns 可供 Markdown 组件使用的配置。
 */
export const normalizeDocsMarkdownIndicator = (
	value: unknown
): MarkdownIndicatorConfig | undefined => {
	if (value === true || value === false) return value;
	if (!isPlainObject(value)) return undefined;
	const options: MarkdownIndicatorOptions = {};
	if (typeof value.preview === 'boolean') options.preview = value.preview;
	if (typeof value.draggable === 'boolean') options.draggable = value.draggable;
	if (typeof value.position === 'string' && INDICATOR_POSITIONS.has(value.position)) {
		options.position = value.position as MarkdownIndicatorOptions['position'];
	}
	if (typeof value.top === 'number' || typeof value.top === 'string') options.top = value.top;
	if (typeof value.height === 'number' || typeof value.height === 'string') {
		options.height = value.height;
	}
	return options;
};

/**
 * 规范化 Markdown 模块的 options。指示器走专用校验，其余字段原样保留。
 * @param value 原始 options。
 * @returns 可写入模块 props 的 options。
 */
export const normalizeDocsMarkdownOptions = (value: unknown): DocsMarkdownOptions | undefined => {
	if (!isPlainObject(value)) return undefined;
	const options: DocsMarkdownOptions = { ...value };
	if ('indicator' in options) {
		const indicator = normalizeDocsMarkdownIndicator(options.indicator);
		if (typeof indicator === 'undefined') delete options.indicator;
		else options.indicator = indicator;
	}
	return Object.keys(options).length ? options : undefined;
};

/**
 * 规范化 Markdown 模块 props。
 * @param value 原始模块数据。
 * @returns source / content / options。
 */
export const normalizeDocsMarkdownProps = (value: unknown): DocsMarkdownProps => {
	const record = isPlainObject(value) ? value : {};
	const props: DocsMarkdownProps = {
		source: typeof record.source === 'string' ? record.source : ''
	};
	if (typeof record.content === 'string') props.content = record.content;
	const options = normalizeDocsMarkdownOptions(record.options);
	if (options) props.options = options;
	return props;
};

/**
 * 校验 Markdown 模块至少有可解析的正文来源。
 * @param value 规范化后的 props。
 * @returns 问题列表。
 */
export const validateDocsMarkdownProps = (value: DocsMarkdownProps): RendererIssue[] => {
	if (value.source.trim() || typeof value.content === 'string') return [];
	return [{
		path: '$.source',
		code: 'source.required',
		message: 'Markdown source 或 content 至少需要一项',
		severity: 'error'
	}];
};

/**
 * 读取指示器配置；未写时默认开启。
 * @param options 模块 options。
 * @returns Markdown 组件的 indicator。
 */
export const docsMarkdownIndicator = (options?: DocsMarkdownOptions): MarkdownIndicatorConfig => {
	if (!options || typeof options.indicator === 'undefined') return true;
	return options.indicator;
};

/**
 * 内联正文优先；否则按 source 走资源加载（相对路径或 http(s)）。
 * @param props 模块 props。
 * @returns 内联文本；需要拉取 source 时为 `undefined`。
 */
export const docsMarkdownInlineContent = (props: Pick<DocsMarkdownProps, 'content'>) => (
	typeof props.content === 'string' ? props.content : undefined
);
