<template>
	<div v-if="!styleless" class="docs-playground">
		<div class="docs-playground__header">
			<div class="docs-playground__tools">
				<Clipboard :value="copyValue" tag="span">
					{{ copyText['zh-CN'] }}
				</Clipboard>
				<span @click="handleEditor">&lt;/&gt;</span>
			</div>
		</div>
		<div v-if="error" class="docs-playground__error">
			{{ error }}
		</div>
		<section v-show="!error" ref="preview" class="docs-playground__preview">
			<Sandbox
				:store="store"
				:clear-console="clearConsole"
				:preview-options="previewOptions"
			/>
		</section>
	</div>
	<Sandbox v-else :store="store" :preview-options="previewOptions" />
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { File as ReplFile, Sandbox, useStore } from '@vue/repl';
import type { SandboxProps } from '@vue/repl';
import { Clipboard } from '@deot/vc';
import { Editor } from './editor';
import type { EditorFilesChangeAction } from './editor';
import type { PlaygroundFiles, PlaygroundOptions } from './types';

const emit = defineEmits<{
	'update:modelValue': [value: string];
	'update:files': [files: PlaygroundFiles];
	'update:entry': [entry: string];
	'change': [value: string];
}>();
const props = withDefaults(defineProps<{
	modelValue?: string;
	files?: PlaygroundFiles;
	entry?: string;
	styleless?: boolean;
	options?: PlaygroundOptions;
}>(), {
	modelValue: '',
	files: () => ({}),
	entry: '',
	styleless: false,
	options: () => ({})
});
const DEFAULT_ENTRY = 'App.vue';
const newSFCCode = `<script setup lang="ts"><\/script>\n\n<template>\n  <div>\n    <slot />\n  <\/div>\n<\/template>\n`;
const welcomeSFCCode = newSFCCode;

const toReplFilename = (filename: string) => filename.startsWith('src/')
	? filename
	: `src/${filename}`;
const filesEqual = (a: PlaygroundFiles, b: PlaygroundFiles) => {
	const aKeys = Object.keys(a);
	const bKeys = Object.keys(b);
	return aKeys.length === bKeys.length
		&& aKeys.every(key => a[key] === b[key]);
};
const initialFiles: PlaygroundFiles = Object.keys(props.files).length
	? { ...props.files }
	: { [DEFAULT_ENTRY]: props.modelValue || welcomeSFCCode };
const initialEntry = props.entry && initialFiles[props.entry] !== undefined
	? props.entry
	: Object.keys(initialFiles)[0];
const sourceFiles = ref<PlaygroundFiles>(initialFiles);
const currentEntry = ref(initialEntry);

const copyText = {
	'zh-CN': '复制',
	'en-US': 'Copy',
};

const env = (import.meta as ImportMeta & { env: { MODE?: string } }).env;
const clearConsole = ref(env.MODE !== 'development');
const error = ref(props.entry && initialFiles[props.entry] === undefined
	? `入口文件 ${props.entry} 不存在`
	: '');
const template = ref({
	welcomeSFC: initialFiles[initialEntry],
	newSFC: newSFCCode
});
const replFiles = ref<Record<string, ReplFile>>(Object.fromEntries(
	Object.entries(initialFiles).map(([filename, code]) => [
		toReplFilename(filename),
		new ReplFile(toReplFilename(filename), code)
	])
));
const mainFile = ref(toReplFilename(initialEntry));
const activeFilename = ref(toReplFilename(initialEntry));

// https://unpkg.com
const cdnURL = 'https://cdn.jsdelivr.net/npm';
const store = useStore({
	...props.options,
	files: replFiles,
	mainFile,
	activeFilename,
	builtinImportMap: ref({
		...props.options?.builtinImportMap,
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
			'lodash-es': `${cdnURL}/lodash-es/lodash.js`,
			'lodash': `${cdnURL}/lodash/lodash.js`,
			'vue': 'https://play.vuejs.org/vue.runtime.esm-browser.js',
			'vue/server-renderer': 'https://play.vuejs.org/server-renderer.esm-browser.js',
			...props.options?.builtinImportMap?.imports
		},
	}),
	template
});

