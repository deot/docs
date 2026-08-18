import { defineRendererModule } from '../../../catalog';
import { collectImageResources } from '../image-source';
import {
	localeText,
	toBooleanValue,
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

const IMAGE_FITS = ['contain', 'cover', 'fill'] as const;

export const ImageModule = defineRendererModule<{
	src: string;
	dark: string;
	alt: string;
	fit: typeof IMAGE_FITS[number];
	borderRadius: number;
	eager: boolean;
}>({
	identity: {
		type: 'image',
		version: 1,
		label: localeText('Image', '图片'),
		category: localeText('Content', '内容')
	},
	widget: { visible: true },
	data: {
		create: () => ({ src: '', dark: '', alt: '', fit: 'contain', borderRadius: 0, eager: false }),
		normalize: (value) => {
			const record = toRecord(value);
			return {
				src: toStringValue(record.src),
				dark: toStringValue(record.dark),
				alt: toStringValue(record.alt),
				fit: toEnumValue(record.fit, IMAGE_FITS, 'contain'),
				borderRadius: toLength(record.borderRadius, 0),
				eager: toBooleanValue(record.eager)
			};
		},
		validate: value => [
			...validateEnum(value.fit, '$.fit', IMAGE_FITS),
			...validateNumberRange(value.borderRadius, '$.borderRadius', { min: 0, max: 240 })
		]
	},
	viewer: Viewer,
	editor: Editor,
	frames: {
		sortable: sectionSortableFrame(),
		draggable: sectionDraggableFrame(320, 240, { minWidth: 32, minHeight: 32 })
	},
	integrations: {
		collectResources: (props) => {
			const record = toRecord(props);
			return collectImageResources([record.src, record.dark]);
		}
	}
});
