import * as fs from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import * as path from 'node:path';
import vue from '@vitejs/plugin-vue';
import vueJsx from '@vitejs/plugin-vue-jsx';
import { build } from 'vite';
import { isInside } from './workspace';

interface BundleChunk {
	type: 'chunk';
	code: string;
}

interface BundleAsset {
	type: 'asset';
	fileName: string;
	source: string | Uint8Array;
}

interface BundleResult {
	output: Array<BundleChunk | BundleAsset>;
}

export const WORKSPACE_MODULE_PREFIX = '/__docs/module/';

const BUNDLED_SPECIFIERS = new Set([
	'vue/jsx-runtime',
	'vue/jsx-dev-runtime'
]);

const IGNORED_DIRECTORIES = new Set([
	'coverage',
	'dist',
	'node_modules'
]);

export interface WorkspaceModuleEntry {
	name: string;
	entry: string;
	directory: string;
}

interface ModuleCacheRecord {
	signature: string;
	code: string;
}

const cache = new Map<string, ModuleCacheRecord>();
const pending = new Map<string, Promise<string>>();

let buildCount = 0;

export const getWorkspaceModuleBuildCount = () => buildCount;

export const resetWorkspaceModuleCache = () => {
	cache.clear();
	pending.clear();
	buildCount = 0;
};

const readPackageName = (manifestPath: string) => {
	try {
		const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as { name?: unknown };
		return typeof manifest.name === 'string' && manifest.name ? manifest.name : '';
	} catch {
		return '';
	}
};

const resolveSourceEntry = (directory: string) => {
	for (const relative of ['src/index.ts', 'index.ts']) {
		const candidate = path.resolve(directory, relative);
		if (!fs.existsSync(candidate) || !fs.statSync(candidate).isFile()) continue;
		const realEntry = fs.realpathSync(candidate);
		if (!isInside(directory, realEntry)) continue;
		return realEntry;
	}
	return '';
};

/**
 * 收集项目 `packages/*` 里能编成浏览器模块的包。只接受留在项目内的真实路径。
 * @param projectRoot 文档项目根目录。
 * @returns 包名到源码入口的映射。同名包保留先扫描到的一项。
 */
export const resolveWorkspaceModuleEntries = (projectRoot: string): WorkspaceModuleEntry[] => {
	const realRoot = fs.existsSync(projectRoot) ? fs.realpathSync(projectRoot) : path.resolve(projectRoot);
	const packagesDir = path.resolve(realRoot, 'packages');
	if (!fs.existsSync(packagesDir) || !fs.statSync(packagesDir).isDirectory()) return [];
	const realPackages = fs.realpathSync(packagesDir);
	if (!isInside(realRoot, realPackages)) return [];
	const seen = new Set<string>();
	const entries: WorkspaceModuleEntry[] = [];
	for (const item of fs.readdirSync(packagesDir, { withFileTypes: true })) {
		if (!item.isDirectory() && !item.isSymbolicLink()) continue;
		const directory = path.resolve(packagesDir, item.name);
		if (!fs.existsSync(directory) || !fs.statSync(directory).isDirectory()) continue;
		const realDirectory = fs.realpathSync(directory);
		if (!isInside(realPackages, realDirectory)) continue;
		const name = readPackageName(path.join(realDirectory, 'package.json'));
		const entry = name ? resolveSourceEntry(realDirectory) : '';
		if (!name || !entry || seen.has(name)) continue;
		seen.add(name);
		entries.push({ name, entry, directory: realDirectory });
	}
	return entries;
};

const directorySignature = (directory: string) => {
	const files: string[] = [];
	const walk = (current: string) => {
		const realCurrent = fs.realpathSync(current);
		if (!isInside(directory, realCurrent)) return;
		for (const item of fs.readdirSync(realCurrent, { withFileTypes: true })) {
			if (item.name === '.git' || IGNORED_DIRECTORIES.has(item.name)) continue;
			const filename = path.join(realCurrent, item.name);
			if (item.isSymbolicLink()) {
				if (!fs.existsSync(filename)) continue;
				const realName = fs.realpathSync(filename);
				if (!isInside(directory, realName)) continue;
				const stat = fs.statSync(realName);
				if (stat.isDirectory()) walk(realName);
				else if (stat.isFile()) files.push(`${realName}:${stat.mtimeMs}`);
				continue;
			}
			if (item.isDirectory()) {
				walk(filename);
				continue;
			}
			if (item.isFile()) files.push(`${filename}:${fs.statSync(filename).mtimeMs}`);
		}
	};
	walk(directory);
	files.sort();
	return files.join('\n');
};

// 裸导入留给 Playground import map。`vue/jsx-runtime` 打进包，避免 iframe 缺少这条映射。
export const isWorkspaceModuleExternal = (id: string) => {
	if (!id || id.startsWith('\0') || id.startsWith('.') || path.isAbsolute(id)) return false;
	if (BUNDLED_SPECIFIERS.has(id)) return false;
	return true;
};

const readAssetSource = (source: string | Uint8Array) => (
	typeof source === 'string' ? source : Buffer.from(source).toString('utf8')
);

const toBundleResult = (result: Awaited<ReturnType<typeof build>>): BundleResult => {
	const output = Array.isArray(result) ? result[0] : result;
	if (!output || !('output' in output) || !Array.isArray(output.output)) {
		throw new Error('Module build did not produce a bundle');
	}
	return output as BundleResult;
};

