import { watch } from 'vue';
import type { ReplStore } from '@vue/repl';
import { parse, type Import } from 'es-module-lexer';
import { resolveNpmImport } from '../cdn';
import { createFileIndex, isRelativeSpecifier, resolveModulePath } from './runtime/local/compile/files';
import { rewriteImportMeta, transformScript } from './runtime/local/compile/script';
import * as VueCompiler from '@vue/compiler-sfc/dist/compiler-sfc.esm-browser.js';

const { babelParse, MagicString, walkIdentifiers } = VueCompiler as typeof import('@vue/compiler-sfc');

const moduleSpecifier = (item: Import) => (
	item.type === 'import-meta' || !item.specifier || (item.type === 'dynamic' && item.glob) ? undefined : item.specifier
);

/**
 * 发现自定义 ESM 的传递引用；缺失的 npm 包映射到 CDN，动态依赖只登记地址。
 * @param imports 当前预览的模块覆盖。
 * @param specifiers 源文件实际引用的模块。
 * @returns 补齐后的 import map。
 */
export const resolveReplImports = async (imports: Record<string, string>, specifiers: string[]) => {
	const resolved = { ...imports };
	const visited = new Set<string>();
	const visit = async (specifier: string, importer?: string): Promise<void> => {
		const url = isRelativeSpecifier(specifier) || /^https?:\/\//.test(specifier)
			? new URL(specifier, importer || location.href).href
			: (resolved[specifier] ||= resolveNpmImport(specifier));
		if (visited.has(url) || /\/\+esm(?:[?#]|$)/.test(url)) return;
		visited.add(url);
		const response = await fetch(url);
		if (!response.ok) throw new Error(`${response.status} ${url}`);
		const modules = parse(await response.text())[0];
		await Promise.all(modules.flatMap((item) => {
			const dependency = moduleSpecifier(item);
			return dependency ? [visit(dependency, url)] : [];
		}));
	};
	await Promise.all(specifiers.map(specifier => visit(specifier)));
	return resolved;
};

// REPL 会在移除 export { imported } 后继续替换其中的标识符，改为直接重导出。
const rewriteImportedExports = (code: string) => {
	const statements = babelParse(code, { sourceType: 'module' }).program.body;
	const bindings = new Map<string, { imported: string; source: string; rename: (name: string) => void }>();
	const source = new MagicString(code);
	for (const statement of statements) {
		if (statement.type !== 'ImportDeclaration') continue;
		for (const spec of statement.specifiers) {
			if (spec.type === 'ImportNamespaceSpecifier') continue;
			const imported = spec.type === 'ImportDefaultSpecifier'
				? 'default'
				: spec.imported.type === 'Identifier' ? spec.imported.name : JSON.stringify(spec.imported.value);
			bindings.set(spec.local.name, {
				imported, source: statement.source.value,
				rename: name => source.overwrite(spec.local.start!, spec.local.end!,
					spec.type === 'ImportSpecifier' && spec.imported.start === spec.local.start ? `${imported} as ${name}` : name)
			});
		}
	}
	const aliases = new Map<string, string>();
	const rewritten = new Set<object>();
	for (const statement of statements) {
		if (statement.type !== 'ExportNamedDeclaration' || statement.source || statement.declaration) continue;
		const exports = statement.specifiers.map((spec) => {
			if (spec.type !== 'ExportSpecifier') return '';
			const local = spec.local.name;
			const exported = spec.exported.type === 'Identifier' ? spec.exported.name : JSON.stringify(spec.exported.value);
			const binding = bindings.get(local);
			if (!binding) return `export { ${local} as ${exported} };`;
			if (!aliases.has(local)) {
				const alias = `__docs_reexport_${aliases.size}__`;
				aliases.set(local, alias);
				binding.rename(alias);
			}
			return `export { ${binding.imported} as ${exported} } from ${JSON.stringify(binding.source)};`;
		});
		if (statement.specifiers.some(spec => spec.type === 'ExportSpecifier' && bindings.has(spec.local.name))) {
			source.overwrite(statement.start!, statement.end!, exports.join('\n'));
			rewritten.add(statement);
		}
	}
	for (const statement of statements) {
		if (statement.type === 'ImportDeclaration' || rewritten.has(statement)) continue;
		walkIdentifiers(statement, (id, parent) => {
			const alias = aliases.get(id.name);
			if (!alias) return;
			if (parent?.type === 'ObjectProperty' && parent.shorthand) source.appendLeft(id.end!, `: ${alias}`);
			else source.overwrite(id.start!, id.end!, alias);
		});
	}
	return source.toString();
};

/**
 * REPL 将 ./ 引用按 src 根目录解析，编译结果需要先转成文件表中的完整路径。
 * @param store iframe 预览的文件和编译结果。
 */
export const bindReplModules = (store: ReplStore) => {
	watch(
		() => Object.values(store.files).map(file => [file.filename, file.code, file.compiled.js, file.compiled.ssr]),
		() => {
			const files = createFileIndex(Object.fromEntries(Object.entries(store.files).map(([name, file]) => [name, file.code])));
			const importMap = store.getImportMap();
			const imports = { ...importMap.imports };
			let importsChanged = false;
			for (const file of Object.values(store.files)) {
				for (const output of ['js', 'ssr'] as const) {
					if (!file.compiled[output]) continue;
					try {
						let code = /\.[jt]sx?$/.test(file.filename)
							? transformScript(file.code, file.filename, { esm: true, jsx: /\.[jt]sx$/.test(file.filename) })
							: rewriteImportMeta(file.compiled[output], file.filename);
						code = rewriteImportedExports(code);
						for (const item of [...parse(code)[0]].reverse()) {
							const specifier = moduleSpecifier(item);
							if (!specifier) continue;
							if (isRelativeSpecifier(specifier)) {
								const resolved = resolveModulePath(file.filename, specifier, files);
								if (!resolved) continue;
								const target = `./${resolved.replace(/^\/?src\//, '')}`;
								const text = item.type === 'dynamic' ? JSON.stringify(target) : target;
								code = code.slice(0, item.start) + text + code.slice(item.end);
							} else if (!/^https?:\/\//.test(specifier) && !imports[specifier]) {
								imports[specifier] = resolveNpmImport(specifier);
								importsChanged = true;
							}
						}
						if (file.compiled[output] !== code) file.compiled[output] = code;
					} catch (error) {
						store.errors.push(error instanceof Error ? error : String(error));
					}
				}
			}
			if (importsChanged) store.setImportMap({ ...importMap, imports });
		},
		{ immediate: true }
	);
};
