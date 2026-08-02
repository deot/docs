<template>
	<RuntimePreview
		v-if="styleless"
		:files="sourceFiles"
		:entry="currentEntry"
		:options="options"
		:styleless="true"
		@files-change="handleFilesChange"
	/>
	<div
		v-else
		class="docs-playground"
		:class="{ 'docs-playground--files': activeView === 'files' }"
	>
		<div v-if="error" class="docs-playground__error">
			{{ error }}
		</div>
		<RuntimePreview
			v-if="runtimeActivated && normalizedViews.includes('runtime')"
			v-show="!error && activeView === 'runtime'"
			:files="sourceFiles"
			:entry="currentEntry"
			:options="options"
			:active-view="activeView"
			:views="normalizedViews"
			@files-change="handleFilesChange"
			@view-change="handleView"
		/>
		<FilesPreview
			v-if="normalizedViews.includes('files')"
			v-show="!error && activeView === 'files'"
			:files="sourceFiles"
			:entry="currentEntry"
			:active-filename="fileActiveFilename"
			:active-view="activeView"
			:views="normalizedViews"
			@active-change="handleFileActive"
			@view-change="handleView"
		/>
	</div>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { DEFAULT_ENTRY, NEW_SFC_CODE } from './constants';
import { FilesPreview, RuntimePreview } from './core';
import type { EditorFilesChangeAction } from './editor';
import type { PlaygroundFiles, PlaygroundOptions, PlaygroundView } from './types';

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
	views?: PlaygroundView[];
	styleless?: boolean;
	options?: PlaygroundOptions;
}>(), {
	modelValue: '',
	files: () => ({}),
	entry: '',
	views: () => ['runtime'],
	styleless: false,
	options: () => ({})
});

const filesEqual = (a: PlaygroundFiles, b: PlaygroundFiles) => {
	const aKeys = Object.keys(a);
	const bKeys = Object.keys(b);
	return aKeys.length === bKeys.length
		&& aKeys.every(key => a[key] === b[key]);
};
const initialFiles: PlaygroundFiles = Object.keys(props.files).length
	? { ...props.files }
	: { [DEFAULT_ENTRY]: props.modelValue || NEW_SFC_CODE };
const initialEntry = props.entry && initialFiles[props.entry] !== undefined
	? props.entry
	: Object.keys(initialFiles)[0];
const sourceFiles = ref<PlaygroundFiles>(initialFiles);
const currentEntry = ref(initialEntry);
const fileActiveFilename = ref(initialEntry);

const normalizeViews = (views: PlaygroundView[]) => {
	const normalized: PlaygroundView[] = [];
	for (const view of views) {
		if (!['runtime', 'files'].includes(view) || normalized.includes(view)) continue;
		normalized.push(view);
	}
	return normalized.length ? normalized : ['runtime'] as PlaygroundView[];
};
const normalizedViews = computed(() => normalizeViews(props.views));
const activeView = ref<PlaygroundView>(normalizedViews.value[0]);
const runtimeActivated = ref(props.styleless || activeView.value === 'runtime');
const error = ref(props.entry && initialFiles[props.entry] === undefined
	? `入口文件 ${props.entry} 不存在`
	: '');

const emitFiles = () => emit('update:files', { ...sourceFiles.value });

const handleView = (view: PlaygroundView) => {
	activeView.value = view;
	if (view === 'runtime') runtimeActivated.value = true;
};

const handleFileActive = (filename: string) => {
	if (sourceFiles.value[filename] !== undefined) fileActiveFilename.value = filename;
};

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
		case 'create':
			fileActiveFilename.value = action.filename;
			break;
		case 'rename':
			if (fileActiveFilename.value === action.previousFilename) {
				fileActiveFilename.value = action.filename;
			}
			break;
		case 'delete':
			if (fileActiveFilename.value === action.filename) fileActiveFilename.value = entry;
			break;
		case 'entry':
			fileActiveFilename.value = entry;
			break;
		case 'update':
			break;
	}

	if (action.type !== 'entry') emitFiles();
	if (entry !== previousEntry) emit('update:entry', entry);
	if (action.type === 'update' && action.filename === entry) {
		emit('update:modelValue', files[entry]);
		emit('change', files[entry]);
	}
};

watch(() => props.modelValue, (value: string) => {
	if (Object.keys(props.files).length || sourceFiles.value[currentEntry.value] === value) return;
	sourceFiles.value = { ...sourceFiles.value, [currentEntry.value]: value };
});

watch(() => props.files, (files) => {
	if (!Object.keys(files).length || filesEqual(files, sourceFiles.value)) return;
	const previousEntry = currentEntry.value;
	const entry = props.entry && files[props.entry] !== undefined
		? props.entry
		: Object.keys(files)[0];
	sourceFiles.value = { ...files };
	currentEntry.value = entry;
	error.value = props.entry && files[props.entry] === undefined
		? `入口文件 ${props.entry} 不存在`
		: '';
	if (files[fileActiveFilename.value] === undefined || fileActiveFilename.value === previousEntry) {
		fileActiveFilename.value = entry;
	}
}, { deep: true });

watch(() => props.entry, (entry) => {
	if (!entry || entry === currentEntry.value || !Object.keys(props.files).length) return;
	if (sourceFiles.value[entry] === undefined) {
		error.value = `入口文件 ${entry} 不存在`;
		return;
	}
	const previousEntry = currentEntry.value;
	currentEntry.value = entry;
	if (fileActiveFilename.value === previousEntry) fileActiveFilename.value = entry;
	error.value = '';
});

watch(normalizedViews, (views) => {
	if (!views.includes(activeView.value)) activeView.value = views[0];
	if (!views.includes('runtime')) runtimeActivated.value = false;
	else if (activeView.value === 'runtime') runtimeActivated.value = true;
});
</script>
<style>
.docs-playground {
	display: flex;
	width: 100%;
	margin-bottom: 16px;
	overflow: hidden;

	/* box-shadow: rgb(229 229 229) 0 0 10px; */
	border-radius: 8px;
	box-sizing: border-box;
	justify-content: center;
	flex-direction: column;
}

.docs-playground--files {
	height: 100%;
	min-height: 0;
	overflow: hidden;
	background: #f6f8fa;
	box-shadow: none;
}

.docs-playground__error {
	display: flex;
	justify-content: center;
	align-items: center;
	height: 100%;
	box-sizing: border-box;
}
</style>
