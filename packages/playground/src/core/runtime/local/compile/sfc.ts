import type { BindingMetadata } from '@vue/compiler-sfc';
import type { PlaygroundFiles } from '../../../../types';
import { compileLocalScss } from './scss';

type CompilerSfc = typeof import('@vue/compiler-sfc');

let compilerPromise: Promise<CompilerSfc> | null = null;

/**
 * 只加载浏览器构建，避免 `@vue/compiler-sfc` 的 Node 主入口碰文件系统。
 * @returns 浏览器版 compiler-sfc。
 */
export const loadCompiler = (): Promise<CompilerSfc> => {
	compilerPromise ??= import(
		'@vue/compiler-sfc/dist/compiler-sfc.esm-browser.js'
	).then((mod) => {
		const resolved = mod as { default?: CompilerSfc };
		return (resolved.default || mod) as CompilerSfc;
	});
	return compilerPromise;
};

export interface CompileSfcResult {
	js: string;
	css: string;
	errors: string[];
}

const hashId = (filename: string): string => {
	let hash = 0;
	for (let i = 0; i < filename.length; i += 1) {
		hash = ((hash << 5) - hash) + filename.charCodeAt(i);
		hash |= 0;
	}
	return Math.abs(hash).toString(36).slice(0, 8);
};

const messageOf = (error: unknown) => (
	error instanceof Error ? error.message : String(error)
);

const isScssLang = (lang?: string) => lang === 'scss' || lang === 'sass';
const isSupportedStyleLang = (lang?: string) => !lang || lang === 'css' || isScssLang(lang);

export const compileSfc = async (
	code: string,
	filename: string,
	files: PlaygroundFiles = {}
): Promise<CompileSfcResult> => {
	const compiler = await loadCompiler();
	const errors: string[] = [];
	const id = hashId(filename);
	const { descriptor, errors: parseErrors } = compiler.parse(code, {
		filename,
		sourceMap: false
	});

	parseErrors.forEach((error) => {
		errors.push(messageOf(error));
	});
	if (errors.length) {
		return { js: 'export default {}', css: '', errors };
	}

	const srcBlock = [
		descriptor.script,
		descriptor.scriptSetup,
		descriptor.template,
		...descriptor.styles
	].find(block => block?.src);
	if (srcBlock) {
		errors.push(
			`[Playground] 不支持 <${srcBlock.type} src>，请把源码放进 files。文件: ${filename}`
		);
		return { js: 'export default {}', css: '', errors };
	}

	const hasScript = !!(descriptor.script || descriptor.scriptSetup);
	const isTS = !!(
		descriptor.script?.lang?.startsWith('ts')
		|| descriptor.scriptSetup?.lang?.startsWith('ts')
	);

	let clientCode: string;
	let bindings: BindingMetadata | undefined;
	if (hasScript) {
		try {
			const scriptResult = compiler.compileScript(descriptor, {
				id,
				inlineTemplate: true,
				genDefaultAs: '__sfc__',
				templateOptions: {
					filename,
					id,
					scoped: descriptor.styles.some(style => style.scoped)
				}
			});
			clientCode = scriptResult.content;
			bindings = scriptResult.bindings;
		} catch (error: unknown) {
			errors.push(`[Playground] compileScript ${filename}: ${messageOf(error)}`);
			return { js: 'export default {}', css: '', errors };
		}
	} else {
		clientCode = 'const __sfc__ = {};';
	}

	const templateInlined = !!(descriptor.scriptSetup && hasScript);
	if (descriptor.template && !templateInlined) {
		try {
			const templateResult = compiler.compileTemplate({
				id,
				filename,
				source: descriptor.template.content,
				scoped: descriptor.styles.some(style => style.scoped),
				compilerOptions: {
					bindingMetadata: bindings,
					isTS
				}
			});
			if (templateResult.errors?.length) {
				templateResult.errors.forEach((error) => {
					errors.push(messageOf(error));
				});
			} else {
				clientCode += `\n${templateResult.code}`;
				clientCode += '\n__sfc__.render = typeof render === "function" ? render : exports.render;';
			}
		} catch (error: unknown) {
			errors.push(`[Playground] compileTemplate ${filename}: ${messageOf(error)}`);
		}
	}

	if (descriptor.styles.some(style => style.scoped)) {
		clientCode += `\n__sfc__.__scopeId = ${JSON.stringify(`data-v-${id}`)};`;
	}
	clientCode += `\n__sfc__.__file = ${JSON.stringify(filename)};`;
	clientCode += '\nexport default __sfc__;';

	let css = '';
	for (const style of descriptor.styles) {
		if (!isSupportedStyleLang(style.lang)) {
			errors.push(
				`[Playground] <style lang="${style.lang}"> 暂不支持（仅 CSS / SCSS / Sass）。文件: ${filename}`
			);
			continue;
		}
		let source = style.content;
		if (isScssLang(style.lang)) {
			try {
				source = compileLocalScss(source, filename, files, style.lang);
			} catch (error: unknown) {
				errors.push(messageOf(error));
				continue;
			}
		}
		try {
			const styleResult = await compiler.compileStyleAsync({
				id: style.scoped ? `data-v-${id}` : id,
				filename,
				source,
				scoped: !!style.scoped
			});
			if (styleResult.errors?.length) {
				styleResult.errors.forEach((error) => {
					errors.push(messageOf(error));
				});
			} else {
				css += `${styleResult.code}\n`;
			}
		} catch (error: unknown) {
			/* istanbul ignore next -- 样式编译失败会走 errors 数组，这里只兜底抛错 */
			errors.push(`[Playground] compileStyle ${filename}: ${messageOf(error)}`);
		}
	}

	return { js: clientCode, css, errors };
};
