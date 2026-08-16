import { defineRendererModule } from '../../../catalog';
import {
	localeText,
	moduleIssue,
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

export const TitleModule = defineRendererModule<{
	text: string;
	level: number;
	fontSize: number;
	fontWeight: number;
	lineHeight: number;
	letterSpacing: number;
	color: string;
	align: typeof ALIGNMENTS[number];
}>({
	identity: {
		type: 'title',
		version: 1,
		label: localeText('Title', '标题'),
		category: localeText('Basic', '基础')
	},
	widget: { visible: true },
	data: {
		create: () => ({
			text: 'Section title', level: 2, fontSize: 32, fontWeight: 700,
			lineHeight: 1.3, letterSpacing: 0, color: '', align: 'left'
		}),
		normalize: (value) => {
			const record = toRecord(value);
			return {
				text: toStringValue(record.text),
				level: toLength(record.level, 2),
				fontSize: toLength(record.fontSize, 32),
				fontWeight: toLength(record.fontWeight, 700),
				lineHeight: toLength(record.lineHeight, 1.3),
				letterSpacing: toLength(record.letterSpacing, 0),
				color: toStringValue(record.color),
				align: toEnumValue(record.align, ALIGNMENTS, 'left')
			};
		},
		validate: value => [
			...(value.text.trim() ? [] : [moduleIssue('$.text', 'text.required', '标题不能为空')]),
			...validateNumberRange(value.level, '$.level', { min: 1, max: 6, integer: true }),
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
		draggable: sectionDraggableFrame(360, 64, { minWidth: 80, minHeight: 32 })
	},
	integrations: {
		collectSearchText: props => [{ title: String(props.text || ''), text: '' }]
	}
});
