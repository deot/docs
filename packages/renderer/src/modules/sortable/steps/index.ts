import { defineRendererModule } from '../../../catalog';
import {
	localeText,
	moduleIssue,
	SECTION_ALIGNMENTS,
	toArrayValue,
	toEnumValue,
	toLength,
	toRecord,
	toStringValue,
	validateEnum,
	validateNumberRange
} from '../../shared/utils';
import { sectionDraggableFrame, sectionSortableFrame } from '../../shared/canvas-frame';
import { featureAccentOf } from '../features/palette';
import Editor from './editor.vue';
import Viewer from './viewer.vue';

export interface RendererStepItem {
	title: string;
	description: string;
	icon: string;
	accent: string;
}

const createItems = (): RendererStepItem[] => [
	{ title: 'Write', description: 'Compose the page with reusable modules.', icon: '1', accent: featureAccentOf(0) },
	{ title: 'Preview', description: 'See live updates while you edit.', icon: '2', accent: featureAccentOf(1) },
	{ title: 'Ship', description: 'Deploy a static workspace anywhere.', icon: '3', accent: featureAccentOf(2) }
];

const normalizeItem = (item: unknown, index: number): RendererStepItem => {
	const current = toRecord(item);
	return {
		title: toStringValue(current.title),
		description: toStringValue(current.description),
		icon: toStringValue(current.icon),
		accent: toStringValue(current.accent, featureAccentOf(index))
	};
};

export const StepsModule = defineRendererModule<{
	eyebrow: string;
	title: string;
	description: string;
	align: typeof SECTION_ALIGNMENTS[number];
	columns: number;
	accent: string;
	items: RendererStepItem[];
}>({
	identity: {
		type: 'steps',
		version: 1,
		label: localeText('Steps', '步骤'),
		category: localeText('Page', '页面')
	},
	widget: { visible: true },
	data: {
		create: () => ({
			eyebrow: 'Start',
			title: 'How it works',
			description: 'A short path from a blank page to a published site.',
			align: 'center',
			columns: 1,
			accent: '',
			items: createItems()
		}),
		normalize: (value) => {
			const record = toRecord(value);
			return {
				eyebrow: toStringValue(record.eyebrow),
				title: toStringValue(record.title),
				description: toStringValue(record.description),
				align: toEnumValue(record.align, SECTION_ALIGNMENTS, 'center'),
				columns: toLength(record.columns, 3),
				accent: toStringValue(record.accent),
				items: toArrayValue(record.items, normalizeItem)
			};
		},
		validate: value => [
			...validateEnum(value.align, '$.align', SECTION_ALIGNMENTS),
			...validateNumberRange(value.columns, '$.columns', { min: 1, max: 6, integer: true }),
			...(value.items.length
				? []
				: [moduleIssue('$.items', 'items.min', '步骤至少需要一项')]),
			...value.items.flatMap((item, index) => item.title.trim()
				? []
				: [moduleIssue(`$.items[${index}].title`, 'title.required', '步骤标题不能为空')])
		]
	},
	viewer: Viewer,
	editor: Editor,
	frames: {
		sortable: sectionSortableFrame(),
		draggable: sectionDraggableFrame(720, 400)
	},
	integrations: {
		collectSearchText: (props) => {
			const section = {
				title: String(props.title || ''),
				text: [props.eyebrow, props.description].filter(Boolean).join(' ')
			};
			const items = (Array.isArray(props.items) ? props.items : []).map((item) => {
				const current = toRecord(item);
				return {
					title: String(current.title || ''),
					text: String(current.description || '')
				};
			});
			return section.title || section.text ? [section, ...items] : items;
		}
	}
});
