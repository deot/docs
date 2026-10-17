import { defineRendererModule } from '../../../catalog';
import { sectionDraggableFrame, sectionSortableFrame } from '../../shared/canvas-frame';
import {
	SECTION_ALIGNMENTS, localeText, moduleIssue, normalizeSectionHeader,
	toArrayValue, toLength, toRecord, toStringValue, validateEnum, validateNumberRange
} from '../../shared/utils';
import type { RendererSectionHeader } from '../../shared/utils';
import Editor from './editor.vue';
import Viewer from './viewer.vue';

export interface RendererCodeFold {
	/** 从 1 开始的行号，包含首尾两行。 */
	start: number;
	end: number;
	label: string;
}

export interface RendererCodeProps extends RendererSectionHeader {
	filename: string;
	language: string;
	content: string;
	/** 留空跟随站点主题；其余高亮、浅底和边框由强调色派生。 */
	accent: string;
	background: string;
	textColor: string;
	folds: RendererCodeFold[];
	highlightLines: number[];
}

export const normalizeCodeFolds = (value: unknown): RendererCodeFold[] => toArrayValue(value, (item) => {
	const record = toRecord(item);
	return { start: toLength(record.start, 1), end: toLength(record.end, 1), label: toStringValue(record.label) };
});

export const CodeModule = defineRendererModule<RendererCodeProps>({
	identity: {
		type: 'code', version: 1,
		label: localeText('Code showcase', '代码展示'),
		category: localeText('Page', '页面')
	},
	widget: { visible: true },
	data: {
		create: () => ({
			eyebrow: '', title: 'Show your code', description: '', align: 'center',
			filename: 'index.html', language: 'html', content: '<main>\n  <h1>Hello, docs!</h1>\n</main>',
			accent: '', background: '', textColor: '', folds: [], highlightLines: []
		}),
		normalize: (value) => {
			const record = toRecord(value);
			return {
				...normalizeSectionHeader(record, 'center'),
				filename: toStringValue(record.filename, 'index.html'),
				language: toStringValue(record.language, 'html'),
				content: toStringValue(record.content),
				accent: toStringValue(record.accent), background: toStringValue(record.background), textColor: toStringValue(record.textColor),
				folds: normalizeCodeFolds(record.folds),
				highlightLines: toArrayValue(record.highlightLines, item => toLength(item, 0))
			};
		},
		validate: (value) => {
			const lines = value.content.split('\n').length;
			const ordered = value.folds.map((fold, index) => ({ ...fold, index })).sort((a, b) => a.start - b.start);
			return [
				...validateEnum(value.align, '$.align', SECTION_ALIGNMENTS),
				...ordered.flatMap((fold, index) => [
					...validateNumberRange(fold.start, `$.folds[${fold.index}].start`, { min: 1, max: lines, integer: true }),
					...validateNumberRange(fold.end, `$.folds[${fold.index}].end`, { min: fold.start, max: lines, integer: true }),
					...(index && fold.start <= ordered[index - 1].end
						? [moduleIssue(`$.folds[${fold.index}]`, 'fold.overlap', '代码折叠区间不能重叠')]
						: [])
				]),
				...value.highlightLines.flatMap((line, index) => (
					validateNumberRange(line, `$.highlightLines[${index}]`, { min: 1, max: lines, integer: true })
				))
			];
		}
	},
	viewer: Viewer,
	editor: Editor,
	frames: { sortable: sectionSortableFrame(), draggable: sectionDraggableFrame(900, 640) },
	integrations: {
		collectSearchText: (value) => {
			const record = toRecord(value);
			return [{
				title: String(record.title || ''),
				text: [record.eyebrow, record.description, record.filename, record.content].filter(Boolean).join(' ')
			}];
		}
	}
});
