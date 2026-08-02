import Playground from './playground.vue';
import { CodePreview } from './core';

export * from './editor';
export * from './types';
export {
	highlightCodeByLanguage,
	highlightCode,
	registerVueHighlight,
	resolveHighlightLanguage,
	vueHighlight
} from './highlight';
export { CodePreview, Playground };
