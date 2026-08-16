import { defineRendererModule } from '../../../catalog';
import {
	localeText,
	toEnumValue,
	toLength,
	toRecord,
	toStringValue,
	validateEnum,
	validateNumberRange
} from '../utils';
import { sectionDraggableFrame, sectionSortableFrame } from '../canvas-frame';
import Editor from './editor.vue';
import Viewer from './viewer.vue';

const ALIGNMENTS = ['left', 'center', 'right'] as const;

export const TextModule = defineRendererModule<{
	text: string;
	fontSize: number;
	fontWeight: number;
	lineHeight: number;
	letterSpacing: number;
	color: string;
	background: string;
	align: typeof ALIGNMENTS[number];
}>({
	identity: {
		type: 'text',
		version: 1,
		label: localeText('Text', '文本'),
		category: localeText('Basic', '基础')
	},
	widget: { visible: true },
	data: {
		create: () => ({
			text: 'Write something…', fontSize: 16, fontWeight: 400,
			lineHeight: 1.7, letterSpacing: 0, color: '', background: '', align: 'left'
		}),
		normalize: (value) => {
			const record = toRecord(value);
			return {
				text: toStringValue(record.text),
				fontSize: toLength(record.fontSize, 16),
				fontWeight: toLength(record.fontWeight, 400),
				lineHeight: toLength(record.lineHeight, 1.7),
				letterSpacing: toLength(record.letterSpacing, 0),
				color: toStringValue(record.color),
				background: toStringValue(record.background),
				align: toEnumValue(record.align, ALIGNMENTS, 'left')
			};
		},
		validate: value => [
			...validateNumberRange(value.fontSize, '$.fontSize', { min: 8, max: 160 }),
			...validateNumberRange(value.fontWeight, '$.fontWeight', { min: 100, max: 900 }),
			...validateNumberRange(value.lineHeight, '$.lineHeight', { min: 0.5, max: 3 }),
			...validateNumberRange(value.letterSpacing, '$.letterSpacing', { min: -10, max: 30 }),
			...validateEnum(value.align, '$.align', ALIGNMENTS)
		]
	},
	viewer: Viewer,
	editor: Editor,
	frames: {
		sortable: sectionSortableFrame(),
		draggable: sectionDraggableFrame(280, 80, { minWidth: 60, minHeight: 24 })
	},
	integrations: {
		collectSearchText: props => [{ text: String(props.text || '') }]
	}
});
