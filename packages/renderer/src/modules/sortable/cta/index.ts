import { defineRendererModule } from '../../../catalog';
import {
	SECTION_ALIGNMENTS,
	localeText,
	moduleIssue,
	normalizeActionValues,
	normalizeSectionHeader,
	toRecord,
	toStringValue,
	validateActionValues,
	validateEnum
} from '../../shared/utils';
import type { RendererActionValue, RendererSectionHeader } from '../../shared/utils';
import { sectionDraggableFrame, sectionSortableFrame } from '../../shared/canvas-frame';
import Editor from './editor.vue';
import Viewer from './viewer.vue';

export const CtaModule = defineRendererModule<RendererSectionHeader & {
	actions: RendererActionValue[];
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
				...normalizeSectionHeader(record, 'center'),
				actions: normalizeActionValues(record.actions),
				accent: toStringValue(record.accent),
				accentSecondary: toStringValue(record.accentSecondary),
				background: toStringValue(record.background)
			};
		},
		validate: value => [
			...(value.title.trim()
				? []
				: [moduleIssue('$.title', 'title.required', '行动条标题不能为空')]),
			...validateEnum(value.align, '$.align', SECTION_ALIGNMENTS),
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
		collectSearchText: (props) => {
			const record = toRecord(props);
			return [{
				title: String(record.title || ''),
				text: [record.eyebrow, record.description].filter(Boolean).join(' ')
			}];
		}
	}
});
