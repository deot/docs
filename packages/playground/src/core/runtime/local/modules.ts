import { resolveNpmImport } from '../../../cdn';
import { ensureLocalBuiltin, localBuiltinIds } from './builtins';

type HostModule = Record<string | symbol, unknown>;

const SKIP_COPY_KEYS = new Set(['prototype', 'caller', 'arguments']);

export const toHostModule = (ns: unknown): HostModule => {
	if (ns == null || (typeof ns !== 'object' && typeof ns !== 'function')) {
		return { __esModule: true, default: ns };
	}

	const source = ns as Record<string, unknown>;
	const mod: HostModule = { __esModule: true };
	const assignKey = (key: string) => {
		if (SKIP_COPY_KEYS.has(key) || key === '__esModule') return;
		try {
			mod[key] = source[key];
		} catch {
			// 个别导出不可读时跳过，保留其余具名导出。
		}
	};

	try {
		Object.keys(source).forEach(assignKey);
	} catch {
		// ignore
	}
	try {
		Object.getOwnPropertyNames(source).forEach(assignKey);
	} catch {
		// ignore
	}

	if (!('default' in mod) || mod.default === undefined) {
		mod.default = source.default !== undefined ? source.default : source;
	}
	return mod;
};

const lookupHostModule = (
	id: string,
	modules: Record<string, unknown>
): HostModule | null => {
	if (Object.prototype.hasOwnProperty.call(modules, id)) {
		return toHostModule(modules[id]);
	}
	return null;
};

const pickNestedExport = (rootMod: HostModule, rest: string): unknown => {
	if (!rest) return undefined;
	const parts = rest.split('/').filter(Boolean);
	let current: unknown = rootMod;
	for (const part of parts) {
		if (current == null || (typeof current !== 'object' && typeof current !== 'function')) {
			return undefined;
		}
		const record = current as Record<string, unknown>;
		if (!(part in record)) return undefined;
		current = record[part];
	}
	return current;
};

/**
 * 先精确匹配，再从右往左剥路径，把剩余段当成导出属性。
 * 模块表只来自当前 Playground，不写入全局注册表。
 * @param id 裸模块说明符。
 * @param modules 当前 Playground 的模块表。
 * @returns 可被 `require` 使用的模块；找不到时返回 null。
 */
export const resolveHostModule = (
	id: string,
	modules: Record<string, unknown>
): HostModule | null => {
	const exact = lookupHostModule(id, modules);
	if (exact) return exact;

	let cursor = id;
	while (true) {
		const slash = cursor.lastIndexOf('/');
		if (slash <= 0) break;
		const parent = cursor.slice(0, slash);
		const rest = id.slice(parent.length + 1);
		const rootMod = lookupHostModule(parent, modules);
		if (rootMod) {
			const nested = pickNestedExport(rootMod, rest);
			if (nested !== undefined) return toHostModule(nested);
		}
		cursor = parent;
	}
	return null;
};

const HOST_VUE_SPECIFIERS = new Set(['vue', 'vue/server-renderer']);
const VUE_DEPENDENT_BUILTINS = new Set([
	'vue/server-renderer', 'vue-router', 'pinia',
	'@deot/vc', '@deot/vc-components', '@deot/vc-hooks', '@deot/vc-locale'
]);

export interface LoadLocalModulesResult {
	modules: Record<string, unknown>;
	errors: string[];
}

export type ModuleLoader = (url: string) => Promise<unknown>;

const messageOf = (error: unknown) => (
	error instanceof Error ? error.message : String(error)
);

/**
 * 找到 import map 里能覆盖该说明符的键。子路径没有独立 URL 时回退到父包。
 * @param id 裸模块说明符。
 * @param imports 合并后的 import map。
 * @returns 命中的 import map 键；没有地址时返回 null。
 */
export const resolveImportTarget = (
	id: string,
	imports: Record<string, string>
): string | null => {
	if (imports[id]) return id;
	let cursor = id;
	while (true) {
		const slash = cursor.lastIndexOf('/');
		if (slash <= 0) return null;
		const parent = cursor.slice(0, slash);
		if (imports[parent]) return parent;
		cursor = parent;
	}
};

// 未覆盖的模块继承宿主；覆盖 Vue 时，只联动重新加载依赖 Vue 的内置模块。
export const prefersLocalBuiltin = (
	id: string,
	imports: Record<string, string>,
	overrides: ReadonlySet<string> = new Set(Object.keys(imports))
): boolean => {
	if (!localBuiltinIds.has(id) && !HOST_VUE_SPECIFIERS.has(id)) return false;
	if (overrides.has(id)) return false;
	return !VUE_DEPENDENT_BUILTINS.has(id) || !overrides.has('vue');
};

/**
 * 内置依赖默认注入宿主副本，显式 URL 按模块覆盖，包括与默认 CDN 相同的地址。
 * @param specifiers 本次预览用到的裸模块说明符。
 * @param imports 合并后的 import map。
 * @param builtins 宿主 Vue 与 vue-router。
 * @param builtins.vue 当前页面的 Vue 模块。
 * @param builtins.vueRouter 打包进来的 vue-router，可被 import map 覆盖。
 * @param loader 按 URL 加载远程模块。
 * @param overrides 显式配置的模块名，与自动补齐的默认地址区分。
 * @returns 模块表和加载错误。
 */
export const loadLocalModules = async (
	specifiers: string[],
	imports: Record<string, string>,
	builtins: { vue: unknown; vueRouter: unknown },
	loader: ModuleLoader,
	overrides: ReadonlySet<string> = new Set(Object.keys(imports))
): Promise<LoadLocalModulesResult> => {
	const modules: Record<string, unknown> = {
		'vue': builtins.vue,
		'vue-router': builtins.vueRouter
	};
	const errors: string[] = [];
	const targets = new Set<string>();
	const localIds = new Set<string>();

	specifiers.forEach((specifier) => {
		let local = false;
		if (prefersLocalBuiltin(specifier, imports, overrides)) localIds.add(specifier);
		else {
			let cursor = specifier;
			while (true) {
				const slash = cursor.lastIndexOf('/');
				if (slash <= 0) break;
				const parent = cursor.slice(0, slash);
				if (prefersLocalBuiltin(parent, imports, overrides)) {
					localIds.add(parent);
					local = true;
					break;
				}
				cursor = parent;
			}
		}
		const target = resolveImportTarget(specifier, imports);
		if (target && prefersLocalBuiltin(target, imports, overrides)) localIds.add(target);
		else if (target) targets.add(target);
		else if (!local && !localIds.has(specifier)) {
			imports[specifier] = resolveNpmImport(specifier);
			targets.add(specifier);
		}
	});

	await Promise.all([...localIds].map(async (id) => {
		if (id === 'vue' || id === 'vue-router') return;
		if (id === 'vue/server-renderer') {
			modules[id] = builtins.vue;
			return;
		}
		modules[id] = await ensureLocalBuiltin(id);
	}));

	for (const id of targets) {
		const url = imports[id];
		if (!url || prefersLocalBuiltin(id, imports, overrides)) continue;
		try {
			modules[id] = await loader(url);
		} catch (error: unknown) {
			errors.push(`[Playground] 无法加载模块 "${id}" (${url}): ${messageOf(error)}`);
		}
	}

	return { modules, errors };
};
