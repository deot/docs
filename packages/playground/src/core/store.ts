import { ref, unref } from 'vue';
import { File as ReplFile, useStore } from '@vue/repl';
import type { SandboxProps } from '@vue/repl';
import {
	createBuiltinImports,
	createBuiltinStyles,
	createCdnResolver
} from '../cdn';
import { NEW_SFC_CODE } from '../constants';
import {
	filterSafeHrefs,
	getPlaygroundImportMapOverrides,
	getPlaygroundSiteModules,
	getPlaygroundSiteStyles,
	getPlaygroundStyleOverrides
} from '../import-map';
import type { PlaygroundFiles, PlaygroundOptions } from '../types';
import { SANDBOX_RUNTIME_ERROR_CAPTURE_HTML } from './runtime/error-guard';
import { PREVIEW_SERVICE_IMPORT_CODE, PREVIEW_SERVICE_USE_CODE } from '../preview-service';
import { bindPlaygroundScss, whenSassReady } from './scss';
import { bindReplModules, resolveReplImports } from './repl-modules';
import { collectBareSpecifiers } from './runtime/local/compile/files';
import {
	PREVIEW_SCROLL_RESET_CODE,
	PREVIEW_SCROLLER_STYLE
} from './preview-scroll';

export {
	PREVIEW_SCROLL_CONTENT_CLASS,
	PREVIEW_SCROLL_HTML_CLASS,
	PREVIEW_SCROLL_RESET_CODE,
	PREVIEW_SCROLLER_IMPORT_CODE,
	PREVIEW_SCROLLER_USE_CODE
} from './preview-scroll';

export const DOCS_LINK_IMPORT_CODE = 'import { h as __docsH } from "vue"';
const DOCS_LINK_USE_CODE = [
	PREVIEW_SCROLL_RESET_CODE,
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
 * `--vc-background-color-lightest` 不同，否则会出现色带割裂。
 */
export const PLAYGROUND_RUNTIME_CANVAS_BACKGROUND = 'var(--vc-background-color-lightest, var(--docs-background-color, #fff))';

export interface CreateRuntimePreviewOptions {
	/**
	 * 是否注入 iframe 内 Scroller 包装代码。默认关闭。
	 */
	previewScroller?: boolean;
}

// 预览 head：内置 CSS → 站点 styles 内存 → 覆盖内存。
export const createRuntimePreviewOptions = (
	cdnURL?: string,
	options: CreateRuntimePreviewOptions = {}
): NonNullable<SandboxProps['previewOptions']> => {
	const previewScroller = options.previewScroller === true;
	const resolve = createCdnResolver(cdnURL);
	const hrefs = Object.values({
		...createBuiltinStyles(cdnURL),
		...getPlaygroundSiteStyles(),
		...getPlaygroundStyleOverrides()
	}).map(resolve);
	const styleBlocks = [
		`html,body{height:auto;min-height:0;background:${PLAYGROUND_RUNTIME_CANVAS_BACKGROUND}}`,
		'body{color:var(--vc-foreground-color,#080f20)}',
		...(previewScroller ? [PREVIEW_SCROLLER_STYLE] : [])
	];
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
			...styleBlocks,
			'</style>'
		].join('\n'),
		customCode: {
			importCode: `${DOCS_LINK_IMPORT_CODE}\n${PREVIEW_SERVICE_IMPORT_CODE}`,
			// Scroller 包装必须接在实例 customCode 之后，避免被覆盖；由 mergePreviewOptions 追加。
			useCode: `${DOCS_LINK_USE_CODE}\n${PREVIEW_SERVICE_USE_CODE}`
		}
	};
};
export const toReplFilename = (filename: string) => filename === 'import-map.json' || filename.startsWith('src/')
	? filename
	: `src/${filename}`;

export const createReplFile = (filename: string, code: string) => {
	const replFilename = toReplFilename(filename);
	return new ReplFile(replFilename, code);
};

/**
 * 保留显式配置的模块，供 local 区分宿主默认与 URL 覆盖。
 * @param builtinImportMap 实例层 import map。
 * @returns 按优先级合并的显式模块地址。
 */
