import { transform } from 'sucrase';
import { isRelativeSpecifier, listImportSpecifiers } from './compile/files';
import { ensureLocalBuiltin, localBuiltinIds } from './builtins';
import { prefersLocalBuiltin, resolveHostModule, resolveImportTarget, toHostModule } from './modules';
import { rewriteImportMeta } from './compile/script';

export interface RemoteBuiltins {
	vue: unknown;
	vueRouter: unknown;
}

const HOST_VUE = new Set(['vue', 'vue/server-renderer']);

/**
 * 把 CDN 上的 ESM 先拉完整张依赖图，再在当前页面里执行。
 * 裸导入走同一份 import map。与默认 CDN 不同的 `vue` 地址会远程加载。
 * @param imports 合并后的 import map。
 * @param builtins 宿主 Vue 与 vue-router。
 * @param cdnURL 当前 CDN 根，用来识别默认地址。
 * @returns 按 URL 加载并执行远程模块的加载器。
 */
export const createRemoteLoader = (
	imports: Record<string, string>,
	builtins: RemoteBuiltins,
	cdnURL?: string
) => {
	const hostModules: Record<string, unknown> = {
		'vue': builtins.vue,
		'vue-router': builtins.vueRouter
	};
	const pendingBuiltins = new Set<string>();
	const texts = new Map<string, string>();
	const evaluated = new Map<string, unknown>();
	const crawled = new Set<string>();

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
		if (isRelativeSpecifier(specifier)) return new URL(specifier, from).href;
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
		if (!target || !imports[target]) return null;
		return imports[target];
	};

	const crawl = async (url: string) => {
		if (crawled.has(url)) return;
		crawled.add(url);
		const response = await fetch(url);
		if (!response.ok) {
			throw new Error(`${response.status} ${url}`);
		}
		const text = await response.text();
		texts.set(url, text);
		const source = text.replace(/\/\*[\s\S]*?\*\//g, '');
		await Promise.all(listImportSpecifiers(source).map(async (specifier) => {
			const next = dependencyUrl(url, specifier);
			if (next) await crawl(next);
		}));
	};

	const requireFrom = (from: string) => (id: string) => {
		if (HOST_VUE.has(id) && prefersLocalBuiltin(id, imports, cdnURL)) {
			return toHostModule(builtins.vue);
		}
		const builtinId = localBuiltinId(id);
		if (builtinId) return toHostModule(hostModules[builtinId]);
		if (isRelativeSpecifier(id)) return evaluate(new URL(id, from).href);
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
			production: true,
			filePath: url
		}).code;
		const module = { exports: {} as Record<string, unknown> };
		evaluated.set(url, module.exports);
		const runner = new Function('require', 'module', 'exports', cjs) as (
			require: (id: string) => unknown,
			module: { exports: Record<string, unknown> },
			exports: Record<string, unknown>
		) => void;
		runner(requireFrom(url), module, module.exports);
		evaluated.set(url, module.exports);
		return module.exports;
	};

	return {
		load: async (url: string) => {
			await crawl(url);
			await Promise.all([...pendingBuiltins].map(async (id) => {
				if (id === 'vue' || id === 'vue-router') return;
				hostModules[id] = await ensureLocalBuiltin(id);
			}));
			return evaluate(url);
		}
	};
};