const previewOptions = computed<SandboxProps['previewOptions']>(() => {
	return {
		headHTML: [
			'<link rel="stylesheet" href="https://unpkg.com/@deot/style/dist/index.normalize-only.css">',
			'<link rel="stylesheet" href="https://unpkg.com/@deot/vc-components/dist/index.style.css">',
			'<link rel="stylesheet" href="https://unpkg.com/@deot/style/dist/index.css">',
			'<style> body{ background: white } </style>'
		].join('\n')
	};
});

const copyValue = computed(() => sourceFiles.value[currentEntry.value] || '');

const emitFiles = () => emit('update:files', { ...sourceFiles.value });

const handleFilesChange = (
	files: PlaygroundFiles,
	entry: string,
	action: EditorFilesChangeAction
) => {
	const previousEntry = currentEntry.value;
	sourceFiles.value = { ...files };
	currentEntry.value = entry;
	error.value = '';

	switch (action.type) {
		case 'update': {
			const file = store.files[toReplFilename(action.filename)];
			if (file) file.code = files[action.filename];
			break;
		}
		case 'create':
			store.addFile(new ReplFile(toReplFilename(action.filename), files[action.filename]));
			break;
		case 'rename':
			store.renameFile(
				toReplFilename(action.previousFilename),
				toReplFilename(action.filename)
			);
			break;
		case 'delete':
			store.setActive(toReplFilename(entry));
			delete store.files[toReplFilename(action.filename)];
			break;
		case 'entry':
			store.mainFile = toReplFilename(entry);
			break;
	}

	if (action.type !== 'entry') emitFiles();
	if (entry !== previousEntry) emit('update:entry', entry);
	if (action.type === 'update' && action.filename === entry) {
		emit('update:modelValue', files[entry]);
		emit('change', files[entry]);
	}
};

const handleEditor = () => {
	Editor.popup({
		files: { ...sourceFiles.value },
		entry: currentEntry.value,
		getCodeErrors: () => store.errors,
		onFilesChange: handleFilesChange,
		onActiveChange: (filename: string) => store.setActive(toReplFilename(filename))
	});
};

watch(() => props.modelValue, (value: string) => {
	if (Object.keys(props.files).length || sourceFiles.value[currentEntry.value] === value) return;
	sourceFiles.value = { ...sourceFiles.value, [currentEntry.value]: value };
	const file = store.files[toReplFilename(currentEntry.value)];
	if (file) file.code = value;
});

watch(() => props.files, (files) => {
	if (!Object.keys(files).length || filesEqual(files, sourceFiles.value)) return;
	const entry = props.entry && files[props.entry] !== undefined
		? props.entry
		: Object.keys(files)[0];
	sourceFiles.value = { ...files };
	currentEntry.value = entry;
	error.value = props.entry && files[props.entry] === undefined
		? `入口文件 ${props.entry} 不存在`
		: '';
	void store.setFiles(files, entry);
}, { deep: true });

watch(() => props.entry, (entry) => {
	if (!entry || entry === currentEntry.value || !Object.keys(props.files).length) return;
	if (sourceFiles.value[entry] === undefined) {
		error.value = `入口文件 ${entry} 不存在`;
		return;
	}
	currentEntry.value = entry;
	store.mainFile = toReplFilename(entry);
	store.setActive(toReplFilename(entry));
	error.value = '';
});

defineExpose({
	store
});
</script>
<style>
.docs-playground {
	display: flex;
	width: 100%;
	margin-bottom: 16px;
	box-shadow: rgb(229 229 229) 0 0 10px;
	box-sizing: border-box;
	justify-content: center;
	flex-direction: column;
}

.docs-playground__header {
	display: flex;
	padding: 10px;
	background: #f6f8fa !important;
	justify-content: flex-end;
	align-items: center;
}

.docs-playground__tools {
	display: flex;
	align-items: center;
	font-size: 14px;
	line-height: 20px;
}

.docs-playground__tools > span {
	margin-left: 10px;
	cursor: pointer;
}

.docs-playground__tools > span:last-child {
	font-size: 20px;
}

.docs-playground__error {
	display: flex;
	justify-content: center;
	align-items: center;
	height: 100%;
	box-sizing: border-box;
}

.docs-playground__preview {
	padding: 10px;
	background: white;
	box-sizing: border-box;
}
</style>
