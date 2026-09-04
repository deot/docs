import { ref } from 'vue';
import { File as ReplFile, useStore } from '@vue/repl';
import type { SandboxProps } from '@vue/repl';
import {
	createBuiltinImports,
	createBuiltinStyles
} from '../cdn';
import { DEFAULT_CDN_URL, NEW_SFC_CODE } from '../constants';
import {
	filterSafeHrefs,
	getPlaygroundImportMapOverrides,
	getPlaygroundSiteModules,
	getPlaygroundSiteStyles,
	getPlaygroundStyleOverrides
} from '../import-map';
import type { PlaygroundFiles, PlaygroundOptions } from '../types';
import { SANDBOX_RUNTIME_ERROR_CAPTURE_HTML } from './runtime/error-guard';
import { bindPlaygroundScss, whenSassReady } from './scss';

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

const escapeHtmlAttr = (value: string) => value
	.replace(/&/gu, '&amp;')
	.replace(/"/gu, '&quot;')
	.replace(/'/gu, '&#39;')
	.replace(/</gu, '&lt;')
	.replace(/>/gu, '&gt;');

/**
 * runtime 画布色。`previewInset` 露出的 padding、iframe chrome 和 sandbox
 * `html`/`body` 必须共用这一变量，暗色下 `--docs-background-color` 与
 * `--vc-background-color-light` 不同，否则会出现色带割裂。
 */
export const PLAYGROUND_RUNTIME_CANVAS_BACKGROUND = 'var(--vc-background-color-light, var(--docs-background-color, #fff))';

// 预览 head：内置 CSS → 站点 styles 内存 → 覆盖内存。
export const createRuntimePreviewOptions = (
	cdnURL = DEFAULT_CDN_URL
): NonNullable<SandboxProps['previewOptions']> => {
	const hrefs = Object.values({
		...createBuiltinStyles(cdnURL),
		...getPlaygroundSiteStyles(),
		...getPlaygroundStyleOverrides()
	});
	return {
		showRuntimeError: false,
		showRuntimeWarning: false,
		headHTML: [
			SANDBOX_RUNTIME_ERROR_CAPTURE_HTML,
			'<meta name="viewport" content="width=device-width, initial-scale=1">',
			...hrefs.map(href => (
				`<link rel="stylesheet" href="${escapeHtmlAttr(href)}">`
			)),
			'<style>',
			`html,body{height:auto;min-height:0;background:${PLAYGROUND_RUNTIME_CANVAS_BACKGROUND}}`,
			'body{color:var(--vc-foreground-color,#080f20)}',
			'</style>'
		].join('\n'),
		customCode: {
			importCode: DOCS_LINK_IMPORT_CODE,
			useCode: DOCS_LINK_USE_CODE
		}
	};
};
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
				// 默认 CDN → 站点 modules → 实例 builtinImportMap → 管理页覆盖
				...createBuiltinImports(cdnURL),
				...getPlaygroundSiteModules(),
				...filterSafeHrefs(builtinImportMap?.imports),
				...getPlaygroundImportMapOverrides()
			}
		}),
		template: ref({
			welcomeSFC: files[entry],
			newSFC: NEW_SFC_CODE
		})
	});
	bindPlaygroundScss(store);
	whenSassReady(files, () => store.init());
	return store;
};
