import { toEnumValue, toRecord, toStringValue } from '../../shared/utils';

export const HERO_VISUAL_TYPES = ['markdown', 'code'] as const;

export interface RendererHeroVisual {
	type: typeof HERO_VISUAL_TYPES[number];
	title: string;
	content: string;
	language: string;
}

export const createHeroVisual = (): RendererHeroVisual => ({
	type: 'markdown',
	title: 'guide.md',
	content: [
		'# Start with your first document\nKeep your content organized and easy to read.',
		'## Write\nAdd Markdown files to your workspace.',
		'## Compose\nCombine reusable page modules.',
		'## Publish\nDeploy your static workspace anywhere.'
	].join('\n\n'),
	language: 'typescript'
});

export const normalizeHeroVisual = (value: unknown): RendererHeroVisual => {
	const record = toRecord(value);
	const defaults = createHeroVisual();
	return {
		type: toEnumValue(record.type, HERO_VISUAL_TYPES, defaults.type),
		title: toStringValue(record.title, defaults.title),
		content: toStringValue(record.content, defaults.content),
		language: toStringValue(record.language, defaults.language)
	};
};
