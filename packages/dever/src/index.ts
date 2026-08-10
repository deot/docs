import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Options } from '@deot/dev-shared';
import { Shell, Utils } from '@deot/dev-shared';
import fs from 'fs-extra';
import type { InlineConfig } from 'vite';
import { build as createBuild, createServer, mergeConfig } from 'vite';
import createPlugins from './plugins';
import { startPreviewServer } from './preview';

const dirname = path.dirname(fileURLToPath(import.meta.url));

export type DeverMode = 'development' | 'build' | 'preview';
export type DeverOptions = Options & {
	build?: boolean;
	preview?: boolean;
	workspace?: string;
	outDir?: string;
	host?: string;
	port?: number;
	dryRun?: boolean;
};

const resolveRealPath = (filename: string) => {
	const missing: string[] = [];
	let cursor = path.resolve(filename);
	while (!fs.existsSync(cursor)) {
		const parent = path.dirname(cursor);
		if (parent === cursor) break;
		missing.unshift(path.basename(cursor));
		cursor = parent;
	}
	const realParent = fs.existsSync(cursor) ? fs.realpathSync(cursor) : cursor;
	return path.resolve(realParent, ...missing);
};

const containsPath = (parent: string, target: string) => {
	const relative = path.relative(parent, target);
	return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
};

/**
 * 拒绝可能在清空输出目录时删除 workspace 本身的构建配置。通过解析最近的
 * 已存在祖先目录，也能阻止“已有符号链接 + 尚未创建输出目录”的同类风险。
 * @param workspace 文档 workspace。
 * @param outDir 指定的 Vite 输出目录。
 */
export const assertSafeBuildOutDir = (workspace: string, outDir: string) => {
	const realWorkspace = resolveRealPath(workspace);
	const realOutDir = resolveRealPath(outDir);
	if (containsPath(realOutDir, realWorkspace)) {
		throw new RangeError(`Build outDir must not contain the workspace: ${outDir}`);
	}
};

export const getDeverMode = (options: DeverOptions): DeverMode => {
	if (options.build && options.preview) {
		throw new TypeError('build and preview modes are mutually exclusive');
	}
	if (options.build) return 'build';
	if (options.preview) return 'preview';
	return 'development';
};

// 创建统一 Vite 配置，同时隔离开发、一次性构建与静态预览模式。
export const createDeverConfig = (options: DeverOptions): InlineConfig => {
	const cwd = process.cwd();
	const workspace = String(options.workspace || 'site');
	const mode = getDeverMode(options);
	const build = mode === 'build';
	const preview = mode === 'preview';
	const workspaceRoot = path.resolve(cwd, workspace);
	const outDir = path.resolve(cwd, String(options.outDir || 'dist'));
	if (build) assertSafeBuildOutDir(workspaceRoot, outDir);
	const localAliases = ['markdown', 'playground'].reduce<Record<string, string>>((result, name) => {
		const source = path.resolve(cwd, `packages/${name}/src/index.ts`);
		if (fs.existsSync(source)) result[`@deot/docs-${name}`] = source;
		return result;
	}, {});
	const server = preview
		? undefined
		: {
				host: true,
				watch: { ignored: ['**/coverage/**', '**/dist/**'] }
			};
	const config: InlineConfig = {
		root: build || preview
			? workspaceRoot
			: cwd,
		resolve: { alias: localAliases },
		server,
		optimizeDeps: { entries: [] },
		build: build
			? {
					outDir,
					emptyOutDir: true,
					rollupOptions: { input: path.resolve(workspaceRoot, 'index.html') }
				}
			: undefined
	};

	const userConfigFiles = ['z.doc.config', 'doc.config', 'vite.config'];
	for (const filename of userConfigFiles) {
		for (const extension of ['.js', '.ts']) {
			const candidate = path.resolve(cwd, `${filename}${extension}`);
			if (fs.existsSync(candidate)) {
				config.configFile = candidate;
				return mergeConfig(createPlugins(options), config);
			}
		}
	}
	config.configFile = path.resolve(dirname, '../shared.config.ts');
	return mergeConfig(createPlugins(options), config);
};

// 执行选定模式；仅开发与预览模式会持续保持服务运行。
export const run = (input: DeverOptions) => Utils.autoCatch(async () => {
	const options: DeverOptions = {
		workspace: 'site',
		outDir: 'dist',
		dryRun: false,
		build: false,
		preview: false,
		...input
	};
	const mode = getDeverMode(options);
	if (typeof options.dryRun === 'undefined') options.dryRun = process.env.NODE_ENV === 'UNIT';
	if (options.dryRun) return Shell.spawn(`echo ${mode} ${dirname}`);
	process.env.ENV_OPTIONS = encodeURIComponent(JSON.stringify(options));
	// 预览服务有意完全绕过 Vite。即使设置 `hmr: false`，Vite 开发服务器
	// 仍会创建文件监听器，并通过客户端脚本转换 HTML。
	if (mode === 'preview') {
		await startPreviewServer(options);
		return;
	}
	const config = createDeverConfig(options);
	if (mode === 'build') {
		await createBuild(config);
		return;
	}
	const server = await createServer(config);
	await server.listen();
	server.printUrls();
	server.bindCLIShortcuts({ print: true });
});
