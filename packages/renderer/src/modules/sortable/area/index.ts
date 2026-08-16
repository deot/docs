import { defineRendererModule } from '../../../catalog';
import { collectImageResources } from '../../shared/image-source';
import {
	localeText,
	moduleIssue,
	toRecord,
	toStringValue
} from '../../shared/utils';
import { sectionSortableFrame } from '../../shared/canvas-frame';
import Editor from './editor.vue';
import Viewer from './viewer.vue';
import { normalizeAreaZones, validateAreaZones } from './zones';
import type { RendererAreaZone } from './zones';

export const AreaModule = defineRendererModule<{
	src: string;
	alt: string;
	areas: RendererAreaZone[];
}>({
	identity: {
		type: 'area',
		version: 1,
		label: localeText('Image hotspots', '图片热区'),
		category: localeText('Content', '内容')
	},
	widget: { visible: true },
	data: {
		create: () => ({ src: '', alt: '', areas: [] }),
		normalize: (value) => {
			const record = toRecord(value);
			return {
				src: toStringValue(record.src),
				alt: toStringValue(record.alt),
				areas: normalizeAreaZones(record.areas ?? record.list)
			};
		},
		validate: value => [
			...(value.src.trim()
				? []
				: [moduleIssue('$.src', 'area.src.required', '请上传图片')]),
			...validateAreaZones(value.areas)
		]
	},
	viewer: Viewer,
	editor: Editor,
	frames: {
		sortable: sectionSortableFrame()
	},
	integrations: {
		collectResources: props => collectImageResources([props.src]),
		collectSearchText: (props) => {
			const areas = Array.isArray(props.areas) ? props.areas : [];
			return [
				{ title: String(props.alt || ''), text: '' },
				...areas.map((item) => {
					const current = toRecord(item);
					return {
						title: String(current.label || ''),
						text: String(current.to || '')
					};
				})
			];
		}
	}
});
