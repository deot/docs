import { compileString, type StringOptions } from 'sass';
import type { PlaygroundFiles } from '../../../../types';
import {
	compileScssSource,
	type SassCompiler
} from '../../../scss';

/**
 * 直接渲染使用已安装的 sass，importer 与 iframe 预览共用，不注入额外 BEM。
 */
const compiler: SassCompiler = {
	compileString(source, options) {
		const result = compileString(source, options as StringOptions<'sync'>);
		return { css: result.css };
	}
};

const toScssFiles = (files: PlaygroundFiles): Record<string, string> => {
	const map: Record<string, string> = {};
	Object.entries(files || {}).forEach(([filename, code]) => {
		const normalized = filename.replace(/\\/gu, '/');
		map[normalized] = code;
		map[normalized.replace(/^\/+/u, '')] = code;
	});
	return map;
};

export const compileLocalScss = (
	source: string,
	filename: string,
	files: PlaygroundFiles,
	lang?: string
): string => {
	try {
		return compileScssSource(
			source,
			filename.replace(/^\/+/u, ''),
			compiler,
			toScssFiles(files),
			lang
		);
	} catch (error: unknown) {
		/* istanbul ignore next -- Sass 失败时 message 总是字符串 */
		const message = error instanceof Error ? error.message : String(error);
		throw new Error(`[Playground] SCSS 编译失败 ${filename}: ${message}`, { cause: error });
	}
};
