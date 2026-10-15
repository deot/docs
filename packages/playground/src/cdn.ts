import { DEFAULT_CDN_URL } from './constants';

const PREVIEW_STYLE_ASSETS = [
	'@deot/style/dist/index.normalize-only.css',
	'@deot/vc-components/dist/index.style.css',
	'@deot/style/dist/index.css'
] as const;

const BUILTIN_IMPORT_ASSETS: Record<string, string> = {
	'@deot/vc': '@deot/vc/dist/index.js',
	'@deot/vc-shared': '@deot/vc-shared/dist/index.js',
	'@deot/vc-hooks': '@deot/vc-hooks/dist/index.js',
	'@deot/vc-locale': '@deot/vc-locale/dist/index.js',
	'@deot/vc-components': '@deot/vc-components/dist/index.js',
	'@deot/helper-resize': '@deot/helper-resize/dist/index.js',
	'@deot/helper-utils': '@deot/helper-utils/dist/index.js',
	'@deot/helper-cache': '@deot/helper-cache/dist/index.js',
	'@deot/helper-fp': '@deot/helper-fp/dist/index.js',
	'@deot/helper-dom': '@deot/helper-dom/dist/index.js',
	'@deot/helper-wheel': '@deot/helper-wheel/dist/index.js',
	'@deot/helper-validator': '@deot/helper-validator/dist/index.js',
	'@deot/helper-load': '@deot/helper-load/dist/index.js',
	'@deot/helper-scheduler': '@deot/helper-scheduler/dist/index.js',
	'@deot/helper-emitter': '@deot/helper-emitter/dist/index.js',
	'@deot/helper-is': '@deot/helper-is/dist/index.js',
	'@deot/helper-device': '@deot/helper-device/dist/index.js',
	'@deot/helper-route': '@deot/helper-route/dist/index.js',
	'@deot/helper-unicode': '@deot/helper-unicode/dist/index.js',
	'@deot/helper': '@deot/helper/dist/index.js',
	'normalize-wheel': 'normalize-wheel-es/dist/index.mjs',
	'photoswipe': 'photoswipe/dist/photoswipe.esm.js',
	'photoswipe/lightbox': 'photoswipe/dist/photoswipe-lightbox.esm.js',
	'vue': 'vue/dist/vue.runtime.esm-browser.js',
	'vue/server-renderer': 'vue/dist/server-renderer.esm-browser.js'
};

export const normalizeCdnURL = (cdnURL = DEFAULT_CDN_URL) => {
	const origin = cdnURL.trim().replace(/\/+$/u, '');
	return origin || DEFAULT_CDN_URL;
};

const cdnJoin = (origin: string, asset: string) => (
	`${origin}/${asset.replace(/^\/+/u, '')}`
);
const jsdelivrEsmURL = (asset: string) => cdnJoin(DEFAULT_CDN_URL, asset);

export const SASS_CDN_URL = jsdelivrEsmURL('sass/+esm');

const cdnAsset = (cdnURL: string, asset: string) => cdnJoin(normalizeCdnURL(cdnURL), asset);

export const createBuiltinImports = (
	cdnURL = DEFAULT_CDN_URL
): Record<string, string> => ({
	...Object.fromEntries(
		Object.entries(BUILTIN_IMPORT_ASSETS).map(([specifier, asset]) => [
			specifier,
			cdnAsset(cdnURL, asset)
		])
	),
	// 避免走 lodash-es/lodash.js 再拆出几百个请求。
	'lodash-es': jsdelivrEsmURL('lodash-es/+esm')
});

// 预览 iframe 默认注入的样式表（key 为资源路径，value 为完整 CDN URL）。
export const createBuiltinStyles = (
	cdnURL = DEFAULT_CDN_URL
): Record<string, string> => Object.fromEntries(
	PREVIEW_STYLE_ASSETS.map(asset => [asset, cdnAsset(cdnURL, asset)])
);

// 仅生成原始 ESM 地址；实际加载时再转换到选中节点并执行用户钩子。
export const resolveNpmImport = (specifier: string) => (
	/^https?:\/\//.test(specifier) ? specifier : jsdelivrEsmURL(`${specifier}/+esm`)
);

export interface CdnConfig {
	runtime?: { cdn?: string };
	resolve?: { cdn?: (context: { url: string }) => string | null | undefined };
}

const docsCdnConfig = (): CdnConfig => (
	(globalThis as typeof globalThis & { window?: { $docs?: CdnConfig } }).window?.$docs || {}
);

const npmCdnUrl = (value: string) => {
	if (!/^https?:\/\//i.test(value)) return null;
	const url = new URL(value);
	const prefix = /(?:^|\.)jsdelivr\.net$/u.test(url.hostname) && url.pathname.startsWith('/npm/')
		? '/npm/'
		: /^(?:esm\.)?unpkg\.com$/u.test(url.hostname) ? '/' : null;
	if (!prefix) return null;
	const asset = url.pathname.slice(prefix.length);
	const match = asset.match(/^((?:@[^/]+\/)?[^/]+)(.*)$/u);
	return match ? { url, asset, name: match[1].replace(/@[^/@]+$/u, ''), path: match[2] } : null;
};

// 将转换服务写回的包入口还原成模块名，继续应用 Vue / 内置模块覆盖。
export const cdnModuleName = (url: string) => {
	const parsed = npmCdnUrl(url);
	return parsed && (!parsed.path || parsed.path === '/+esm'
		|| /^\/(?:es\d+|esnext)\/[^/]+\.m?js$/u.test(parsed.path))
		? parsed.name
		: null;
};

export const isCdnEsmURL = (url: string) => (
	/\/\+esm(?:[?#]|$)/u.test(url) || npmCdnUrl(url)?.url.hostname === 'esm.unpkg.com'
);

// 内置转换先行，用户钩子最后执行；不修改配置或缓存里的原始 URL。
export const resolveCdnURL = (
	url: string,
	cdnURL?: string,
	config: CdnConfig = docsCdnConfig()
) => {
	const parsed = npmCdnUrl(url);
	const target = config.runtime?.cdn || cdnURL;
	let converted = url;
	if (parsed && target) {
		const origin = normalizeCdnURL(target);
		const unpkg = new URL(origin).hostname === 'esm.unpkg.com';
		let asset = parsed.asset;
		if (unpkg) asset = asset.replace(/\/\+esm$/u, '');
		else if (!parsed.path.endsWith('/+esm') && (!parsed.path || !/\.[^/]+$/u.test(parsed.path)
			|| (/unpkg\.com$/u.test(parsed.url.hostname) && /\.[cm]?[jt]sx?$/u.test(parsed.path)))) {
			asset = `${asset.replace(/\/+$/u, '')}/+esm`;
		}
		converted = `${origin}/${asset}${parsed.url.search}${parsed.url.hash}`;
	}
	return config.resolve?.cdn?.({ url: converted }) || converted;
};

// 一次预览共用转换结果，依赖图重访和 REPL 重读不重复执行用户钩子。
export const createCdnResolver = (cdnURL?: string) => {
	const resolved = new Map<string, string>();
	return (url: string) => {
		if (!resolved.has(url)) {
			const target = resolveCdnURL(url, cdnURL);
			resolved.set(url, target);
			resolved.set(target, target);
		}
		return resolved.get(url)!;
	};
};
