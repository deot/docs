import type {
	DocsConfig,
	DocsResourceContext,
	DocsResourceType,
	ResourceIdentity
} from '../types';
import { isExternalLink } from './link';

/**
 * 去掉路径两端的斜杠，便于拼接目录前缀。
 * @param value 原始路径。
 * @returns 不含首尾斜杠的路径。
 */
export const trimSlashes = (value: string) => value.replace(/^\/+|\/+$/g, '');
const docsBaseCache = new WeakMap<DocsConfig, string>();
const deploymentBaseCache = new WeakMap<DocsConfig, string>();

/**
 * 将 Runtime workspace 规范为绝对目录前缀。根目录必须保持单个 `/`，
 * 否则 `//{lang}` 会被浏览器解释为以语言名为主机的协议相对 URL。
 * `value` 来自 dever 注入的 `ResolvedDocsWorkspace.urlBase`。
 * @param value Runtime 注入的 workspace。
 * @returns 以单个斜杠开头和结尾的目录前缀。
 */
export const normalizeWorkspaceBase = (value = '/site/') => {
	const pathname = trimSlashes(value);
	return pathname ? `/${pathname}/` : '/';
};

/**
 * 在 Vue Router 修改浏览器地址前推导部署目录。
 * @param config 用于识别语言路径段的文档配置。
 * @returns 稳定的部署目录绝对地址。
 */
const getEnvironmentBase = (config: DocsConfig) => {
	const fallback = 'http://localhost/';
	if (typeof document !== 'undefined' && document.querySelector('base[href]')) {
		return document.baseURI || fallback;
	}
	if (typeof location !== 'undefined') {
		const segments = location.pathname.split('/').filter(Boolean);
		const configuredLanguages = Object.keys(config.locales);
		const languages = configuredLanguages.length ? configuredLanguages : ['zh-CN'];
		const languageIndex = segments.findIndex(segment => languages.includes(segment));
		if (languageIndex >= 0) {
			const deploymentSegments = segments.slice(0, languageIndex);
			return new URL(`/${deploymentSegments.join('/')}${deploymentSegments.length ? '/' : ''}`, location.origin).href;
		}
		return new URL('./', location.href).href;
	}
	return fallback;
};

/**
 * 返回独立于资源 CDN base 的页面部署目录。
 * @param config 用于识别语言路径段的文档配置。
 * @returns 浏览器 History 回退使用的稳定绝对地址。
 */
export const getDocsDeploymentBase = (config: DocsConfig) => {
	const cached = deploymentBaseCache.get(config);
	if (cached) return cached;
	const base = getEnvironmentBase(config);
	deploymentBaseCache.set(config, base);
	return base;
};

/**
 * 只规范化一次部署/资源根目录，避免跟随 SPA 路由变化。
 * @param config 文档应用配置。
 * @returns 路由、资源和缓存 identity 共用的稳定目录绝对地址。
 */
export const getDocsBase = (config: DocsConfig) => {
	const cached = docsBaseCache.get(config);
	if (cached) return cached;
	const environmentBase = getDocsDeploymentBase(config);
	const url = new URL(config.base || environmentBase, environmentBase);
	url.search = '';
	url.hash = '';
	if (!url.pathname.endsWith('/')) url.pathname += '/';
	docsBaseCache.set(config, url.href);
	return url.href;
};

