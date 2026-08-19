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
	 * npm CDN 前缀，同时用于默认 import map 和预览样式。
	 * 例如 `https://cdn.jsdelivr.net/npm` 或 `https://unpkg.com`。
	 */
	cdnURL?: string;
	/**
	 * 实例层 import，合并时高于站点默认、低于管理页覆盖。
	 * `files` / `mainFile` 仍由 playground 自己管理。
	 */
	builtinImportMap?: ImportMap;
};

export type PlaygroundPreviewOptions = SandboxProps['previewOptions'];
