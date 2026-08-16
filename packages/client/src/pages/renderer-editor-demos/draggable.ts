import { action, copy, heading, paragraph, photo, picture, draggableDocument, draggableNode } from './helpers';
import type { RendererDocument } from '@deot/docs-renderer';

/**
 * 自由画布：Title / Text / Image / Actions / Ads 带坐标。
 * @param lang 当前文档语言。
 * @returns 可对照标尺与图层的 draggable 文档。
 */
export const createDraggableDemo = (lang: string): RendererDocument => draggableDocument(
	copy(lang, '自由画布', 'Free canvas'),
	[
		draggableNode('title', heading(copy(lang, '自由布局', 'Free layout'), 1, 40), {
			x: 64, y: 48, width: 520, height: 72, zIndex: 3
		}),
		draggableNode('text', paragraph(copy(
			lang,
			'标尺、缩放、吸附和右键菜单都挂在 Draggable Frame 上。按住画布空白处平移，滚轮缩放，选中后四角拉伸。',
			'Rulers, zoom, snapping and the context menu live on Draggable Frame. Pan on empty canvas, wheel to zoom, drag corners to resize.'
		), 16), { x: 64, y: 132, width: 400, height: 120, zIndex: 3 }),
		draggableNode('text', paragraph(copy(
			lang,
			'右侧大图是独立图层。广告位叠在左下，操作区浮在文字下方。可以用组合框把标题和正文收成一组。',
			'The large image on the right is its own layer. Ads sit bottom-left; actions float under the copy. Group the title and body with a selection box.'
		), 15), { x: 64, y: 268, width: 400, height: 110, zIndex: 3 }),
		draggableNode('image', photo(
			picture(copy(lang, '自由画布', 'Canvas'), 900, 640, 'f5a623'),
			copy(lang, '自由画布主视觉', 'Free-canvas hero image'),
			20
		), { x: 500, y: 48, width: 640, height: 360, zIndex: 1 }),
		draggableNode('actions', {
			items: [
				action(copy(lang, '打开组合框', 'Open selection'), `/${lang}/renderer-editor-demos?name=selection`),
				action(copy(lang, '打开流式画布', 'Open flow canvas'), `/${lang}/renderer-editor-demos?name=sortable`, 'outline')
			]
		}, { x: 64, y: 400, width: 360, height: 56, zIndex: 4 }),
		draggableNode('list', {
			ordered: false,
			items: [
				copy(lang, '对齐时看标尺和辅助线', 'Use rulers and guides when aligning'),
				copy(lang, '图层顺序看 zIndex，右键可置顶或置底', 'zIndex owns stacking; the menu can raise or lower a node'),
				copy(lang, '旋转和缩放以当前锚点为准', 'Rotate and zoom around the current anchor')
			]
		}, { x: 64, y: 480, width: 400, height: 160, zIndex: 3 }),
		draggableNode('ads', {
			layout: 'tile',
			style: 'card',
			columns: 1,
			gap: 8,
			height: 180,
			speed: 4,
			items: [
				{
					src: picture(copy(lang, '画布赞助', 'Sponsor'), 720, 360, 'ed6a0c'),
					href: 'https://example.com',
					title: copy(lang, '画布赞助位', 'Canvas sponsor'),
					alt: copy(lang, '画布赞助位', 'Canvas sponsor')
				}
			]
		}, { x: 500, y: 440, width: 300, height: 200, zIndex: 2 }),
		draggableNode('image', photo(
			picture(copy(lang, '参考图', 'Reference'), 640, 400, '873bf4'),
			copy(lang, '第二张参考图', 'Second reference image'),
			16
		), { x: 828, y: 440, width: 312, height: 200, zIndex: 2 }),
		draggableNode('title', heading(copy(lang, '再放一组说明', 'Another note'), 3, 22), {
			x: 64, y: 680, width: 320, height: 48, zIndex: 3
		}),
		draggableNode('text', paragraph(copy(
			lang,
			'自由画布适合海报、活动页和需要叠层的封面。长文还是回到 Sortable，避免靠坐标硬排段落。',
			'Use the free canvas for posters, campaigns and layered covers. Keep long articles on Sortable instead of placing paragraphs by hand.'
		), 15), { x: 64, y: 740, width: 480, height: 100, zIndex: 3 })
	],
	{ width: 1280, height: 1100 }
);