const normalizeLogicalPath = (source: string) => {
	const pathname = trimSlashes(source.replace(/^\.\//, ''));
	let decoded: string;
	try {
		decoded = decodeURIComponent(pathname);
	} catch {
		throw new TypeError(`Invalid resource source: ${source}`);
	}
	if (
		decoded.includes('\0')
		|| decoded.includes('\\')
		|| decoded.startsWith('/')
		|| decoded.split('/').includes('..')
	) {
		throw new TypeError(`Resource source escapes its language directory: ${source}`);
	}
	return pathname;
};

/* 语言只能占用一个 URL 路径段，不能参与目录穿越。 */
const normalizeLanguage = (lang: string) => {
	const value = trimSlashes(lang);
	let decoded: string;
	try {
		decoded = decodeURIComponent(value);
	} catch {
		throw new TypeError(`Invalid resource language: ${lang}`);
	}
	if (
		!decoded
		|| decoded === '.'
		|| decoded === '..'
		|| decoded.includes('\0')
		|| decoded.includes('/')
		|| decoded.includes('\\')
	) throw new TypeError(`Invalid resource language: ${lang}`);
	return value;
};

/**
 * 以逻辑 importer 为基准解析 Renderer/SFC 内部依赖，同时保证结果仍位于
 * 当前语言目录内。这里使用虚拟 origin 只借用 URL 的 POSIX 路径语义。
 * @param source 子资源逻辑地址。
 * @param importer 父资源逻辑地址。
 * @param lang 当前业务语言。
 * @returns 解析后的语言目录相对 URL。
 */
const resolveLogicalImport = (source: string, importer: string, lang: string) => {
	if (source.includes('\0') || source.includes('\\')) {
		throw new TypeError(`Invalid resource source: ${source}`);
	}
	const language = normalizeLanguage(lang);
	const importerPath = normalizeLogicalPath(importer);
	const root = new URL(`https://docs.local/${language}/`);
	const resolved = new URL(source, new URL(importerPath, root));
	const prefix = `/${language}/`;
	if (!resolved.pathname.startsWith(prefix)) {
		throw new TypeError(`Resource source escapes its language directory: ${source}`);
	}
	return {
		language,
		pathname: resolved.pathname.slice(prefix.length),
		search: resolved.search,
		hash: resolved.hash
	};
};

export const getDefaultLanguage = (config: DocsConfig) => Object.keys(config.locales)[0] || 'zh-CN';

export const getDocsNamespace = (config: DocsConfig) => {
	if (config.namespace) return config.namespace;
	return getDocsBase(config);
};

// 统一解析逻辑 identity，组件不得自行拼接传输 URL。
export const resolveResource = async (
	config: DocsConfig,
	context: Omit<DocsResourceContext, 'runtime' | 'base'>
) => {
	const runtime = config.runtime || { mode: 'production' as const };
	const fullContext: DocsResourceContext = {
		...context,
		base: config.base,
		runtime
	};
	if (config.resolve?.resource) {
		const custom = await config.resolve.resource(fullContext);
		// 自定义 Resolver 只需接管认识的资源；空结果继续使用统一默认寻址。
		if (custom) return custom;
	}

	const { source, lang, importer } = context;
	if (isExternalLink(source) || source.startsWith('/')) return source;
	if (importer && (isExternalLink(importer) || importer.startsWith('/'))) {
		if (isExternalLink(importer)) return new URL(source, importer).href;
		const resolved = new URL(source, new URL(importer, getDocsDeploymentBase(config)));
		return `${resolved.pathname}${resolved.search}${resolved.hash}`;
	}
	if (importer) {
		const resolved = resolveLogicalImport(source, importer, lang);
		const suffix = `${resolved.pathname}${resolved.search}${resolved.hash}`;
		if (runtime.mode === 'development') {
			return `${normalizeWorkspaceBase(runtime.workspace)}${resolved.language}/${suffix}`;
		}
		return new URL(`${resolved.language}/${suffix}`, getDocsBase(config)).href;
	}

	const pathname = normalizeLogicalPath(source);
	const language = normalizeLanguage(lang);
	if (runtime.mode === 'development') {
		const workspace = normalizeWorkspaceBase(runtime.workspace);
		return `${workspace}${language}/${pathname}`;
	}
	return new URL(`${language}/${pathname}`, getDocsBase(config)).href;
};

/**
 * 按扩展名判断文档资源类型。与 dever `getResourceType` 对齐，额外识别 `?#` 后缀。
 * @param source 逻辑资源地址。
 * @returns 资源类型；无法识别时视为 markdown。
 * @see packages/dever/src/plugins/index.ts
 */
export const classifyResourceSource = (source: string): DocsResourceType => {
	if (/\.page\.json(?:$|[?#])/i.test(source)) return 'page';
	if (/\.json(?:$|[?#])/i.test(source)) return 'sidebar';
	if (/\.vue(?:$|[?#])/i.test(source)) return 'sfc';
	if (/\.css(?:$|[?#])/i.test(source)) return 'style';
	if (/\.[jt]s(?:$|[?#])/i.test(source)) return 'module';
	return 'markdown';
};

export const createResourceIdentity = (
	config: DocsConfig,
	lang: string,
	type: DocsResourceType,
	source: string
): ResourceIdentity => ({
	namespace: getDocsNamespace(config),
	lang,
	type,
	source
});

export const resourceIdentityKey = (identity: ResourceIdentity) => [
	identity.namespace,
	identity.lang,
	identity.type,
	identity.source
].map(encodeURIComponent).join('|');
