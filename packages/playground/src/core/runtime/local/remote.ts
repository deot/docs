import { transform } from 'sucrase';
import { init, parse } from 'es-module-lexer';
import { cdnModuleName, createCdnResolver, resolveNpmImport } from '../../../cdn';
import { isRelativeSpecifier } from './compile/files';
import { usesHostRuntime, resolveHostModule, resolveImportTarget, toHostModule } from './modules';
import { rewriteImportMeta } from './compile/script';

export interface RemoteBuiltins {
	vue: unknown;
	vueRouter: unknown;
}

const moduleUrl = (url: string) => new URL(url, globalThis.location?.href).href;

type ModuleRunner = (
	require: (id: string) => unknown,
	module: { exports: Record<string, unknown> },
	exports: Record<string, unknown>,
	importModule: (id: string) => Promise<unknown>
) => void;

interface RemoteSource {
	dependencies: string[];
	run: ModuleRunner;
}

const REMOTE_SOURCE_CACHE_LIMIT = 128;
const sourceCache = new Map<string, Promise<RemoteSource>>();

export const clearRemoteModuleCache = () => sourceCache.clear();

const prepareRemoteSource = async (url: string): Promise<RemoteSource> => {
	const response = await fetch(url);
	if (!response.ok) throw new Error(`${response.status} ${url}`);
	const text = await response.text();
	await init();
	const [specifiers] = parse(text);
	// 按语法位置替换 import()，避免误改字符串、注释或对象的 import 方法。
	let source = text;
	for (const item of [...specifiers].reverse()) {
		if (item.type === 'dynamic') source = source.slice(0, item.importStart) + '__import' + source.slice(item.importStart + 6);
	}
	const cjs = transform(rewriteImportMeta(source, url), {
		transforms: ['imports'],
		disableESTransforms: true,
		production: true,
		filePath: url
	}).code;
	return {
		dependencies: specifiers.filter(item => item.type === 'static' || item.type === 'reexport-star').map(item => item.specifier!),
		run: new Function('require', 'module', 'exports', '__import', cjs) as ModuleRunner
	};
};

const readRemoteSource = (url: string): Promise<RemoteSource> => {
	// 同源模块可能来自开发服务器，必须保留实时读取；只共享外部模块的下载和转换成果。
	if (new URL(url).origin === globalThis.location?.origin) return prepareRemoteSource(url);
	const cached = sourceCache.get(url);
	if (cached) {
		sourceCache.delete(url);
		sourceCache.set(url, cached);
		return cached;
	}
	const task = prepareRemoteSource(url).catch((error) => {
		if (sourceCache.get(url) === task) sourceCache.delete(url);
		throw error;
	});
	sourceCache.set(url, task);
	if (sourceCache.size > REMOTE_SOURCE_CACHE_LIMIT) sourceCache.delete(sourceCache.keys().next().value!);
	return task;
};

/**
 * 把 CDN 上的 ESM 先拉完整张依赖图，再在当前页面里执行。
 * 裸导入优先走 import map，缺失的 npm 依赖回退到 CDN ESM；import() 按需加载。
 * @param imports 合并后的 import map。
 * @param builtins 宿主 Vue 与 vue-router。
 * @param overrides 显式配置的模块名，与自动补齐的默认地址区分。
 * @param cdnURL 没有 launch 选点结果时使用的实例 CDN。
 * @returns 按 URL 加载并执行远程模块的加载器。
 */
