import { defineRendererModule } from '../../../catalog';
import {
	localeText,
	moduleIssue,
	normalizeActionValues,
	toEnumValue,
	toRecord,
	toStringValue,
	validateActionValues,
	validateEnum
} from '../../shared/utils';
import type { RendererActionValue } from '../../shared/utils';
import { sectionDraggableFrame, sectionSortableFrame } from '../../shared/canvas-frame';
import Editor from './editor.vue';
import Viewer from './viewer.vue';

const ALIGNMENTS = ['left', 'center'] as const;

export const CtaModule = defineRendererModule<{
	eyebrow: string;
	title: string;
	description: string;
	actions: RendererActionValue[];
	align: typeof ALIGNMENTS[number];
	accent: string;
	accentSecondary: string;
	background: string;
}>({
	identity: {
		type: 'cta',
		version: 1,
		label: localeText('Call to action', '行动条'),
		category: localeText('Page', '页面')
	},
	widget: { visible: true },
	data: {
		create: () => ({
			eyebrow: 'Next',
			title: 'Start building',
			description: 'Use the same modules for home, guides and API pages.',
			actions: [],
			align: 'center',
			accent: '#873bf4',
			accentSecondary: '#2d8cf0',
			background: ''
		}),
		normalize: (value) => {
			const record = toRecord(value);
			return {
				eyebrow: toStringValue(record.eyebrow),
				title: toStringValue(record.title),
				description: toStringValue(record.description),
				actions: normalizeActionValues(record.actions),
				align: toEnumValue(record.align, ALIGNMENTS, 'center'),
				accent: toStringValue(record.accent),
				accentSecondary: toStringValue(record.accentSecondary),
				background: toStringValue(record.background)
			};
		},
		validate: value => [
			...(value.title.trim()
				? []
				: [moduleIssue('$.title', 'title.required', '行动条标题不能为空')]),
			...validateEnum(value.align, '$.align', ALIGNMENTS),
			...validateActionValues(value.actions, '$.actions')
		]
	},
	viewer: Viewer,
	editor: Editor,
	frames: {
		sortable: sectionSortableFrame({ fullWidth: true }),
		draggable: sectionDraggableFrame(720, 220)
	},
	integrations: {
		collectSearchText: props => [{
			title: String(props.title || ''),
			text: [props.eyebrow, props.description].filter(Boolean).join(' ')
		}]
	}
});
