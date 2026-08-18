import { ref } from 'vue';
import { File as ReplFile, useStore } from '@vue/repl';
import type { SandboxProps } from '@vue/repl';
import { NEW_SFC_CODE } from '../constants';
import type { PlaygroundFiles, PlaygroundOptions } from '../types';
import { SANDBOX_RUNTIME_ERROR_CAPTURE_HTML } from './runtime/error-guard';

const cdnURL = 'https://cdn.jsdelivr.net/npm';

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

export const runtimePreviewOptions: SandboxProps['previewOptions'] = {
	showRuntimeError: false,
	showRuntimeWarning: false,
	headHTML: [
		SANDBOX_RUNTIME_ERROR_CAPTURE_HTML,
		'<meta name="viewport" content="width=device-width, initial-scale=1">',
		'<link rel="stylesheet" href="https://unpkg.com/@deot/style/dist/index.normalize-only.css">',
		'<link rel="stylesheet" href="https://unpkg.com/@deot/vc-components/dist/index.style.css">',
		'<link rel="stylesheet" href="https://unpkg.com/@deot/style/dist/index.css">',
		'<style>html,body{height:auto;min-height:0}body{color:var(--vc-foreground-color,#080f20);background:var(--vc-background-color-light,#fff)}</style>'
	].join('\n'),
	customCode: {
		importCode: DOCS_LINK_IMPORT_CODE,
		useCode: DOCS_LINK_USE_CODE
	}
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
	const replFiles = ref<Record<string, ReplFile>>(Object.fromEntries(
		Object.entries(files).map(([filename, code]) => {
			const file = createReplFile(filename, code);
			return [file.filename, file];
		})
	));
	const mainFile = ref(toReplFilename(entry));
	const activeFilename = ref(toReplFilename(entry));
	const store = useStore({
		...options,
		files: replFiles,
		mainFile,
		activeFilename,
		builtinImportMap: ref({
			...options.builtinImportMap,
			imports: {
				'@deot/vc': `${cdnURL}/@deot/vc/dist/index.js`,
				'@deot/vc-shared': `${cdnURL}/@deot/vc-shared/dist/index.js`,
				'@deot/vc-hooks': `${cdnURL}/@deot/vc-hooks/dist/index.js`,
				'@deot/vc-components': `${cdnURL}/@deot/vc-components/dist/index.js`,
				'@deot/helper-resize': `${cdnURL}/@deot/helper-resize/dist/index.js`,
				'@deot/helper-utils': `${cdnURL}/@deot/helper-utils/dist/index.js`,
				'@deot/helper-cache': `${cdnURL}/@deot/helper-cache/dist/index.js`,
				'@deot/helper-fp': `${cdnURL}/@deot/helper-fp/dist/index.js`,
				'@deot/helper-dom': `${cdnURL}/@deot/helper-dom/dist/index.js`,
				'@deot/helper-wheel': `${cdnURL}/@deot/helper-wheel/dist/index.js`,
				'@deot/helper-validator': `${cdnURL}/@deot/helper-validator/dist/index.js`,
				'@deot/helper-load': `${cdnURL}/@deot/helper-load/dist/index.js`,
				'@deot/helper-scheduler': `${cdnURL}/@deot/helper-scheduler/dist/index.js`,
				'@deot/helper-emitter': `${cdnURL}/@deot/helper-emitter/dist/index.js`,
				'@deot/helper-is': `${cdnURL}/@deot/helper-is/dist/index.js`,
				'@deot/helper-device': `${cdnURL}/@deot/helper-device/dist/index.js`,
				'@deot/helper-route': `${cdnURL}/@deot/helper-route/dist/index.js`,
				'@deot/helper-unicode': `${cdnURL}/@deot/helper-unicode/dist/index.js`,
				'@deot/helper': `${cdnURL}/@deot/helper/dist/index.js`,
				'normalize-wheel': `${cdnURL}/normalize-wheel-es/dist/index.mjs`,
				'photoswipe': `${cdnURL}/photoswipe/dist/photoswipe.esm.js`,
				'photoswipe/lightbox': `${cdnURL}/photoswipe/dist/photoswipe-lightbox.esm.js`,
				'lodash-es': `${cdnURL}/lodash-es/+esm`,
				'vue': 'https://play.vuejs.org/vue.runtime.esm-browser.js',
				'vue/server-renderer': 'https://play.vuejs.org/server-renderer.esm-browser.js',
				...options.builtinImportMap?.imports
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
