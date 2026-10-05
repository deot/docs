import { transform } from 'sucrase';

/**
 * files 里的 `import.meta.env` 没有 Vite 注入，接到开发态占位对象上。
 * @param code 源码文本。
 * @param filename 当前虚拟文件名。
 * @returns 替换 `import.meta` 之后的源码。
 */
export const rewriteImportMeta = (code: string, filename: string): string => {
	if (!code.includes('import.meta')) return code;
	const meta = {
		url: `playground://${filename}`,
		env: {
			MODE: 'development',
			DEV: true,
			PROD: false,
			SSR: false
		}
	};
	return `var import_meta = ${JSON.stringify(meta)};\n${code.replaceAll('import.meta', 'import_meta')}`;
};

/**
 * 将 TS / ESM 转成可被 `new Function('require','module','exports', code)` 执行的 CJS。
 * @param code 源码文本。
 * @param filename 当前虚拟文件名，用来判断是否按 TypeScript 转换。
 * @param options 转换选项。
 * @param options.typescript 是否启用 TypeScript 转换。
 * @returns 可执行的 CJS 文本。
 */
export const transformScript = (
	code: string,
	filename: string,
	options: { typescript?: boolean } = {}
): string => {
	const transforms: Array<'typescript' | 'imports'> = ['imports'];
	const wantTs = options.typescript === true
		|| (
			options.typescript !== false
			&& (
				filename.endsWith('.ts')
				|| filename.endsWith('.tsx')
			)
		);
	if (wantTs) transforms.unshift('typescript');

	try {
		const withMeta = rewriteImportMeta(code, filename);
		const result = transform(withMeta, {
			transforms,
			production: true,
			filePath: filename
		});
		return `${result.code}\n//# sourceURL=playground://${filename}`;
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : String(error);
		throw new Error(`[Playground] 脚本转换失败 ${filename}: ${message}`, { cause: error });
	}
};
