import type { Options } from '@deot/dev-shared';

export type DeverMode = 'development' | 'build' | 'preview';

export type DeverOptions = Options & {
	/**
	 * 以生产构建模式跑 Vite。与 `preview` 互斥。
	 */
	build?: boolean;
	/**
	 * 以静态预览模式提供已构建站点。与 `build` 互斥。
	 */
	preview?: boolean;
	/**
	 * 文档工作区相对路径，默认探测 `site` 再回退项目根。
	 */
	workspace?: string;
	/**
	 * 构建产物目录，默认 `dist`。不得把 workspace 包进输出目录。
	 */
	outDir?: string;
	host?: string;
	port?: number;
	/**
	 * 只打印将要执行的命令，不启动 Vite。测试环境默认开启。
	 */
	dryRun?: boolean;
};

/** Vite 插件只消费工作区与产物相关字段。 */
export type DocsPluginOptions = Pick<DeverOptions, 'workspace' | 'outDir' | 'build' | 'preview'>;
