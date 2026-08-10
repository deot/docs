import { init, parse } from 'es-module-lexer';
import { getDocsBase } from './resolver';
import type { DocsConfig, DocsResourceType } from '../types';

const SUPPORTED_DEPENDENCY_RE = /\.(?:vue|[jt]s|css)(?:$|[?#])/i;
const STYLE_IMPORT_RE = /@import\s+(?:url\(\s*(?:(['"])(.*?)\1|([^'")\s]+))\s*\)|(['"])(.*?)\4)/gi;
const SFC_BLOCK_RE = /<(script|style)\b([^>]*)>([\s\S]*?)<\/\1>/gi;
const SOURCE_ATTRIBUTE_RE = /\bsrc\s*=\s*(['"])(.*?)\1/i;

export const getResourceType = (url: string): DocsResourceType => {
	if (/\.vue(?:$|[?#])/i.test(url)) return 'sfc';
	if (/\.css(?:$|[?#])/i.test(url)) return 'style';
	return 'module';
};

export const isSupportedDependency = (value: string) => (
	value.startsWith('.') && SUPPORTED_DEPENDENCY_RE.test(value)
);

export const resolveDependencyUrl = (specifier: string, importer: string) => {
	const fallbackBase = typeof location === 'undefined' ? 'http://localhost/' : location.href;
	return new URL(specifier, new URL(importer, fallbackBase)).href;
};

const collectStyleImports = (code: string) => (
	[...code.matchAll(STYLE_IMPORT_RE)].map(match => match[2] || match[3] || match[5])
);

const collectModuleImports = async (code: string) => {
	await init;
	return parse(code)[0].map(item => item.n).filter((item): item is string => Boolean(item));
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
		const workspace = `/${String(config.runtime.workspace || '/site/')
			.replace(/^\/+|\/+$/g, '')}/`;
		root = new URL(`${workspace}${lang.replace(/^\/+|\/+$/g, '')}/`, fallbackBase);
	} else {
		root = new URL(`${lang.replace(/^\/+|\/+$/g, '')}/`, getDocsBase(config));
	}
	if (resolved.origin !== root.origin || !resolved.pathname.startsWith(root.pathname)) {
		return resolved.href;
	}
	return `./${resolved.pathname.slice(root.pathname.length)}${resolved.search}${resolved.hash}`;
};
