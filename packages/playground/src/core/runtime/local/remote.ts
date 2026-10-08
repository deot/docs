import { transform } from 'sucrase';
import { init, parse } from 'es-module-lexer';
import { resolveNpmImport } from '../../../cdn';
import { isRelativeSpecifier } from './compile/files';
import { ensureLocalBuiltin, localBuiltinIds } from './builtins';
import { prefersLocalBuiltin, resolveHostModule, resolveImportTarget, toHostModule, type ModuleLoader } from './modules';
import { rewriteImportMeta } from './compile/script';

export interface RemoteBuiltins {
	vue: unknown;
	vueRouter: unknown;
}

const HOST_VUE = new Set(['vue', 'vue/server-renderer']);

/**
 * 把 CDN 上的 ESM 先拉完整张依赖图，再在当前页面里执行。
 * 裸导入优先走 import map，缺失的 npm 依赖回退到 CDN ESM；import() 按需加载。
 * @param imports 合并后的 import map。
 * @param builtins 宿主 Vue 与 vue-router。
 * @param cdnURL 当前 CDN 根，用来识别默认地址。
 * @param importModule 浏览器原生 ESM 加载器。
 * @returns 按 URL 加载并执行远程模块的加载器。
 */
export const createRemoteLoader = (
	imports: Record<string, string>,
	builtins: RemoteBuiltins,
	cdnURL?: string,
	importModule: ModuleLoader = url => import(/* @vite-ignore */ url)
) => {
	const hostModules: Record<string, unknown> = {
		'vue': builtins.vue,
		'vue-router': builtins.vueRouter
	};
	const pendingBuiltins = new Set<string>();
	const texts = new Map<string, string>();
	const evaluated = new Map<string, unknown>();
	const crawled = new Set<string>();
	const nativeModules = new Map<string, Promise<unknown>>();
	const loadNative = (url: string) => {
		let pending = nativeModules.get(url);
		if (!pending) {
			pending = importModule(url).then((module) => {
				const exports = toHostModule(module);
				evaluated.set(url, exports);
				return exports;
			});
			nativeModules.set(url, pending);
		}
		return pending;
	};

	const localBuiltinId = (id: string) => {
		if (imports[id] && !prefersLocalBuiltin(id, imports, cdnURL)) return null;
		if (prefersLocalBuiltin(id, imports, cdnURL)) return id;
		let cursor = id;
		while (true) {
			const slash = cursor.lastIndexOf('/');
			if (slash <= 0) return null;
			const parent = cursor.slice(0, slash);
			if (prefersLocalBuiltin(parent, imports, cdnURL)) return parent;
			cursor = parent;
		}
	};

	const dependencyUrl = (from: string, specifier: string) => {
		if (isRelativeSpecifier(specifier) || /^https?:\/\//.test(specifier)) return new URL(specifier, from).href;
		if (imports[specifier] && !prefersLocalBuiltin(specifier, imports, cdnURL)) {
			return imports[specifier];
		}
		if (HOST_VUE.has(specifier) && prefersLocalBuiltin(specifier, imports, cdnURL)) return null;
		let cursor = specifier;
		while (cursor) {
			if (localBuiltinIds.has(cursor) && prefersLocalBuiltin(cursor, imports, cdnURL)) {
				pendingBuiltins.add(cursor);
				return null;
			}
			const slash = cursor.lastIndexOf('/');
			if (slash <= 0) break;
			cursor = cursor.slice(0, slash);
		}
		const target = imports[specifier] ? specifier : resolveImportTarget(specifier, imports);
		if (!target) {
			imports[specifier] = resolveNpmImport(specifier);
			return imports[specifier];
		}
		return imports[target];
	};

	const crawl = async (url: string) => {
		if (/\/\+esm(?:[?#]|$)/.test(url)) {
			await loadNative(url);
			return;
		}
		if (crawled.has(url)) return;
		crawled.add(url);
		const response = await fetch(url);
		if (!response.ok) {
			throw new Error(`${response.status} ${url}`);
		}
		const text = await response.text();
		await init;
		const [specifiers] = parse(text);
		// 按语法位置替换 import()，避免误改字符串、注释或对象的 import 方法。
		let source = text;
		for (const item of [...specifiers].reverse()) {
			if (item.d >= 0) source = source.slice(0, item.ss) + '__import' + source.slice(item.ss + 6);
		}
		texts.set(url, source);
		await Promise.all(specifiers.filter(item => item.d === -1).map(async (item) => {
			const next = dependencyUrl(url, item.n!);
			if (next) await crawl(next);
		}));
	};

	const requireFrom = (from: string) => (id: string) => {
		if (HOST_VUE.has(id) && prefersLocalBuiltin(id, imports, cdnURL)) {
			return toHostModule(builtins.vue);
		}
		const builtinId = localBuiltinId(id);
		if (builtinId) return toHostModule(hostModules[builtinId]);
		if (isRelativeSpecifier(id) || /^https?:\/\//.test(id)) return evaluate(new URL(id, from).href);
		const target = imports[id] ? id : resolveImportTarget(id, imports);
		if (!target || !imports[target]) {
			throw new Error(`[Playground] 未注册的模块 "${id}"`);
		}
		const loaded = evaluate(imports[target]);
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
		const text = texts.get(url);
		if (text == null) throw new Error(`[Playground] 远程模块尚未下载: ${url}`);
		const cjs = transform(rewriteImportMeta(text, url), {
			transforms: ['imports'],
			disableESTransforms: true,
			production: true,
			filePath: url
		}).code;
		const module = { exports: {} as Record<string, unknown> };
		evaluated.set(url, module.exports);
		const runner = new Function('require', 'module', 'exports', '__import', cjs) as (
			require: (id: string) => unknown,
			module: { exports: Record<string, unknown> },
			exports: Record<string, unknown>,
			importModule: (id: string) => Promise<unknown>
		) => void;
		runner(requireFrom(url), module, module.exports, async (id) => {
			const next = dependencyUrl(url, id);
			if (next) await load(next);
			else {
				const builtinId = localBuiltinId(id);
				if (builtinId && !(builtinId in hostModules)) hostModules[builtinId] = await ensureLocalBuiltin(builtinId);
			}
			return requireFrom(url)(id);
		});
		evaluated.set(url, module.exports);
		return module.exports;
	};

	const loading = new Map<string, Promise<unknown>>();
	const load = (url: string): Promise<unknown> => {
		const pending = loading.get(url);
		if (pending) return pending;
		const task = (async () => {
			await crawl(url);
			await Promise.all([...pendingBuiltins].map(async (id) => {
				if (id === 'vue' || id === 'vue-router') return;
				hostModules[id] = await ensureLocalBuiltin(id);
			}));
			return evaluate(url);
		})();
		loading.set(url, task);
		return task;
	};
	return { load };
};
