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
import { featureAccentOf } from './palette';
import Editor from './editor.vue';
import Viewer from './viewer.vue';

export interface RendererFeatureItem {
	title: string;
	description: string;
	badge: string;
	icon: string;
	accent: string;
}

const createItems = (): RendererFeatureItem[] => [
	{ title: 'Feature 1', description: 'Describe this capability.', badge: 'Core', icon: 'star', accent: featureAccentOf(0) },
	{ title: 'Feature 2', description: 'Describe this capability.', badge: 'Flow', icon: 'setting', accent: featureAccentOf(1) },
	{ title: 'Feature 3', description: 'Describe this capability.', badge: 'Ops', icon: 'mark', accent: featureAccentOf(2) }
];

const normalizeItem = (item: unknown, index: number): RendererFeatureItem => {
	const current = toRecord(item);
	return {
		title: toStringValue(current.title),
		description: toStringValue(current.description),
		badge: toStringValue(current.badge),
		icon: toStringValue(current.icon),
		accent: toStringValue(current.accent, featureAccentOf(index))
	};
};

export const FeaturesModule = defineRendererModule<{
	eyebrow: string;
	title: string;
	description: string;
	align: typeof SECTION_ALIGNMENTS[number];
	columns: number;
	gap: number;
	accent: string;
	items: RendererFeatureItem[];
}>({
	identity: {
		type: 'features',
		version: 1,
		label: localeText('Features', '特性'),
		category: localeText('Page', '页面')
	},
	widget: {
		visible: true
	},
	data: {
		create: () => ({
			eyebrow: 'Features',
			title: 'What you get',
			description: 'A concise set of capabilities for this page.',
			align: 'center',
			columns: 3,
			gap: 20,
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
				gap: toLength(record.gap, 20),
				accent: toStringValue(record.accent),
				items: toArrayValue(record.items, normalizeItem)
			};
		},
		validate: value => [
			...validateEnum(value.align, '$.align', SECTION_ALIGNMENTS),
			...validateNumberRange(value.columns, '$.columns', { min: 1, max: 6, integer: true }),
			...validateNumberRange(value.gap, '$.gap', { min: 0, max: 120 }),
			...(value.items.length
				? []
				: [moduleIssue('$.items', 'items.min', '特性卡片至少需要一项')]),
			...value.items.flatMap((item, index) => item.title.trim()
				? []
				: [moduleIssue(`$.items[${index}].title`, 'title.required', '卡片标题不能为空')])
		]
	},
	viewer: Viewer,
	editor: Editor,
	frames: {
		sortable: sectionSortableFrame(),
		draggable: sectionDraggableFrame(720, 320)
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
					text: [current.badge, current.description].filter(Boolean).join(' ')
				};
			});
			return section.title || section.text ? [section, ...items] : items;
		}
	}
});
