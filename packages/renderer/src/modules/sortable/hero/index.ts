import { defineRendererModule } from '../../../catalog';
import {
	localeText,
	moduleIssue,
	normalizeActionValues,
	toArrayValue,
	toBooleanValue,
	toEnumValue,
	toLength,
	toRecord,
	toStringValue,
	validateActionValues,
	validateEnum,
	validateNumberRange
} from '../../shared/utils';
import type { RendererActionValue } from '../../shared/utils';
import { sectionDraggableFrame, sectionSortableFrame } from '../../shared/canvas-frame';
import Editor from './editor.vue';
import Viewer from './viewer.vue';

const ALIGNMENTS = ['left', 'center'] as const;

export interface RendererHeroHighlight {
	value: string;
	label: string;
	color: string;
}

const createHighlights = (): RendererHeroHighlight[] => [
	{ value: 'Vue 3', label: 'Runtime', color: '' },
	{ value: 'i18n', label: 'Locales', color: '' },
	{ value: 'Static', label: 'Deploy', color: '' }
];

const normalizeHighlights = (value: unknown): RendererHeroHighlight[] => (
	toArrayValue(value, (item) => {
		const current = toRecord(item);
		return {
			value: toStringValue(current.value),
			label: toStringValue(current.label),
			color: toStringValue(current.color)
		};
	})
);

export const HeroModule = defineRendererModule<{
	eyebrow: string;
	title: string;
	description: string;
	actions: RendererActionValue[];
	align: typeof ALIGNMENTS[number];
	accent: string;
	accentSecondary: string;
	background: string;
	showVisual: boolean;
	minHeight: number;
	highlights: RendererHeroHighlight[];
}>({
	identity: {
		type: 'hero',
		version: 1,
		label: localeText('Hero', '首屏'),
		category: localeText('Page', '页面')
	},
	widget: { visible: true },
	data: {
		create: () => ({
			eyebrow: '@deot/docs',
			title: 'Build your documentation',
			description: 'Compose a production-ready page with reusable modules.',
			actions: [],
			align: 'left',
			accent: '#873bf4',
			accentSecondary: '#2d8cf0',
			background: '',
			showVisual: true,
			minHeight: 420,
			highlights: createHighlights()
		}),
		normalize: (value) => {
			const record = toRecord(value);
			return {
				eyebrow: toStringValue(record.eyebrow),
				title: toStringValue(record.title),
				description: toStringValue(record.description),
				actions: normalizeActionValues(record.actions),
				align: toEnumValue(record.align, ALIGNMENTS, 'left'),
				accent: toStringValue(record.accent),
				accentSecondary: toStringValue(record.accentSecondary),
				background: toStringValue(record.background),
				showVisual: toBooleanValue(record.showVisual, true),
				minHeight: toLength(record.minHeight, 420),
				highlights: normalizeHighlights(record.highlights)
			};
		},
		validate: value => [
			...(value.title.trim()
				? []
				: [moduleIssue('$.title', 'title.required', '首屏标题不能为空')]),
			...validateEnum(value.align, '$.align', ALIGNMENTS),
			...validateNumberRange(value.minHeight, '$.minHeight', { min: 0, max: 960 }),
			...validateActionValues(value.actions, '$.actions')
		]
	},
	viewer: Viewer,
	editor: Editor,
	frames: {
		sortable: sectionSortableFrame({ fullWidth: true }),
		draggable: sectionDraggableFrame(720, 420)
	},
	integrations: {
		collectSearchText: (props) => {
			const highlights = Array.isArray(props.highlights) ? props.highlights : [];
			const extra = highlights.map((item) => {
				const current = toRecord(item);
				return [current.value, current.label].filter(Boolean).join(' ');
			}).filter(Boolean).join(' ');
			return [{
				title: String(props.title || ''),
				text: [props.eyebrow, props.description, extra].filter(Boolean).join(' ')
			}];
		}
	}
});