export const createRuntimeImportOverrides = (
	builtinImportMap?: PlaygroundOptions['builtinImportMap']
): Record<string, string> => ({
	...getPlaygroundSiteModules(),
	...getPlaygroundImportMapOverrides(),
	...filterSafeHrefs(builtinImportMap?.imports)
});

/**
 * 默认 CDN → 站点 modules → 管理页覆盖 → 实例 builtinImportMap。
 * iframe import map 与直接渲染加载的是同一份地址表。
 * @param cdnURL
 * @param builtinImportMap
 */
export const createRuntimeImports = (
	cdnURL?: string,
	builtinImportMap?: PlaygroundOptions['builtinImportMap']
): Record<string, string> => ({
	...createBuiltinImports(cdnURL),
	...createRuntimeImportOverrides(builtinImportMap)
});

export const createRuntimeStore = (
	files: PlaygroundFiles,
	entry: string,
	options: PlaygroundOptions
) => {
	// @vue/repl 的 JSX 分块会读取宿主页 process.env，保留宿主已有对象和值。
	const host = globalThis as { process?: { env?: Record<string, string | undefined> } };
	const replProcess = host.process ??= {};
	replProcess.env ??= {};
	const { cdnURL, builtinImportMap, ...storeOptions } = options;
	const replFiles = ref<Record<string, ReplFile>>(Object.fromEntries(
		Object.entries(files).map(([filename, code]) => {
			const file = createReplFile(filename, code);
			return [file.filename, file];
		})
	));
	// REPL 初始化会先读取 import map，再合并内置地址；文件必须提前存在。
	replFiles.value['import-map.json'] ??= new ReplFile('import-map.json', '{}');
	const mainFile = ref(toReplFilename(entry));
	const activeFilename = ref(toReplFilename(entry));
	const imports = createRuntimeImports(cdnURL, builtinImportMap);
	const resolve = createCdnResolver(cdnURL);
	const resourceLinks = unref(storeOptions.resourceLinks);
	const store = useStore({
		...storeOptions,
		resourceLinks: ref({
			...resourceLinks,
			esModuleShims: resolve(resourceLinks?.esModuleShims
				|| 'https://cdn.jsdelivr.net/npm/es-module-shims@1.5.18/dist/es-module-shims.wasm.js?raw')
		}),
		files: replFiles,
		mainFile,
		activeFilename,
		builtinImportMap: ref({
			...builtinImportMap,
			imports
		}),
		template: ref({
			welcomeSFC: files[entry],
			newSFC: NEW_SFC_CODE
		})
	});
	bindPlaygroundScss(store);
	const setFiles = store.setFiles.bind(store);
	store.setFiles = (nextFiles, nextEntry) => setFiles({
		'import-map.json': store.files['import-map.json'].code,
		...nextFiles
	}, nextEntry);
	const getImportMap = store.getImportMap.bind(store);
	bindReplModules(store, getImportMap, resolve);
	store.getImportMap = () => {
		const map = getImportMap();
		const convert = (items: Record<string, string | undefined> = {}) => Object.fromEntries(
			Object.entries(items).filter((item): item is [string, string] => typeof item[1] === 'string')
				.map(([id, url]) => [id, resolve(url)])
		);
		return {
			...map,
			imports: convert(map.imports),
			scopes: map.scopes && Object.fromEntries(Object.entries(map.scopes)
				.map(([scope, items]) => [resolve(scope), convert(items)]))
		};
	};
	whenSassReady(files, () => {
		const specifiers = collectBareSpecifiers(files, Object.keys(files));
		if (!specifiers.length) {
			store.init();
			return;
		}
		store.loading = true;
		const currentImports = { ...imports, ...filterSafeHrefs(getImportMap().imports) };
		void resolveReplImports(currentImports, specifiers, resolve).then((resolved) => {
			if (Object.keys(resolved).length !== Object.keys(currentImports).length) store.setImportMap({ imports: resolved }, true);
			store.init();
		}).catch((error) => { store.errors.push(error); }).finally(() => { store.loading = false; });
	});
	return store;
};
