import type { PlaygroundFiles } from '../../../types';
import type { CompileResult, LinkResult } from './compile/types';
import {
	createFileIndex,
	getCommonRoot,
	isInsideRoot,
	isRelativeSpecifier,
	normalizeVirtualPath,
	resolveModulePath
} from './compile/files';
import { resolveHostModule } from './modules';
import { createGuardedVue, type VueGuardCapture } from './vue-guard';

export interface LinkOptions {
	modules?: Record<string, unknown>;
}

/**
 * 在当前页面链接编译结果，返回入口组件。不创建第二份 Vue。
 * @param compiled 浏览器编译结果。
 * @param files 当前 Playground 文件表。
 * @param options 可选的宿主模块表。
 * @returns 入口组件、样式和链接错误。
 */
export const linkPlayground = (
	compiled: CompileResult,
	files: PlaygroundFiles,
	options: LinkOptions = {}
): LinkResult => {
	const errors = [...(compiled.errors || [])];
	if (!compiled.entry || errors.length) {
		return { component: null, css: compiled.css || [], errors };
	}

	const capture: VueGuardCapture = {
		mountedComponent: null,
		components: {},
		provides: {}
	};
	const modules: Record<string, unknown> = {
		...(options.modules || {}),
		vue: createGuardedVue(capture)
	};
	const fileIndex = createFileIndex(files);
	const root = getCommonRoot([...fileIndex.keys()]);
	const cache = new Map<string, unknown>();
	const visiting = new Set<string>();

	const requireFn = (fromFilename: string) => (id: string) => {
		if (isRelativeSpecifier(id)) {
			const resolved = resolveModulePath(fromFilename, id, fileIndex);
			if (!resolved) {
				throw new Error(`[Playground] 无法解析相对模块 "${id}"（来自 ${fromFilename}）`);
			}
			/* istanbul ignore if -- 公共根已包含全部 files，正常解析不会逃出 */
			if (!isInsideRoot(resolved, root)) {
				throw new Error(`[Playground] 模块逃出虚拟根: ${resolved}`);
			}
			return loadModule(resolved);
		}

		const host = resolveHostModule(id, modules);
		if (host) return host;
		throw new Error(
			`[Playground] 未注册的模块 "${id}"。请在 import map 中提供可加载的地址。`
		);
	};

	const loadModule = (filename: string): unknown => {
		const key = normalizeVirtualPath(filename);
		if (cache.has(key)) return cache.get(key);
		if (visiting.has(key)) return cache.get(key);

		const mod = compiled.modules[key];
		if (!mod) throw new Error(`[Playground] 缺少编译模块: ${key}`);

		const module = { exports: {} as Record<string, unknown> };
		cache.set(key, module.exports);
		visiting.add(key);
		try {
			const runner = new Function('require', 'module', 'exports', mod.js) as (
				require: (id: string) => unknown,
				module: { exports: Record<string, unknown> },
				exports: Record<string, unknown>
			) => void;
			runner(requireFn(key), module, module.exports);
			cache.set(key, module.exports);
			return module.exports;
		} catch (error: unknown) {
			const message = error instanceof Error ? error.message : String(error);
			errors.push(`[Playground] 执行失败 ${key}: ${message}`);
			throw error;
		} finally {
			visiting.delete(key);
		}
	};

	try {
		const entryExports = loadModule(compiled.entry) as { default?: unknown } | undefined;
		let component = entryExports?.default ?? entryExports;
		if (capture.mountedComponent) component = capture.mountedComponent;
		/* istanbul ignore if -- 空入口在编译阶段已经报错 */
		if (!component) {
			errors.push('[Playground] 入口必须 export default 组件，或调用 createApp(App).mount()');
			return { component: null, css: compiled.css || [], errors };
		}
		return { component, css: compiled.css || [], errors };
	} catch (error: unknown) {
		if (!errors.length) {
			errors.push(error instanceof Error ? error.message : String(error));
		}
		return { component: null, css: compiled.css || [], errors };
	}
};
