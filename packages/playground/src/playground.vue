<template>
	<RuntimePreview
		v-if="styleless"
		:files="sourceFiles"
		:entry="currentEntry"
		:options="options"
		:preview-options="previewOptions"
		:styleless="true"
		:viewport="activeViewport"
		:viewport-options="selectableViewportOptions"
		@files-change="handleFilesChange"
		@navigate="emit('navigate', $event)"
		@viewport-change="handleViewport"
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
			:preview-options="previewOptions"
			:active-view="activeView"
			:views="normalizedViews"
			:viewport="activeViewport"
			:viewport-options="selectableViewportOptions"
			@files-change="handleFilesChange"
			@navigate="emit('navigate', $event)"
			@view-change="handleView"
			@viewport-change="handleViewport"
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
import { provideLocale, useLocale } from '@deot/docs-locale';
import type { Language } from '@deot/docs-locale';
import { DEFAULT_ENTRY, NEW_SFC_CODE } from './constants';
import { filesEqual } from './utils';
import { FilesPreview, RuntimePreview } from './core';
import type { EditorFilesChangeAction } from './editor';
import type {
	PlaygroundFiles,
	PlaygroundOptions,
	PlaygroundPreviewOptions,
	PlaygroundView,
	PlaygroundViewport
} from './types';
import {
	cloneViewport,
	includeActiveViewport,
	isValidViewport,
	normalizeViewportOptions,
	resolveInitialViewport,
	viewportEquals
} from './core/runtime/viewport';

const emit = defineEmits<{
	'update:modelValue': [value: string];
	'update:files': [files: PlaygroundFiles];
	'update:entry': [entry: string];
	'update:viewport': [viewport: PlaygroundViewport];
	'change': [value: string];
	'navigate': [to: string];
}>();
const props = withDefaults(defineProps<{
	modelValue?: string;
	files?: PlaygroundFiles;
	entry?: string;
	views?: readonly string[];
	viewport?: PlaygroundViewport;
	viewportOptions?: readonly unknown[];
	styleless?: boolean;
	options?: PlaygroundOptions;
	previewOptions?: PlaygroundPreviewOptions;
	locale?: Language;
}>(), {
	modelValue: '',
	files: () => ({}),
	entry: '',
	views: () => ['runtime'],
	styleless: false,
	options: () => ({})
});
const inheritedLocale = useLocale();
const locale = computed(() => props.locale || inheritedLocale.locale.value);
provideLocale(locale);
const { t } = useLocale(locale);

const initialFiles: PlaygroundFiles = Object.keys(props.files).length
	? { ...props.files }
	: { [DEFAULT_ENTRY]: props.modelValue || NEW_SFC_CODE };
const initialEntry = props.entry && initialFiles[props.entry] !== undefined
	? props.entry
	: Object.keys(initialFiles)[0];
const sourceFiles = ref<PlaygroundFiles>(initialFiles);
const currentEntry = ref(initialEntry);
const fileActiveFilename = ref(initialEntry);

const normalizeViews = (views: readonly unknown[]) => {
	const normalized: PlaygroundView[] = [];
	for (const view of views) {
		if (view !== 'runtime' && view !== 'files') continue;
		if (normalized.includes(view)) continue;
		normalized.push(view);
	}
	return normalized.length ? normalized : ['runtime'] satisfies PlaygroundView[];
};
const normalizedViews = computed(() => normalizeViews(props.views));
const activeView = ref<PlaygroundView>(normalizedViews.value[0]);
const runtimeActivated = ref(props.styleless || activeView.value === 'runtime');
const normalizedViewportOptions = computed(() => normalizeViewportOptions(props.viewportOptions));
const activeViewport = ref<PlaygroundViewport>(resolveInitialViewport(
	props.viewport,
	normalizedViewportOptions.value
));
const selectableViewportOptions = computed(() => includeActiveViewport(
	normalizedViewportOptions.value,
	activeViewport.value
));
const error = ref(props.entry && initialFiles[props.entry] === undefined
	? t('playground.validation.entryMissing', { filename: props.entry })
	: '');

watch(locale, () => {
	if (props.entry && sourceFiles.value[props.entry] === undefined) {
		error.value = t('playground.validation.entryMissing', { filename: props.entry });
	}
});

const emitFiles = () => emit('update:files', { ...sourceFiles.value });

const handleView = (view: PlaygroundView) => {
	activeView.value = view;
	if (view === 'runtime') runtimeActivated.value = true;
};

const handleViewport = (viewport: PlaygroundViewport) => {
	if (!isValidViewport(viewport) || viewportEquals(activeViewport.value, viewport)) return;
	activeViewport.value = cloneViewport(viewport);
	emit('update:viewport', cloneViewport(viewport));
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

watch(() => props.modelValue, (value) => {
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
		? t('playground.validation.entryMissing', { filename: props.entry })
		: '';
	if (files[fileActiveFilename.value] === undefined || fileActiveFilename.value === previousEntry) {
		fileActiveFilename.value = entry;
	}
}, { deep: true });

watch(() => props.entry, (entry) => {
	if (!entry || entry === currentEntry.value || !Object.keys(props.files).length) return;
	if (sourceFiles.value[entry] === undefined) {
		error.value = t('playground.validation.entryMissing', { filename: entry });
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

watch(() => props.viewport, (viewport) => {
	const nextViewport = resolveInitialViewport(viewport, normalizedViewportOptions.value);
	if (viewportEquals(activeViewport.value, nextViewport)) return;
	activeViewport.value = nextViewport;
});

watch(normalizedViewportOptions, (options) => {
	if (!options.length) {
		const nextViewport = resolveInitialViewport(props.viewport, options);
		if (!viewportEquals(activeViewport.value, nextViewport)) activeViewport.value = nextViewport;
		return;
	}
	if (options.some(viewport => viewportEquals(viewport, activeViewport.value))) return;
	activeViewport.value = isValidViewport(props.viewport)
		? cloneViewport(props.viewport)
		: cloneViewport(options[0]);
});
</script>
<style lang="scss">
@use './style' as *;
@use '../node_modules/@deot/docs-theme/src/variables';

@include block(docs-playground) {
	display: flex;
	width: 100%;
	margin-bottom: 16px;
	overflow: hidden;

	/* box-shadow: rgb(229 229 229) 0 0 10px; */
	border-radius: 8px;
	box-sizing: border-box;
	justify-content: center;
	flex-direction: column;

	@include modifier(files) {
		height: 100%;
		min-height: 0;
		overflow: hidden;
		background: var(--docs-code-background, var(--vc-background-color, #f6f8fa));
		box-shadow: none;
	}

	@include element(error) {
		display: flex;
		height: 100%;
		box-sizing: border-box;
		justify-content: center;
		align-items: center;
	}
}
</style>