const injectStyles = (name: string, code: string, css: string) => {
	if (!css) return code;
	return [
		'if (typeof document !== "undefined") {',
		'\tconst style = document.createElement("style");',
		`\tstyle.setAttribute("data-docs-module", ${JSON.stringify(name)});`,
		`\tstyle.textContent = ${JSON.stringify(css)};`,
		'\tdocument.head.appendChild(style);',
		'}',
		code
	].join('\n');
};

const buildWorkspaceModule = async (projectRoot: string, entry: WorkspaceModuleEntry) => {
	buildCount += 1;
	const result = await build({
		configFile: false,
		envFile: false,
		root: projectRoot,
		publicDir: false,
		logLevel: 'silent',
		mode: 'development',
		appType: 'custom',
		define: {
			'process.env.NODE_ENV': JSON.stringify('development')
		},
		plugins: [vue(), vueJsx()],
		build: {
			write: false,
			minify: false,
			cssMinify: false,
			cssCodeSplit: false,
			sourcemap: false,
			emptyOutDir: false,
			copyPublicDir: false,
			modulePreload: false,
			reportCompressedSize: false,
			assetsInlineLimit: 100_000_000,
			chunkSizeWarningLimit: 100_000,
			rolldownOptions: {
				input: entry.entry,
				// Vite 默认会丢掉入口导出。Playground 按名字导入，必须保留。
				preserveEntrySignatures: 'strict',
				treeshake: false,
				external: isWorkspaceModuleExternal,
				output: {
					format: 'es',
					codeSplitting: false,
					entryFileNames: 'module.js'
				}
			}
		}
	});
	const bundle = toBundleResult(result);
	const chunks = bundle.output.filter((item): item is BundleChunk => item.type === 'chunk');
	if (chunks.length !== 1) {
		throw new Error(`Expected a single module chunk, got ${chunks.length}`);
	}
	const css = bundle.output
		.filter((item): item is BundleAsset => item.type === 'asset' && item.fileName.endsWith('.css'))
		.map(item => readAssetSource(item.source))
		.join('\n');
	return injectStyles(entry.name, chunks[0].code, css);
};

/**
 * 把工作区包编成一份浏览器 ESM。`vue` 和其它工作区包保持裸导入。
 * @param projectRoot 用于解析 node_modules 的项目根。
 * @param entry 已通过边界检查的包入口。
 * @returns 可直接交给浏览器执行的模块源码。
 */
export const compileWorkspaceModule = (
	projectRoot: string,
	entry: WorkspaceModuleEntry
) => {
	const signature = directorySignature(entry.directory);
	const cached = cache.get(entry.name);
	if (cached?.signature === signature) return Promise.resolve(cached.code);
	const inflight = pending.get(entry.name);
	if (inflight) return inflight;
	const task = buildWorkspaceModule(projectRoot, entry).then((code) => {
		cache.set(entry.name, {
			signature: directorySignature(entry.directory),
			code
		});
		return code;
	}).finally(() => {
		if (pending.get(entry.name) === task) pending.delete(entry.name);
	});
	pending.set(entry.name, task);
	return task;
};

const moduleFailure = (message: string) => (
	`throw new Error(${JSON.stringify(message)});`
);

/**
 * 响应 `/__docs/module/<包名>`。未知包返回 404；编译失败返回会抛错的 ESM。
 * @param req 开发服务请求。
 * @param res 开发服务响应。
 * @param projectRoot 文档项目根目录。
 * @returns 是否已处理该请求。路径不匹配时为 false。
 */
export const respondWorkspaceModule = async (
	req: IncomingMessage,
	res: ServerResponse,
	projectRoot: string
) => {
	const pathname = (req.url || '/').split(/[?#]/u, 1)[0] || '/';
	if (!pathname.startsWith(WORKSPACE_MODULE_PREFIX)) return false;
	if (req.method !== 'GET' && req.method !== 'HEAD') {
		res.statusCode = 405;
		res.setHeader('Allow', 'GET, HEAD');
		res.end('Method Not Allowed');
		return true;
	}
	let name = '';
	try {
		name = decodeURIComponent(pathname.slice(WORKSPACE_MODULE_PREFIX.length));
	} catch {
		res.statusCode = 400;
		res.end('Bad Request');
		return true;
	}
	if (
		!name
		|| name.split('/').includes('..')
		|| name.includes('\\')
		|| name.includes('\0')
	) {
		res.statusCode = 404;
		res.end('Not Found');
		return true;
	}
	const entry = resolveWorkspaceModuleEntries(projectRoot).find(item => item.name === name);
	if (!entry) {
		res.statusCode = 404;
		res.end('Not Found');
		return true;
	}
	let code: string;
	try {
		code = await compileWorkspaceModule(projectRoot, entry);
	} catch (reason) {
		code = moduleFailure(reason instanceof Error ? reason.message : 'Module compile failed');
	}
	res.statusCode = 200;
	res.setHeader('Content-Type', 'text/javascript; charset=utf-8');
	res.setHeader('Cache-Control', 'no-store');
	if (req.method === 'HEAD') res.end();
	else res.end(code);
	return true;
};
