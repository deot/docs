import type { ImportMap, StoreState } from '@vue/repl';

export type PlaygroundFiles = Record<string, string>;

export type PlaygroundOptions = Omit<Partial<StoreState>,
	'builtinImportMap' | 'files' | 'activeFilename' | 'mainFile' | 'template'
> & {
	builtinImportMap?: ImportMap;
};
