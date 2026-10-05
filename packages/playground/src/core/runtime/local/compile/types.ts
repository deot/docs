export interface CompiledModule {
	filename: string;
	js: string;
	css: string;
}

export interface CompileResult {
	entry: string;
	modules: Record<string, CompiledModule>;
	css: string[];
	errors: string[];
}

export interface LinkResult {
	component: unknown;
	css: string[];
	errors: string[];
}

export const IGNORED_FILENAMES = new Set([
	'import-map.json',
	'tsconfig.json'
]);
