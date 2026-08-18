import {
	createEmptyRendererDocument,
	createRendererId,
	RENDERER_SORTABLE_CONTENT_WIDTH
} from '@deot/docs-renderer';
import type {
	RendererDraggableDocument,
	RendererDraggableNode,
	RendererPlacement,
	RendererSortableAppearance,
	RendererSortableDocument,
	RendererSortableNode
} from '@deot/docs-renderer';

export const isZh = (lang: string) => lang.toLowerCase().startsWith('zh');

export const copy = (lang: string, zh: string, en: string) => (isZh(lang) ? zh : en);

/**
 * 演示占位图。尺寸、底色、字色和文案都可调。
 * @param text 图上的文字。
 * @param width 宽度。
 * @param height 高度。
 * @param background 背景色，可带 `#`。
 * @param foreground 文字色，可带 `#`。
 * @returns 可直接赋给 `image.src` 或广告 `src` 的 dummyimage 地址。
 */
export const picture = (
	text: string,
	width = 1152,
	height = 648,
	background = '456cf6',
	foreground = 'fff'
) => {
	const bg = background.replace('#', '');
	const fg = foreground.replace('#', '');
	return `https://dummyimage.com/${width}x${height}/${bg}/${fg}/?text=${encodeURIComponent(text)}`;
};

/**
 * 组装按钮数据。
 * @param label 按钮文案。
 * @param to 跳转地址。
 * @param variant 按钮样式。
 * @returns Actions / Hero / CTA 可用的一项。
 */
export const action = (
	label: string,
	to = '/',
	variant: 'solid' | 'outline' = 'solid'
) => ({
	label,
	to,
	variant,
	size: 'medium' as const,
	color: '',
	textColor: ''
});

/**
 * 组装 Title 模块默认字段。
 * @param text 标题。
 * @param level 标题级别。
 * @param fontSize 字号。
 * @returns Title 模块 props。
 */
export const heading = (text: string, level = 2, fontSize = 32) => ({
	text,
	level,
	fontSize,
	fontWeight: 700,
	lineHeight: 1.3,
	letterSpacing: 0,
	color: '',
	align: 'left' as const
});

/**
 * 组装 Text 模块默认字段。
 * @param text 段落。
 * @param fontSize 字号。
 * @returns Text 模块 props。
 */
export const paragraph = (text: string, fontSize = 16) => ({
	text,
	fontSize,
	fontWeight: 400,
	lineHeight: 1.7,
	letterSpacing: 0,
	color: '',
	align: 'left' as const
});

/**
 * 组装 Image 模块默认字段。
 * @param src 图片地址。
 * @param alt 替代文本。
 * @param radius 圆角。
 * @returns Image 模块 props。
 */
export const photo = (src: string, alt: string, radius = 16) => ({
	src,
	dark: '',
	alt,
	fit: 'cover' as const,
	borderRadius: radius,
	eager: false
});

/**
 * 通栏：外框拉满画布，正文收在内容宽。Hero / CTA / 落地分段 / 广告条用这个。
 * 演示必须显式写 `maxWidth`；渲染时未设或 `0` 会跟着容器铺开，不会回退 1200。
 * @param extra 覆盖默认 appearance 的字段。
 * @returns 带 fullWidth 和默认内容宽的 appearance 片段。
 */
export const band = (
	extra: Partial<RendererSortableAppearance> = {}
): Partial<RendererSortableAppearance> => ({
	fullWidth: true,
	maxWidth: RENDERER_SORTABLE_CONTENT_WIDTH,
	...extra
});

export const appearance = (
	extra: Partial<RendererSortableAppearance> = {}
): RendererSortableAppearance => ({
	marginTop: 0,
	marginBottom: 24,
	paddingTop: 0,
	paddingBottom: 0,
	paddingLeft: 0,
	paddingRight: 0,
	fullWidth: false,
	maxWidth: RENDERER_SORTABLE_CONTENT_WIDTH,
	...extra
});

export const sortableNode = (
	type: string,
	props: Record<string, unknown>,
	extra: Partial<RendererSortableAppearance> = {}
): RendererSortableNode => ({
	id: createRendererId(),
	module: { type, version: 1, props },
	appearance: appearance(extra)
});

export const draggableNode = (
	type: string,
	props: Record<string, unknown>,
	placement: Pick<RendererPlacement, 'x' | 'y' | 'width' | 'height'> & Partial<RendererPlacement>
): RendererDraggableNode => ({
	id: createRendererId(),
	module: { type, version: 1, props },
	placement: {
		rotate: 0,
		zIndex: 1,
		...placement
	}
});

export const sortableDocument = (
	title: string,
	blocks: RendererSortableNode[],
	layout: Partial<Omit<RendererSortableDocument['layout'], 'mode'>> = {}
): RendererSortableDocument => {
	const document = createEmptyRendererDocument('sortable');
	document.meta.title = title;
	document.layout = {
		...document.layout,
		minHeight: 720,
		...layout
	};
	document.blocks = blocks;
	return document;
};

export const draggableDocument = (
	title: string,
	blocks: RendererDraggableNode[],
	layout: Partial<Omit<RendererDraggableDocument['layout'], 'mode'>> = {}
): RendererDraggableDocument => {
	const document = createEmptyRendererDocument('draggable');
	document.meta.title = title;
	document.layout = {
		...document.layout,
		width: 1200,
		height: 900,
		...layout
	};
	document.blocks = blocks;
	return document;
};
