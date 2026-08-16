import { defineRendererModule } from '../../../catalog';
import {
	localeText,
	moduleIssue,
	SECTION_ALIGNMENTS,
	toArrayValue,
	toEnumValue,
	toRecord,
	toStringValue,
	validateEnum
} from '../../shared/utils';
import { sectionDraggableFrame, sectionSortableFrame } from '../../shared/canvas-frame';
import Editor from './editor.vue';
import Viewer from './viewer.vue';

export interface RendererFaqItem {
	question: string;
	answer: string;
}

const createItems = (): RendererFaqItem[] => [
	{ question: 'Do I need a dedicated server?', answer: 'No. The output is a static site you can host anywhere.' },
	{ question: 'Can I customize this page?', answer: 'Yes. Every block is editable, or you can replace the document.' },
	{ question: 'Does live update work in production?', answer: 'Development hot-updates resources; production follows your release flow.' }
];

const normalizeItem = (item: unknown): RendererFaqItem => {
	const current = toRecord(item);
	return {
		question: toStringValue(current.question),
		answer: toStringValue(current.answer)
	};
};

export const FaqModule = defineRendererModule<{
	eyebrow: string;
	title: string;
	description: string;
	align: typeof SECTION_ALIGNMENTS[number];
	accent: string;
	items: RendererFaqItem[];
}>({
	identity: {
		type: 'faq',
		version: 1,
		label: localeText('FAQ', '问答'),
		category: localeText('Page', '页面')
	},
	widget: { visible: true },
	data: {
		create: () => ({
			eyebrow: 'FAQ',
			title: 'Common questions',
			description: 'Short answers for the first decisions.',
			align: 'center',
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
				accent: toStringValue(record.accent),
				items: toArrayValue(record.items, normalizeItem)
			};
		},
		validate: value => [
			...validateEnum(value.align, '$.align', SECTION_ALIGNMENTS),
			...(value.items.length
				? []
				: [moduleIssue('$.items', 'items.min', '问答至少需要一项')]),
			...value.items.flatMap((item, index) => item.question.trim()
				? []
				: [moduleIssue(`$.items[${index}].question`, 'question.required', '问题不能为空')])
		]
	},
	viewer: Viewer,
	editor: Editor,
	frames: {
		sortable: sectionSortableFrame(),
		draggable: sectionDraggableFrame(720, 360)
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
					title: String(current.question || ''),
					text: String(current.answer || '')
				};
			});
			return section.title || section.text ? [section, ...items] : items;
		}
	}
});
