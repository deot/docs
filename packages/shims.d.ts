declare module '*.css?inline' {
	const source: string;
	export default source;
}

declare module '*.scss?inline' {
	const source: string;
	export default source;
}

declare module '*.scss';

declare module 'markdown-it/lib/token.mjs' {
	import type { Token } from 'markdown-it';

	export default Token;
}

declare module 'markdown-it/lib/rules_core/state_core.mjs' {
	import type { StateCore } from 'markdown-it';

	export default StateCore;
}
