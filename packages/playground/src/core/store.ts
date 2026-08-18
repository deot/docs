import { ref } from 'vue';
import { File as ReplFile, useStore } from '@vue/repl';
import type { SandboxProps } from '@vue/repl';
import { DEFAULT_CDN_URL, NEW_SFC_CODE } from '../constants';
import type { PlaygroundFiles, PlaygroundOptions } from '../types';
import { SANDBOX_RUNTIME_ERROR_CAPTURE_HTML } from './runtime/error-guard';

const DOCS_LINK_IMPORT_CODE = 'import { h as __docsH } from "vue"';
const DOCS_LINK_USE_CODE = [
	'app.component("DocsLink",{',
	'props:{to:{type:String,default:""}},',
	'setup(props,{slots}){return()=>__docsH("a",{',
	'href:props.to,',
	'style:{color:"inherit",textDecoration:"none"},',
	'onClick(event){event.preventDefault();window.parent.postMessage({action:"docs:navigate",to:props.to},"*")}',
	'},slots.default?.())}',
	'})'
].join('');

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
	// 使用 esm 模块（lodash-es/lodash.js会加载600+子文件，加载时间过长。 +esm是jsdelivr提供的内部编译）
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

export const createRuntimePreviewOptions = (
	cdnURL = DEFAULT_CDN_URL
): NonNullable<SandboxProps['previewOptions']> => ({
	showRuntimeError: false,
	showRuntimeWarning: false,
	headHTML: [
		SANDBOX_RUNTIME_ERROR_CAPTURE_HTML,
		'<meta name="viewport" content="width=device-width, initial-scale=1">',
		...PREVIEW_STYLE_ASSETS.map(asset => (
			`<link rel="stylesheet" href="${cdnAsset(cdnURL, asset)}">`
		)),
		'<style>',
		'html,body{height:auto;min-height:0}',
		'body{color:var(--vc-foreground-color,#080f20);background:var(--vc-background-color-light,#fff)}',
		'</style>'
	].join('\n'),
	customCode: {
		importCode: DOCS_LINK_IMPORT_CODE,
		useCode: DOCS_LINK_USE_CODE
	}
});

export const toReplFilename = (filename: string) => filename.startsWith('src/')
	? filename
	: `src/${filename}`;

export const createReplFile = (filename: string, code: string) => {
	const replFilename = toReplFilename(filename);
	return new ReplFile(replFilename, code);
};

export const createRuntimeStore = (
	files: PlaygroundFiles,
	entry: string,
	options: PlaygroundOptions
) => {
	const { cdnURL, builtinImportMap, ...storeOptions } = options;
	const replFiles = ref<Record<string, ReplFile>>(Object.fromEntries(
		Object.entries(files).map(([filename, code]) => {
			const file = createReplFile(filename, code);
			return [file.filename, file];
		})
	));
	const mainFile = ref(toReplFilename(entry));
	const activeFilename = ref(toReplFilename(entry));
	const store = useStore({
		...storeOptions,
		files: replFiles,
		mainFile,
		activeFilename,
		builtinImportMap: ref({
			...builtinImportMap,
			imports: {
				...createBuiltinImports(cdnURL),
				...builtinImportMap?.imports
			}
		}),
		template: ref({
			welcomeSFC: files[entry],
			newSFC: NEW_SFC_CODE
		})
	});
	void store.init();
	return store;
};
