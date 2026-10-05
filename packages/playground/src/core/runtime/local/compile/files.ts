import type { PlaygroundFiles } from '../../../../types';
import { IGNORED_FILENAMES } from './types';

/**
 * 统一成以 `/` 开头的 POSIX 绝对虚拟路径。
 * `App.vue` 与 `/App.vue` 是同一文件，和 iframe 预览使用的 files 键一致。
 * @param filename Playground files 的键或相对路径。
 * @returns 以 `/` 开头的虚拟路径。
 */
export const normalizeVirtualPath = (filename: string): string => {
	const raw = String(filename || '')
		.replace(/\\/gu, '/')
		.trim();
	if (!raw) return '/';

	const absolute = raw.startsWith('/') ? raw : `/${raw}`;
	const parts = absolute.split('/');
	const stack: string[] = [];

	for (const part of parts) {
		if (!part || part === '.') continue;
		if (part === '..') {
			if (stack.length) stack.pop();
			continue;
		}
		stack.push(part);
	}

	return `/${stack.join('/')}`;
};

export const dirname = (filename: string): string => {
	const path = normalizeVirtualPath(filename);
	const index = path.lastIndexOf('/');
	if (index <= 0) return '/';
	return path.slice(0, index) || '/';
};

export const basename = (filename: string): string => {
	const path = normalizeVirtualPath(filename);
	const index = path.lastIndexOf('/');
	return index === -1 ? path : path.slice(index + 1);
};

export const joinVirtualPath = (baseDir: string, relative: string): string => {
	const rel = String(relative || '').replace(/\\/gu, '/');
	if (rel.startsWith('/')) return normalizeVirtualPath(rel);
	const base = normalizeVirtualPath(baseDir);
	const prefix = base === '/' ? '' : base;
	return normalizeVirtualPath(`${prefix}/${rel}`);
};

export const getExtension = (filename: string): string => {
	const name = basename(filename);
	const index = name.lastIndexOf('.');
	if (index <= 0) return '';
	return name.slice(index).toLowerCase();
};

export const isIgnoredFilename = (filename: string): boolean => (
	IGNORED_FILENAMES.has(basename(filename))
);

export const createFileIndex = (files: PlaygroundFiles): Map<string, string> => {
	const index = new Map<string, string>();
	Object.entries(files || {}).forEach(([filename, code]) => {
		const normalized = normalizeVirtualPath(filename);
		if (isIgnoredFilename(normalized)) return;
		index.set(normalized, code);
	});
	return index;
};

export const resolveEntry = (
	files: PlaygroundFiles,
	entry?: string
): string => {
	const index = createFileIndex(files);
	if (!index.size) {
		throw new Error('[Playground] files 为空，无法确定入口');
	}

	if (entry) {
		const normalized = normalizeVirtualPath(entry);
		if (isIgnoredFilename(normalized)) {
			throw new Error(`[Playground] entry 不能是 ${basename(normalized)}`);
		}
		if (!index.has(normalized)) {
			throw new Error(`[Playground] entry 不在 files 中: ${entry}`);
		}
		return normalized;
	}

	for (const key of Object.keys(files || {})) {
		const normalized = normalizeVirtualPath(key);
		if (!isIgnoredFilename(normalized) && index.has(normalized)) {
			return normalized;
		}
	}

	/* istanbul ignore next -- 忽略文件已在前面排除，正常 files 不会走到这里 */
	throw new Error('[Playground] files 中没有可用的入口文件');
};

const CANDIDATE_EXTENSIONS = [
	'.vue',
	'.ts',
	'.js',
	'.tsx',
	'.jsx',
	'.json',
	'.css',
	'.scss',
	'.sass'
];

/**
 * 相对 / 无扩展名解析，行为对齐 Vite：精确路径、补扩展名、`/index.*`。
 * @param fromFilename 发起导入的文件。
 * @param specifier 相对或绝对虚拟路径。
 * @param fileIndex 虚拟路径到 files 键的索引。
 * @returns 解析后的 files 键；找不到时返回 null。
 */
