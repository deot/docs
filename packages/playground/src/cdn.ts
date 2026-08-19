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
	// jsDelivr `+esm`：避免走 lodash-es/lodash.js 再拆出几百个请求。
	'lodash-es': 'lodash-es/+esm'
};

export const normalizeCdnURL = (cdnURL = DEFAULT_CDN_URL) => {
	const origin = cdnURL.trim().replace(/\/+$/u, '');
	return origin || DEFAULT_CDN_URL;
};

const cdnAsset = (cdnURL: string, asset: string) => (
	`${normalizeCdnURL(cdnURL)}/${asset.replace(/^\/+/u, '')}`
);

export const createBuiltinImports = (
	cdnURL = DEFAULT_CDN_URL
): Record<string, string> => ({
	...Object.fromEntries(
		Object.entries(BUILTIN_IMPORT_ASSETS).map(([specifier, asset]) => [
			specifier,
			cdnAsset(cdnURL, asset)
		])
	),
	'vue': 'https://play.vuejs.org/vue.runtime.esm-browser.js',
	'vue/server-renderer': 'https://play.vuejs.org/server-renderer.esm-browser.js'
});

// 预览 iframe 默认注入的样式表（key 为资源路径，value 为完整 CDN URL）。
export const createBuiltinStyles = (
	cdnURL = DEFAULT_CDN_URL
): Record<string, string> => Object.fromEntries(
	PREVIEW_STYLE_ASSETS.map(asset => [asset, cdnAsset(cdnURL, asset)])
);
