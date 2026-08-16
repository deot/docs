import { action, copy, heading, paragraph, photo, picture, sortableDocument, sortableNode } from './helpers';
import type { RendererDocument } from '@deot/docs-renderer';

/**
 * 流式画布起步页：对照 Widget 拖入、间距和 JSON 源码。
 * @param lang 当前文档语言。
 * @returns 带起步内容的 sortable 文档。
 */
export const createSortableDemo = (lang: string): RendererDocument => sortableDocument(
	copy(lang, '流式画布', 'Sortable canvas'),
	[
		sortableNode('title', heading(copy(lang, '从这条流开始搭页面', 'Start the page in this flow'), 1, 40), {
			marginBottom: 8
		}),
		sortableNode('text', paragraph(copy(
			lang,
			'Sortable Frame 按上下顺序堆叠模块。左侧 Widget 拖进来的块会出现在当前选区附近，也可以在属性面板改间距和内边距。',
			'Sortable Frame stacks modules top to bottom. Drops land near the selection; spacing lives in the inspector.'
		))),
		sortableNode('text', paragraph(copy(
			lang,
			'下面已经放好一组基础块，方便对照排版。删掉它们，或继续往中间插入 Features、FAQ、广告位。保存会写出 `.page.json`。',
			'A starter set is already on the canvas so you can judge spacing. Delete it, or insert Features, FAQ and ads between the blocks. Save writes `.page.json`.'
		))),
		sortableNode('list', {
			ordered: true,
			items: [
				copy(lang, '从组件库拖入 Title / Text / Image', 'Drop Title / Text / Image from the widget library'),
				copy(lang, '用上下手柄调整顺序，用属性面板改外观', 'Reorder with handles; tune appearance in the inspector'),
				copy(lang, 'Hero 和 CTA 铺满画布、正文 1200；其它模块不铺满、整块 1200 居中', 'Hero and CTA fill the canvas with 1200px content; other modules stay boxed at 1200'),
				copy(lang, '预览、导出 JSON，或在开发模式直接保存', 'Preview, export JSON, or save in development')
			]
		}),
		sortableNode('image', photo(
			picture(copy(lang, '流式画布', 'Sortable'), 1200, 560, '5b6b8c'),
			copy(lang, '流式画布示意：模块自上而下排列', 'Flow canvas: modules stacked from top to bottom'),
			20
		)),
		sortableNode('actions', {
			items: [
				action(copy(lang, '打开落地页', 'Open landing'), `/${lang}/renderer-editor-demos?name=landing`),
				action(copy(lang, '打开基础模块', 'Open shared'), `/${lang}/renderer-editor-demos?name=shared`, 'outline'),
				action(copy(lang, '打开自由画布', 'Open free canvas'), `/${lang}/renderer-editor-demos?name=draggable`, 'outline')
			]
		}),
		sortableNode('space', { height: 64, background: 'transparent' }, { marginBottom: 0 })
	]
);
