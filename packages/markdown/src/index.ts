import Markdown from './wrapper.vue';

export { Markdown };
export { parseMarkdownSearchSections, toMarkdownTabId } from './markdown';
export { collectMarkdownHeadings, getMarkdownHeadingTitle } from './headings';
export {
	createHistoryTabQueryAdapter,
	markdownTabQueryKey
} from './tab-query';
export type { MarkdownTabQueryAdapter } from './tab-query';
export type { MarkdownHeading } from './headings';
export type { MarkdownSearchDocument, MarkdownSearchSection } from './markdown';
export type {
	MarkdownIndicatorConfig,
	MarkdownIndicatorOptions,
	MarkdownPlaygroundConfig,
	MarkdownPlaygroundMountProps,
	MarkdownTheme
} from './types';
