import type { PlaygroundFiles } from '../../../../types';
import type { CompiledModule, CompileResult } from './types';
import {
	collectReachableFilenames,
	createFileIndex,
	getExtension,
	normalizeVirtualPath,
	resolveEntry
} from './files';
import { transformScript } from './script';
import { compileSfc } from './sfc';
import { compileLocalScss } from './scss';
import { collectCss } from './css';
import { extractScssExports } from '../../../scss';

export interface CompilePlaygroundOptions {
	entry?: string;
}

const JSON_IDENT = /^[$A-Z_][0-9A-Z_$]*$/iu;

const messageOf = (error: unknown) => (
	error instanceof Error ? error.message : String(error)
);

/**
 * Vite 语义：default 是整份对象，合法标识符键再挂成具名导出。
 * @param parsed JSON.parse 的结果。
 * @param filename 当前虚拟文件名，写入 sourceURL。
 * @returns 可执行的 CJS 文本。
 */
const transformJson = (parsed: unknown, filename: string): string => {
	const lines = [`exports.default = ${JSON.stringify(parsed)};`];
	if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
		Object.keys(parsed as Record<string, unknown>).forEach((key) => {
			if (!JSON_IDENT.test(key) || key === '__esModule' || key === 'default') return;
			lines.push(`exports[${JSON.stringify(key)}] = exports.default[${JSON.stringify(key)}];`);
		});
	}
	lines.push(`//# sourceURL=playground://${filename}`);
	return lines.join('\n');
};

const compileOne = async (
	filename: string,
	code: string,
	files: PlaygroundFiles
): Promise<CompiledModule & { errors: string[] }> => {
	const ext = getExtension(filename);
	const errors: string[] = [];

	if (ext === '.vue') {
		if (/lang\s*=\s*["']jsx["']/iu.test(code) || /lang\s*=\s*["']tsx["']/iu.test(code)) {
			errors.push(`[Playground] JSX/TSX 暂不支持: ${filename}`);
			return { filename, js: 'exports.default = {}', css: '', errors };
		}
		const result = await compileSfc(code, filename, files);
		errors.push(...result.errors);
		const js = transformScript(result.js, filename, { typescript: true });
		return { filename, js, css: result.css, errors };
	}

	if (ext === '.css') {
		return {
			filename,
			js: `exports.default = {};\n//# sourceURL=playground://${filename}`,
			css: code,
			errors
		};
	}

	if (ext === '.scss' || ext === '.sass') {
		try {
			const { css, exports: styleExports } = extractScssExports(compileLocalScss(code, filename, files), filename);
			return {
				filename,
				js: `exports.__esModule = true; exports.default = ${JSON.stringify(styleExports)};\n//# sourceURL=playground://${filename}`,
				css,
				errors
			};
		} catch (error: unknown) {
			errors.push(messageOf(error));
			return { filename, js: 'exports.default = {};', css: '', errors };
		}
	}

	if (ext === '.json') {
		try {
			const parsed = JSON.parse(code) as unknown;
			return { filename, js: transformJson(parsed, filename), css: '', errors };
		} catch (error: unknown) {
			errors.push(`[Playground] JSON 解析失败 ${filename}: ${messageOf(error)}`);
			return { filename, js: 'exports.default = {};', css: '', errors };
		}
	}

	if (ext === '.js' || ext === '.ts' || ext === '.jsx' || ext === '.tsx') {
		try {
			const js = transformScript(code, filename, { typescript: ext === '.ts' || ext === '.tsx', jsx: ext === '.jsx' || ext === '.tsx' });
			return { filename, js, css: '', errors };
		} catch (error: unknown) {
			errors.push(messageOf(error));
			return { filename, js: 'exports.default = {};', css: '', errors };
		}
	}

	errors.push(`[Playground] 不支持的文件类型: ${filename}`);
	return { filename, js: 'exports.default = {};', css: '', errors };
};

/**
 * 浏览器内编译整份 files。入口和相对路径与 Playground 的 files 键一致。
 * @param files 当前 Playground 文件表。
 * @param entryOrOptions 入口文件名，或带入口的编译选项。
 * @returns 编译出的模块、样式和错误。
 */
export const compilePlayground = async (
	files: PlaygroundFiles,
	entryOrOptions?: string | CompilePlaygroundOptions
): Promise<CompileResult> => {
	const options = typeof entryOrOptions === 'string'
		? { entry: entryOrOptions }
		: (entryOrOptions || {});
	const errors: string[] = [];
	let entry: string;

	try {
		entry = resolveEntry(files, options.entry);
	} catch (error: unknown) {
		return {
			entry: '',
			modules: {},
			css: [],
			errors: [messageOf(error)]
		};
	}

	const fileIndex = createFileIndex(files);
	const reachable = collectReachableFilenames(files, entry);
	const modules: Record<string, CompiledModule> = {};
	const cssChunks: string[] = [];

	for (const filename of reachable) {
		const code = fileIndex.get(filename);
		if (typeof code !== 'string') continue;
		const compiled = await compileOne(filename, code, files);
		errors.push(...compiled.errors);
		modules[filename] = {
			filename,
			js: compiled.js,
			css: compiled.css
		};
		cssChunks.push(...collectCss([compiled.css]));
	}

	const normalizedEntry = normalizeVirtualPath(entry);
	/* istanbul ignore if -- 可达编译总会留下入口模块 */
	if (!modules[normalizedEntry]) {
		errors.push(`[Playground] 入口编译结果缺失: ${normalizedEntry}`);
	}

	return {
		entry: normalizedEntry,
		modules,
		css: cssChunks,
		errors
	};
};
