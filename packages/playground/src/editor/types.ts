import type { PlaygroundFiles } from '../types';

export type EditorFilesChangeAction
	= | { type: 'update'; filename: string }
		| { type: 'create'; filename: string }
		| {
			type: 'rename';
			filename: string;
			/**
			 * 重命名前的文件名。
			 */
			previousFilename: string;
		}
		| { type: 'delete'; filename: string }
		| {
			/**
			 * 把入口切到 `filename`，不是新建文件。
			 */
			type: 'entry';
			filename: string;
		};

export type EditorFilesChange = (
	files: PlaygroundFiles,
	entry: string,
	action: EditorFilesChangeAction
) => void;
