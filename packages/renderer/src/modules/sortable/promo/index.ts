import { defineRendererModule } from '../../../catalog';
import { collectImageResources } from '../../shared/image-source';
import {
	isUnsafeHref,
	localeText,
	moduleIssue,
	toArrayValue,
	toEnumValue,
	toLength,
	toRecord,
	toStringValue,
	validateEnum,
	validateNumberRange
} from '../../shared/utils';
import { sectionDraggableFrame, sectionSortableFrame } from '../../shared/canvas-frame';
import Editor from './editor.vue';
import Viewer from './viewer.vue';
import {
	ADS_LAYOUTS,
	ADS_STYLES,
	type RendererAdsItem,
	type RendererAdsLayout,
	type RendererAdsStyle
} from './constants';

const createItems = (): RendererAdsItem[] => [
	{ src: '', href: 'https://example.com', title: 'Sponsor', alt: '' }
];

const normalizeItem = (item: unknown): RendererAdsItem => {
	const current = toRecord(item);
	return {
		src: toStringValue(current.src),
		href: toStringValue(current.href || current.to),
		title: toStringValue(current.title),
		alt: toStringValue(current.alt)
	};
};

export const AdsModule = defineRendererModule<{
	layout: RendererAdsLayout;
	style: RendererAdsStyle;
	columns: number;
	gap: number;
	height: number;
	speed: number;
	items: RendererAdsItem[];
}>({
	identity: {
		type: 'ads',
		version: 1,
		label: localeText('Ads', '广告位'),
		category: localeText('Page', '页面')
	},
	widget: { visible: true },
	data: {
		create: () => ({
			layout: 'tile',
			style: 'banner',
			columns: 2,
			gap: 12,
			height: 180,
			speed: 4,
			items: createItems()
		}),
		normalize: (value) => {
			const record = toRecord(value);
			return {
				layout: toEnumValue(record.layout, ADS_LAYOUTS, 'tile'),
				style: toEnumValue(record.style, ADS_STYLES, 'banner'),
				columns: toLength(record.columns, 2),
				gap: toLength(record.gap, 12),
				height: toLength(record.height, 180),
				speed: toLength(record.speed, 4),
				items: toArrayValue(record.items, normalizeItem)
			};
		},
		validate: value => [
			...validateEnum(value.layout, '$.layout', ADS_LAYOUTS),
			...validateEnum(value.style, '$.style', ADS_STYLES),
			...validateNumberRange(value.columns, '$.columns', { min: 1, max: 4, integer: true }),
			...validateNumberRange(value.gap, '$.gap', { min: 0, max: 80 }),
			...validateNumberRange(value.height, '$.height', { min: 80, max: 640 }),
			...validateNumberRange(value.speed, '$.speed', { min: 2, max: 20 }),
			...(value.items.length
				? []
				: [moduleIssue('$.items', 'items.min', '广告位至少需要一项')]),
			...value.items.flatMap((item, index) => {
				const path = `$.items[${index}]`;
				return [
					...(item.href.trim()
						? []
						: [moduleIssue(`${path}.href`, 'ads.href.required', '广告链接不能为空')]),
					...(item.href.trim() && isUnsafeHref(item.href)
						? [moduleIssue(`${path}.href`, 'ads.href.unsafe', '广告链接协议不安全')]
						: []),
					...(item.src.trim() || item.title.trim()
						? []
						: [moduleIssue(`${path}.src`, 'ads.content.required', '广告需要图片或标题')])
				];
			})
		]
	},
	viewer: Viewer,
	editor: Editor,
	frames: {
		sortable: sectionSortableFrame(),
		draggable: sectionDraggableFrame(360, 180, { minWidth: 120, minHeight: 80 })
	},
	integrations: {
		collectResources: (props) => {
			const record = toRecord(props);
			const items = Array.isArray(record.items) ? record.items : [];
			return collectImageResources(items.map(item => String(toRecord(item).src || '')));
		},
		collectSearchText: (props) => {
			const record = toRecord(props);
			const items = Array.isArray(record.items) ? record.items : [];
			return items.map((item) => {
				const current = toRecord(item);
				return {
					title: String(current.title || ''),
					text: String(current.href || '')
				};
			});
		}
	}
});
