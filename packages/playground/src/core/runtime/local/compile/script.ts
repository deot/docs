import { transform } from 'sucrase';
import * as VueCompiler from '@vue/compiler-sfc/dist/compiler-sfc.esm-browser.js';

const { babelParse, walkIdentifiers, MagicString } = VueCompiler as typeof import('@vue/compiler-sfc');

// Sucrase 的 JSX parser 不接受 Vue 的 onUpdate:modelValue 属性，转为等价展开属性。
const rewriteJsxAttributes = (code: string) => {
	const replacements: Array<{ start: number; end: number; text: string }> = [];
	for (const match of code.matchAll(/\b([\w-]+:[\w-]+)\s*=\s*\{/g)) {
		let depth = 1;
		let quote = '';
		const start = match.index + match[0].length;
		let end = start;
		for (; end < code.length; end += 1) {
			const character = code[end];
			if (quote) {
				if (character === '\\') end += 1;
				else if (character === quote) quote = '';
			} else if ('"\'`'.includes(character)) quote = character;
			else if (character === '{') depth += 1;
			else if (character === '}' && --depth === 0) break;
		}
		replacements.push({
			start: match.index,
			end: end + 1,
			text: `{...{${JSON.stringify(match[1])}: ${code.slice(start, end)}}}`
		});
	}
	for (const item of replacements.reverse()) code = code.slice(0, item.start) + item.text + code.slice(item.end);
	return code;
};

const removeImportedTypeExports = (code: string) => {
	const types = new Set<string>();
	for (const match of code.matchAll(/\bimport\s+type\s*\{([^}]+)\}\s*from\s*['"][^'"]+['"]/g)) {
		for (const item of match[1].split(',')) types.add(item.trim().split(/\s+as\s+/).pop()!);
	}
	return code.replace(/\bexport\s*\{([^}]+)\}(?!\s*from)/g, (_statement, names: string) => (
		`export {${names.split(',').filter(item => !types.has(item.trim().split(/\s+as\s+/)[0])).join(',')}}`
	));
};

/**
 * files 里的 `import.meta.env` 没有 Vite 注入，接到开发态占位对象上。
 * @param code 源码文本。
 * @param filename 当前虚拟文件名。
 * @returns 替换 `import.meta` 之后的源码。
 */
export const rewriteImportMeta = (code: string, filename: string): string => {
	if (!code.includes('process') && !code.includes('import.meta')) return code;
	const source = new MagicString(code);
	let hasMeta = false;
	walkIdentifiers(babelParse(code, { sourceType: 'module' }), (id, parent, parents) => {
		if (id.name === 'import' && parent?.type === 'MetaProperty') {
			source.overwrite(parent.start!, parent.end!, 'import_meta');
			hasMeta = true;
		}
		const outer = parents[parents.length - 2];
		if (
			id.name === 'process' && parent?.type === 'MemberExpression' && parent.object === id && !parent.computed
			&& parent.property.type === 'Identifier' && parent.property.name === 'env'
			&& outer?.type === 'MemberExpression' && outer.object === parent && !outer.computed
			&& outer.property.type === 'Identifier' && outer.property.name === 'NODE_ENV'
		) source.overwrite(outer.start!, outer.end!, JSON.stringify('development'));
	}, true);
	if (!hasMeta) return source.toString();
	const meta = {
		url: `playground://${filename}`,
		env: {
			MODE: 'development',
			DEV: true,
			PROD: false,
			SSR: false
		}
	};
	return `var import_meta = ${JSON.stringify(meta)};\n${source}`;
};

/**
 * 将 TS / ESM 转成可被 `new Function('require','module','exports', code)` 执行的 CJS。
 * @param code 源码文本。
 * @param filename 当前虚拟文件名，用来判断是否按 TypeScript 转换。
 * @param options 转换选项。
 * @param options.typescript 是否启用 TypeScript 转换。
 * @param options.jsx 是否转换 Vue JSX。
 * @param options.esm 是否保留 ESM 导入导出供 iframe 使用。
 * @returns 可执行的 CJS 文本。
 */
export const transformScript = (
	code: string,
	filename: string,
	options: { typescript?: boolean; jsx?: boolean; esm?: boolean } = {}
): string => {
	const transforms: Array<'typescript' | 'imports' | 'jsx'> = options.esm ? [] : ['imports'];
	const wantTs = options.typescript === true
		|| (
			options.typescript !== false
			&& (
				filename.endsWith('.ts')
				|| filename.endsWith('.tsx')
			)
		);
	if (wantTs) transforms.unshift('typescript');
	if (options.jsx) transforms.unshift('jsx');

	try {
		const script = wantTs ? removeImportedTypeExports(code) : code;
		const source = options.jsx
			? `import { h as __docs_h, Fragment as __docs_Fragment } from 'vue';\n${rewriteJsxAttributes(script)}`
			: script;
		const result = transform(source, {
			transforms,
			disableESTransforms: true,
			production: true,
			jsxRuntime: 'classic',
			jsxPragma: '__docs_h',
			jsxFragmentPragma: '__docs_Fragment',
			filePath: filename
		});
		return `${rewriteImportMeta(result.code, filename)}\n//# sourceURL=playground://${filename}`;
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : String(error);
		throw new Error(`[Playground] 脚本转换失败 ${filename}: ${message}`, { cause: error });
	}
};
