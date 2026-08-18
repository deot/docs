// 仅用于故意构造非法输入。
export const invalid = <T>(value: unknown) => value as T;

export interface PlaygroundStoreFile {
	filename: string;
	code: string;
}

export interface PlaygroundStoreStub {
	options: {
		files: { value: Record<string, PlaygroundStoreFile> };
		mainFile: { value: string };
		activeFilename: { value: string };
		template: { value: { welcomeSFC?: string } };
		builtinImportMap: { value: { imports: Record<string, string> } };
	};
	files: Record<string, PlaygroundStoreFile>;
	mainFile: string;
	activeFilename: string;
	errors: unknown[];
	init: ReturnType<typeof vi.fn>;
	setActive: ReturnType<typeof vi.fn>;
	addFile: ReturnType<typeof vi.fn>;
	renameFile: ReturnType<typeof vi.fn>;
	setFiles: ReturnType<typeof vi.fn>;
}
