import Markdown from './wrapper.vue';

export { Markdown };
export { parseMarkdownSearchSections } from './markdown';
export { collectMarkdownHeadings, getMarkdownHeadingTitle } from './headings';
export type { MarkdownHeading } from './headings';
export type { MarkdownSearchDocument, MarkdownSearchSection } from './markdown';
export type {
	MarkdownIndicatorConfig,
	MarkdownIndicatorOptions,
	MarkdownPlaygroundConfig,
	MarkdownPlaygroundMountProps,
	MarkdownTheme
} from './types';
