import type { PlaygroundFiles } from '../types';

export type EditorFilesChangeAction
	= | { type: 'update'; filename: string }
		| { type: 'create'; filename: string }
		| { type: 'rename'; filename: string; previousFilename: string }
		| { type: 'delete'; filename: string }
		| { type: 'entry'; filename: string };

export type EditorFilesChange = (
	files: PlaygroundFiles,
	entry: string,
	action: EditorFilesChangeAction
) => void;
