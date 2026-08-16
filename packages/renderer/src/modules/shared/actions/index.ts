import { defineRendererModule } from '../../../catalog';
import {
	localeText,
	normalizeActionValues,
	toRecord,
	validateActionValues
} from '../utils';
import type { RendererActionValue } from '../utils';
import { sectionDraggableFrame, sectionSortableFrame } from '../canvas-frame';
import Editor from './editor.vue';
import Viewer from './viewer.vue';

export const ActionsModule = defineRendererModule<{ items: RendererActionValue[] }>({
	identity: {
		type: 'actions',
		version: 1,
		label: localeText('Actions', '操作区'),
		category: localeText('Content', '内容')
	},
	widget: { visible: true },
	data: {
		create: () => ({
			items: [{
				label: 'Get started',
				to: '/',
				variant: 'solid' as const,
				size: 'medium' as const,
				color: '',
				textColor: ''
			}]
		}),
		normalize: value => ({ items: normalizeActionValues(toRecord(value).items) }),
		validate: value => validateActionValues(value.items)
	},
	viewer: Viewer,
	editor: Editor,
	frames: {
		sortable: sectionSortableFrame(),
		draggable: sectionDraggableFrame(260, 52, { minWidth: 80, minHeight: 36 })
	}
});
