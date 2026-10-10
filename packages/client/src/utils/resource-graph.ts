import { init, parse } from 'es-module-lexer';
import { getDocsBase, normalizeWorkspaceBase, trimSlashes } from './resolver';
import type { DocsConfig, DocsResourceType } from '../types';

const SUPPORTED_DEPENDENCY_RE = /\.(?:vue|[jt]sx?|json|css|scss|sass)(?:$|[?#])/i;
const STYLE_IMPORT_RE = /@(?:import|use|forward)\s+(?:url\(\s*(?:(['"])(.*?)\1|([^'")\s]+))\s*\)|(['"])(.*?)\4)/gi;
const SFC_BLOCK_RE = /<(script|style)\b([^>]*)>([\s\S]*?)<\/\1>/gi;
const SOURCE_ATTRIBUTE_RE = /\bsrc\s*=\s*(['"])(.*?)\1/i;

export const getResourceType = (url: string): DocsResourceType => {
	if (/\.vue(?:$|[?#])/i.test(url)) return 'sfc';
	if (/\.(?:css|scss|sass)(?:$|[?#])/i.test(url)) return 'style';
	return 'module';
};

export const isSupportedDependency = (value: string) => (
	value.startsWith('.') && (SUPPORTED_DEPENDENCY_RE.test(value) || /\.m(?:$|[?#])/.test(value) || !/\.[^/]+$/.test(value.split(/[?#]/)[0]))
);

export const resolveDependencyUrl = (specifier: string, importer: string) => {
	const fallbackBase = typeof location === 'undefined' ? 'http://localhost/' : location.href;
	return new URL(specifier, new URL(importer, fallbackBase)).href;
};

const collectStyleImports = (code: string) => (
	[...code.matchAll(STYLE_IMPORT_RE)]
		.map(match => match[2] || match[3] || match[5])
		.filter(value => !/^(?:[a-z][a-z\d+.-]*:|\/)/i.test(value))
		.map(value => value.startsWith('.') ? value : `./${value}`)
);

const collectModuleImports = async (code: string) => {
	await init();
	try {
		return parse(code)[0].flatMap((item) => {
			if (item.type === 'dynamic') return item.specifier && !item.glob ? [item.specifier] : [];
			if (item.type === 'import-meta' || item.typeOnly) return [];
			return [item.specifier];
		});
	} catch {
		// JSX 不是 es-module-lexer 的输入语言，仍可读取其静态模块引用。
		// 类型声明只移除自身的绑定及可选来源，不跨越下一条语句。
		const source = code.replace(
			/\b(?:import|export)\s+type\b(?!\s+from\b)\s*(?:\{[^}]*\}|\*\s+as\s+[\w$]+|[\w$]+)(?:\s+from\s*(['"])[^'"]+\1)?\s*;?/g,
			''
		);
		return [...source.matchAll(/(?:\bfrom\s+|import\s*\(\s*|import\s+)['"]([^'"]+)['"]/g)]
			.map(match => match[1]);
	}
};

/*
 * 在不编译资源的情况下提取依赖。es-module-lexer 只能识别 JavaScript，
 * 因此需要单独处理 SFC 的 `src` 属性和 CSS import。
 */
export const collectResourceImports = async (code: string, type: DocsResourceType) => {
	if (type === 'style') return [...new Set(collectStyleImports(code))];
	if (type !== 'sfc') return [...new Set(await collectModuleImports(code))];

	const imports: string[] = [];
	for (const match of code.matchAll(SFC_BLOCK_RE)) {
		const [, blockType, attributes, content] = match;
		const source = attributes.match(SOURCE_ATTRIBUTE_RE)?.[2];
		if (source) imports.push(source);
		imports.push(...(blockType.toLowerCase() === 'style'
			? collectStyleImports(content)
			: await collectModuleImports(content)));
	}
	return [...new Set(imports)];
};

/*
 * 将已解析的依赖 URL 转回 dev watcher 发出的逻辑 source。配置的
 * workspace/base 之外仍保留绝对地址，避免路径相同的两个 CDN 意外
 * 共用同一个 Gateway identity。
 */
export const toLogicalResourceSource = (
	config: DocsConfig,
	lang: string,
	url: string
) => {
	const fallbackBase = typeof location === 'undefined' ? 'http://localhost/' : location.href;
	const resolved = new URL(url, fallbackBase);
	let root: URL;
	if (config.runtime?.mode === 'development') {
		const workspace = normalizeWorkspaceBase(config.runtime.workspace);
		root = new URL(`${workspace}${trimSlashes(lang)}/`, fallbackBase);
	} else {
		root = new URL(`${trimSlashes(lang)}/`, getDocsBase(config));
	}
	if (resolved.origin !== root.origin || !resolved.pathname.startsWith(root.pathname)) {
		return resolved.href;
	}
	return `./${resolved.pathname.slice(root.pathname.length)}${resolved.search}${resolved.hash}`;
};

/**
 * 远程静态文件没有 Vite 的扩展名补全，按源码类型探测实际文件。
 * @param specifier 源码中的相对引用。
 * @param importer 发起引用的源文件 URL。
 * @param style 是否使用 Sass 样式路径规则。
 * @returns 按优先级排列的候选 URL。
 */
export const dependencyUrlCandidates = (specifier: string, importer: string, style = false) => {
	const url = new URL(resolveDependencyUrl(specifier, importer));
	const path = url.pathname.replace(/\/$/, '');
	const partial = (value: string) => value.replace(/([^/]+)$/, '_$1');
	const hasExtension = SUPPORTED_DEPENDENCY_RE.test(path);
	const paths = style
		? (hasExtension
				? [path, partial(path)]
				: ['.scss', '.sass', '.css'].flatMap(ext => [
						`${path}${ext}`, partial(`${path}${ext}`), `${path}/index${ext}`, `${path}/_index${ext}`
					]))
		: (hasExtension
				? [path]
				: [path, ...['.vue', '.ts', '.js', '.tsx', '.jsx', '.json'].map(ext => `${path}${ext}`),
						...['.vue', '.ts', '.js', '.tsx', '.jsx', '.json'].map(ext => `${path}/index${ext}`)]);
	return [...new Set(paths)].map((value) => {
		const candidate = new URL(url);
		candidate.pathname = value;
		return candidate.href;
	});
};

export const collectResourceStyleImports = (code: string, type: DocsResourceType) => {
	if (type === 'style') return collectStyleImports(code);
	if (type !== 'sfc') return [];
	return [...code.matchAll(SFC_BLOCK_RE)]
		.filter(match => match[1].toLowerCase() === 'style')
		.flatMap(match => collectStyleImports(match[3]));
};

export const resolveDependencyRequestUrl = (url: string) => {
	const resolved = new URL(url, typeof location === 'undefined' ? 'http://localhost/' : location.href);
	if (resolved.hostname !== 'raw.githubusercontent.com') return url;
	const marker = '/node_modules/';
	const index = resolved.pathname.indexOf(marker);
	return index < 0 ? url : `https://cdn.jsdelivr.net/npm/${resolved.pathname.slice(index + marker.length)}${resolved.search}`;
};