export const resolveModulePath = (
	fromFilename: string,
	specifier: string,
	fileIndex: Map<string, string>
): string | null => {
	if (!specifier || !(specifier.startsWith('./') || specifier.startsWith('../') || specifier.startsWith('/'))) {
		return null;
	}

	const baseDir = dirname(fromFilename);
	const target = joinVirtualPath(baseDir, specifier);
	if (fileIndex.has(target)) return target;

	for (const ext of CANDIDATE_EXTENSIONS) {
		const withExt = `${target}${ext}`;
		if (fileIndex.has(withExt)) return withExt;
	}

	for (const ext of CANDIDATE_EXTENSIONS) {
		const asIndex = `${target}/index${ext}`;
		if (fileIndex.has(asIndex)) return asIndex;
	}

	return null;
};

export const getCommonRoot = (filenames: string[]): string => {
	const normalized = filenames.map(normalizeVirtualPath);
	if (!normalized.length) return '/';
	const split = normalized.map(path => path.split('/').filter(Boolean));
	const first = split[0];
	let depth = first.length;
	for (let i = 1; i < split.length; i += 1) {
		let common = 0;
		while (
			common < depth
			&& common < split[i].length
			&& first[common] === split[i][common]
		) {
			common += 1;
		}
		depth = common;
	}
	if (!depth) return '/';
	const maybeFile = `/${first.slice(0, depth).join('/')}`;
	const isFile = normalized.some(path => path === maybeFile);
	if (isFile) return dirname(maybeFile);
	return maybeFile;
};

export const isInsideRoot = (filename: string, root: string): boolean => {
	const path = normalizeVirtualPath(filename);
	const base = normalizeVirtualPath(root);
	if (base === '/') return true;
	return path === base || path.startsWith(`${base}/`);
};

/**
 * 静态 import / export-from / import() 的模块说明符。
 * @param code 源码文本。
 * @returns 按出现顺序收集到的说明符。
 */
export const listImportSpecifiers = (code: string): string[] => {
	const result: string[] = [];
	const source = String(code || '');
	const re = /(?:\bfrom\s+|import\s*\(\s*|import\s+)['"]([^'"]+)['"]/gu;
	for (const match of source.matchAll(re)) {
		if (match[1]) result.push(match[1]);
	}
	return result;
};

export const isRelativeSpecifier = (id: string) => (
	id.startsWith('./') || id.startsWith('../') || id.startsWith('/')
);

/**
 * 从入口出发只编译静态 import 能走到的文件。
 * @param files 当前 Playground 文件表。
 * @param entry 入口文件名。
 * @returns 可达文件名，入口在最前。
 */
export const collectReachableFilenames = (
	files: PlaygroundFiles,
	entry: string
): string[] => {
	const index = createFileIndex(files);
	const ordered: string[] = [];
	const seen = new Set<string>();

	const visit = (filename: string) => {
		const key = normalizeVirtualPath(filename);
		if (seen.has(key) || !index.has(key)) return;
		seen.add(key);
		ordered.push(key);
		const specifiers = listImportSpecifiers(index.get(key) || '');
		specifiers.forEach((specifier) => {
			const resolved = resolveModulePath(key, specifier, index);
			if (resolved) visit(resolved);
		});
	};

	visit(entry);
	return ordered;
};

export const collectBareSpecifiers = (
	files: PlaygroundFiles,
	filenames: string[]
): string[] => {
	const index = createFileIndex(files);
	const result: string[] = [];
	const seen = new Set<string>();
	filenames.forEach((filename) => {
		listImportSpecifiers(index.get(normalizeVirtualPath(filename)) || '').forEach((specifier) => {
			if (!specifier || isRelativeSpecifier(specifier) || seen.has(specifier)) return;
			seen.add(specifier);
			result.push(specifier);
		});
	});
	return result;
};