export const createRemoteLoader = (
	imports: Record<string, string>,
	builtins: RemoteBuiltins,
	overrides: ReadonlySet<string> = new Set(Object.keys(imports)),
	cdnURL?: string
) => {
	const resolve = createCdnResolver(cdnURL);
	const resolveUrl = (url: string) => resolve(moduleUrl(url));
	const hostModules: Record<string, unknown> = {
		'vue': builtins.vue,
		'vue/server-renderer': builtins.vue,
		'vue-router': builtins.vueRouter
	};
	const sources = new Map<string, RemoteSource>();
	const pendingSources = new Map<string, Promise<RemoteSource>>();
	const evaluated = new Map<string, unknown>();

	const dependencySpecifier = (from: string, specifier: string) => {
		if (isRelativeSpecifier(specifier) || /^https?:\/\//.test(specifier)) {
			const url = new URL(specifier, from);
			// +esm 把裸依赖写成带版本的 CDN 地址，还原包名才能应用当前预览的覆盖。
			const name = cdnModuleName(url.href);
			if (name && (overrides.has(name) || usesHostRuntime(name, imports, overrides))) return name;
			return url.href;
		}
		return specifier;
	};

	const dependencyUrl = (from: string, id: string) => {
		const specifier = dependencySpecifier(from, id);
		if (/^https?:\/\//.test(specifier)) return resolveUrl(specifier);
		if (imports[specifier] && !usesHostRuntime(specifier, imports, overrides)) {
			return resolveUrl(imports[specifier]);
		}
		if (usesHostRuntime(specifier, imports, overrides)) return null;
		const target = imports[specifier] ? specifier : resolveImportTarget(specifier, imports);
		if (!target) {
			return resolveUrl(resolveNpmImport(specifier));
		}
		return resolveUrl(imports[target]);
	};

	const crawl = async (url: string, visited = new Set<string>()) => {
		if (visited.has(url)) return;
		visited.add(url);
		let pending = pendingSources.get(url);
		if (!pending) {
			pending = readRemoteSource(url).catch((error) => {
				pendingSources.delete(url);
				throw error;
			});
			pendingSources.set(url, pending);
		}
		const source = await pending;
		sources.set(url, source);
		await Promise.all(source.dependencies.map(async (specifier) => {
			const next = dependencyUrl(url, specifier);
			if (next) await crawl(next, visited);
		}));
	};

	const requireFrom = (from: string) => (specifier: string) => {
		const id = dependencySpecifier(from, specifier);
		if (usesHostRuntime(id, imports, overrides)) {
			return toHostModule(hostModules[id]);
		}
		if (isRelativeSpecifier(id) || /^https?:\/\//.test(id)) return evaluate(dependencyUrl(from, id)!);
		const target = imports[id] ? id : resolveImportTarget(id, imports);
		if (!target) return evaluate(dependencyUrl(from, id)!);
		const loaded = evaluate(resolveUrl(imports[target]));
		if (target === id) return loaded;
		if (!resolveHostModule(id, { [target]: loaded })) {
			/* istanbul ignore next -- 父包没有对应导出时才拒绝 */
			throw new Error(`[Playground] 未注册的模块 "${id}"`);
		}
		// sucrase 会读取 `require("pkg/name").name`，父包导出上就有这个名字。
		return loaded;
	};

	const evaluate = (url: string): unknown => {
		if (evaluated.has(url)) return evaluated.get(url);
		const source = sources.get(url);
		if (!source) throw new Error(`[Playground] 远程模块尚未下载: ${url}`);
		// CDN 可能显式导出 __esModule，预先保留可写属性，避免与转换器的标记冲突。
		const module = { exports: Object.defineProperty({}, '__esModule', { value: true, writable: true }) as Record<string, unknown> };
		evaluated.set(url, module.exports);
		const runner = source.run;
		try {
			runner(requireFrom(url), module, module.exports, id => loadModule(id, url));
		} catch (error) {
			evaluated.delete(url);
			throw error;
		}
		// ESM 的 default 已由转换器保留，不再按 CDN 导出的同名 CJS 标记二次包装。
		module.exports.__esModule = true;
		evaluated.set(url, module.exports);
		return module.exports;
	};

	const loading = new Map<string, Promise<unknown>>();
	const load = (sourceUrl: string): Promise<unknown> => {
		const url = resolveUrl(sourceUrl);
		const pending = loading.get(url);
		if (pending) return pending;
		const task = (async () => {
			await crawl(url);
			return evaluate(url);
		})().catch((error) => {
			loading.delete(url);
			throw new Error(`[Playground] 无法加载模块 (${url}): ${error instanceof Error ? error.message : String(error)}`, { cause: error });
		});
		loading.set(url, task);
		return task;
	};
	const loadModule = async (id: string, from = globalThis.location?.href): Promise<unknown> => {
		const url = dependencyUrl(from, id);
		if (url) await load(url);
		return requireFrom(from)(id);
	};
	return { load, loadModule };
};
