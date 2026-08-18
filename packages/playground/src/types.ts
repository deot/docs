import type { ImportMap, SandboxProps, StoreState } from '@vue/repl';

export type PlaygroundFiles = Record<string, string>;

export type PlaygroundView = 'runtime' | 'files';

/** runtime / files 预览共用的文件快照。 */
export interface PlaygroundFilesProps {
	/**
	 * 文件名到源码。键是虚拟路径，如 `App.vue`。
	 */
	files: PlaygroundFiles;
	/**
	 * 作为 `@vue/repl` `mainFile` 的入口文件名，必须是 `files` 中的键。
	 */
	entry: string;
}

/** 预览切换条共用的视图状态。 */
export interface PlaygroundViewsProps {
	views: PlaygroundView[];
	/**
	 * 当前预览：运行时沙箱或文件树。
	 */
	activeView: PlaygroundView;
}

/**
 * 预览视口。`auto` 随内容增高；数字表示宽度 px；元组为宽高 px。
 */
export type PlaygroundViewport = 'auto' | number | [width: number, height: number];

export type PlaygroundOptions = Omit<Partial<StoreState>,
	'builtinImportMap' | 'files' | 'activeFilename' | 'mainFile' | 'template'
> & {
	/**
	 * 覆盖 REPL 内置 import map。`files` / `mainFile` 仍由 playground 自己管理。
	 */
	builtinImportMap?: ImportMap;
};

export type PlaygroundPreviewOptions = SandboxProps['previewOptions'];
