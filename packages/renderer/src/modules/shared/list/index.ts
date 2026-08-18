import { defineRendererModule } from '../../../catalog';
import {
	localeText,
	moduleIssue,
	toArrayValue,
	toBooleanValue,
	toRecord,
	toStringValue
} from '../utils';
import { sectionDraggableFrame, sectionSortableFrame } from '../canvas-frame';
import Editor from './editor.vue';
import Viewer from './viewer.vue';

export const ListModule = defineRendererModule<{ ordered: boolean; items: string[] }>({
	identity: {
		type: 'list',
		version: 1,
		label: localeText('List', '列表'),
		category: localeText('Content', '内容')
	},
	widget: { visible: true },
	data: {
		create: () => ({ ordered: false, items: ['List item'] }),
		normalize: (value) => {
			const record = toRecord(value);
			return {
				ordered: toBooleanValue(record.ordered),
				items: toArrayValue(record.items, item => toStringValue(item))
			};
		},
		validate: value => value.items.length
			? []
			: [moduleIssue('$.items', 'items.min', '列表至少需要一项')]
	},
	viewer: Viewer,
	editor: Editor,
	frames: {
		sortable: sectionSortableFrame(),
		draggable: sectionDraggableFrame(360, 180)
	},
	integrations: {
		collectSearchText: (props) => {
			const record = toRecord(props);
			return [{ text: Array.isArray(record.items) ? record.items.join(' ') : '' }];
		}
	}
});
