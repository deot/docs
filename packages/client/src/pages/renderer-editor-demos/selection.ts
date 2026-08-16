import { createRendererId } from '@deot/docs-renderer';
import type { RendererDocument } from '@deot/docs-renderer';
import { action, copy, heading, paragraph, photo, picture, draggableDocument, draggableNode } from './helpers';

/**
 * 预置组合框，对照多选、解组与图层。
 * @param lang 当前文档语言。
 * @returns 带 selection 节点的自由布局文档。
 */
export const createSelectionDemo = (lang: string): RendererDocument => {
	const title = draggableNode('title', heading(copy(lang, '已组合的标题', 'Grouped title'), 2, 30), {
		x: 80, y: 80, width: 320, height: 56, zIndex: 2
	});
	const text = draggableNode('text', paragraph(copy(
		lang,
		'这两个节点被第一个 selection 收纳。拖动组合框会一起移动；解组后恢复成独立图层。',
		'These two nodes sit in the first selection. Dragging the group moves them together; ungrouping restores separate layers.'
	), 15), { x: 80, y: 152, width: 340, height: 100, zIndex: 2 });
	const actions = draggableNode('actions', {
		items: [
			action(copy(lang, '打开自由画布', 'Open free canvas'), `/${lang}/renderer-editor-demos?name=draggable`),
			action(copy(lang, '返回目录', 'Back to catalog'), `/${lang}/renderer-editor-demos`, 'outline')
		]
	}, { x: 80, y: 268, width: 340, height: 52, zIndex: 3 });
	const image = draggableNode('image', photo(
		picture(copy(lang, '未编组', 'Ungrouped'), 800, 560, '13c2c2'),
		copy(lang, '未编组图片，可单独框选', 'Ungrouped image; select it on its own'),
		16
	), { x: 500, y: 80, width: 360, height: 240, zIndex: 1 });
	const noteTitle = draggableNode('title', heading(copy(lang, '第二组：说明与清单', 'Second group: note and list'), 3, 22), {
		x: 80, y: 400, width: 360, height: 48, zIndex: 2
	});
	const note = draggableNode('text', paragraph(copy(
		lang,
		'框选多个块后，右键可以建立新的组合。组合框本身也是一个模块，数据里只存 member ids。',
		'After multi-select, the context menu can create another group. The selection node is a module that only stores member ids.'
	), 15), { x: 80, y: 460, width: 360, height: 110, zIndex: 2 });
	const list = draggableNode('list', {
		ordered: false,
		items: [
			copy(lang, '点组合框选中整组', 'Click the box to select the whole group'),
			copy(lang, '点空白处取消选择', 'Click empty canvas to clear the selection'),
			copy(lang, '解组不会删除成员', 'Ungrouping does not delete members')
		]
	}, { x: 80, y: 588, width: 360, height: 140, zIndex: 2 });
	const side = draggableNode('text', paragraph(copy(
		lang,
		'右侧图片没有进组，方便对照：编组块一起移动，未编组块留在原地。',
		'The image on the right stays ungrouped so you can compare: grouped nodes move together, the image stays put.'
	), 15), { x: 500, y: 360, width: 360, height: 110, zIndex: 2 });
	const group = {
		id: createRendererId(),
		module: {
			type: 'selection',
			version: 1,
			props: { members: [title.id, text.id, actions.id] }
		},
		placement: { x: 64, y: 64, width: 376, height: 272, rotate: 0, zIndex: 5 }
	};
	const second = {
		id: createRendererId(),
		module: {
			type: 'selection',
			version: 1,
			props: { members: [noteTitle.id, note.id, list.id] }
		},
		placement: { x: 64, y: 384, width: 396, height: 360, rotate: 0, zIndex: 5 }
	};
	return draggableDocument(
		copy(lang, '组合框', 'Selection group'),
		[title, text, actions, image, noteTitle, note, list, side, group, second],
		{ width: 1280, height: 1000 }
	);
};
