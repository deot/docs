import { action, copy, heading, paragraph, photo, picture, sortableDocument, sortableNode } from './helpers';
import type { RendererDocument } from '@deot/docs-renderer';

/**
 * 基础内容模块：Title / Text / List / Image / Actions / Space。
 * @param lang 当前文档语言。
 * @returns 可对照 shared 模块的 V2 文档。
 */
export const createSharedDemo = (lang: string): RendererDocument => sortableDocument(
	copy(lang, '基础模块', 'Shared modules'),
	[
		sortableNode('title', heading(copy(lang, '基础内容模块', 'Shared content modules'), 1, 40), {
			marginBottom: 8
		}),
		sortableNode('text', paragraph(copy(
			lang,
			'Title、Text、List、Image、Actions 同时支持流式和自由画布。演示里它们显式写成不铺满、整块 1200 居中；实例未写宽度时会跟着容器铺开。',
			'Title, Text, List, Image and Actions work in both flow and free-canvas frames. Demos write boxed 1200 explicitly; unset width follows the container.'
		))),
		sortableNode('title', heading(copy(lang, '标题层级', 'Heading levels'), 2, 28), { marginBottom: 8 }),
		sortableNode('text', paragraph(copy(
			lang,
			'Title 用 `level` 输出 h1–h6，同时可单独改字号、字重、行高和颜色。下面这段是常规正文，行高 1.7，适合连续阅读。',
			'Title emits h1–h6 through `level`, and still accepts font size, weight, line height and color. The paragraph below is body copy at 1.7 for long reading.'
		))),
		sortableNode('text', paragraph(copy(
			lang,
			'同一页里可以连续放多个 Text。需要拉开章节时插入 Space，而不是靠把段落 margin 写死在模块数据里。',
			'Stack several Text blocks on one page. Use Space to separate chapters instead of baking section gaps into the paragraph data.'
		))),
		sortableNode('title', heading(copy(lang, '列表把结构说清楚', 'Lists make structure obvious'), 2, 28), {
			marginBottom: 8
		}),
		sortableNode('list', {
			ordered: true,
			items: [
				copy(lang, 'Title 负责层级标题，不要把整段说明塞进标题', 'Title owns heading levels; do not dump a paragraph into the title'),
				copy(lang, 'Text 负责段落，可连续堆叠', 'Text owns paragraphs and can stack'),
				copy(lang, 'List 负责步骤、清单和并列要点', 'List owns steps, checklists and parallel points'),
				copy(lang, 'Image / Actions 负责视觉和跳转', 'Image / Actions own visuals and navigation')
			]
		}),
		sortableNode('list', {
			ordered: false,
			items: [
				copy(lang, '无序列表适合特性、注意项和资源清单', 'Unordered lists fit features, caveats and resource lists'),
				copy(lang, '图片地址可以是站点相对路径，也可以是外链', 'Image `src` can be a site-relative path or an absolute URL'),
				copy(lang, 'Actions 的 `to` 走 Vue Router，外链会在新窗口打开', 'Action `to` uses Vue Router; external links open in a new tab')
			]
		}),
		sortableNode('title', heading(copy(lang, '图片与操作区', 'Image and actions'), 2, 28), { marginBottom: 8 }),
		sortableNode('image', photo(
			picture(copy(lang, '基础模块', 'Shared'), 1200, 640, '2d8cf0'),
			copy(lang, '基础模块示意：图片在正文流中占满内容宽', 'Shared modules: an image filling the content width'),
			20
		)),
		sortableNode('area', {
			src: picture(copy(lang, '图片热区', 'Hotspots'), 1200, 640, '5b6b8c'),
			alt: copy(lang, '可点击的图片热区', 'Clickable image hotspots'),
			areas: [
				{
					x: 8,
					y: 16,
					width: 28,
					height: 32,
					zIndex: 1,
					to: `/${lang}/renderer-editor-demos?name=landing`,
					label: copy(lang, '落地页', 'Landing')
				},
				{
					x: 62,
					y: 48,
					width: 28,
					height: 32,
					zIndex: 2,
					to: `/${lang}/renderer-editor-demos?name=docs`,
					label: copy(lang, '文档模块', 'Docs')
				}
			]
		}),
		sortableNode('text', paragraph(copy(
			lang,
			'图片支持 `cover` / `contain` / `fill`，以及圆角和暗色主题备用图。操作区可以放主按钮、次按钮和文本按钮，尺寸有 small / medium / large。',
			'Images support `cover` / `contain` / `fill`, radius and a dark-theme fallback. Actions can mix solid, outline and text buttons in small / medium / large.'
		))),
		sortableNode('actions', {
			items: [
				action(copy(lang, '打开落地页', 'Open landing'), `/${lang}/renderer-editor-demos?name=landing`),
				action(copy(lang, '打开文档模块', 'Open docs modules'), `/${lang}/renderer-editor-demos?name=docs`, 'outline'),
				action(copy(lang, '返回目录', 'Back to catalog'), `/${lang}/renderer-editor-demos`, 'outline')
			]
		}),
		sortableNode('space', { height: 72, background: 'transparent' }, { marginBottom: 0 })
	]
);
