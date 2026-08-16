import { defineRendererModule } from '../../../catalog';
import {
	localeText,
	toLength,
	toRecord,
	toStringValue,
	validateNumberRange
} from '../../shared/utils';
import Editor from './editor.vue';
import Viewer from './viewer.vue';
import { sectionSortableFrame } from '../../shared/canvas-frame';

export const SpaceModule = defineRendererModule<{
	height: number;
	background: string;
}>({
	identity: {
		type: 'space',
		version: 1,
		label: localeText('Space', '留白'),
		category: localeText('Basic', '基础')
	},
	widget: { visible: true },
	data: {
		create: () => ({ height: 24, background: 'transparent' }),
		normalize: (value) => {
			const record = toRecord(value);
			return {
				height: toLength(record.height, 24),
				background: toStringValue(record.background, 'transparent')
			};
		},
		validate: value => validateNumberRange(value.height, '$.height', { min: 1, max: 480 })
	},
	viewer: Viewer,
	editor: Editor,
	frames: {
		sortable: sectionSortableFrame()
	}
});
