<template>
	<Sandbox
		v-if="styleless"
		:store="store"
		:auto-store-init="false"
		:preview-options="runtimePreviewOptions"
	/>
	<div v-else class="docs-playground-runtime">
		<div class="docs-playground__header">
			<div class="docs-playground__tools">
				<Clipboard
					class="docs-playground__tool"
					:value="copyValue"
					tag="button"
					type="button"
					title="复制"
					aria-label="复制"
				>
					<PlaygroundIcon name="copy" />
				</Clipboard>
				<button
					type="button"
					class="docs-playground__tool docs-playground__editor"
					data-action="edit"
					title="编辑文件"
					aria-label="编辑文件"
					@click="handleEditor"
				>
					<PlaygroundIcon name="editor" />
				</button>
			</div>
			<div v-if="views.length > 1" class="docs-playground__views">
				<button
					v-for="item in views"
					:key="item"
					type="button"
					class="docs-playground__view"
					:class="{ active: item === activeView }"
					:title="PLAYGROUND_VIEW_TEXT[item]"
					:aria-label="PLAYGROUND_VIEW_TEXT[item]"
					:aria-pressed="item === activeView"
					@click="handleView(item)"
				>
					<PlaygroundIcon :name="item" />
				</button>
			</div>
		</div>
		<section class="docs-playground__preview">
			<Sandbox
				:store="store"
				:auto-store-init="false"
				:clear-console="clearConsole"
				:preview-options="runtimePreviewOptions"
			/>
		</section>
	</div>
</template>
<script setup lang="ts">
import { computed, watch } from 'vue';
import { Clipboard } from '@deot/vc';
import { Sandbox } from '@vue/repl';
import { PLAYGROUND_VIEW_TEXT } from '../../constants';
import { Editor } from '../../editor';
import type { EditorFilesChangeAction } from '../../editor';
import PlaygroundIcon from '../../icon';
import type { PlaygroundFiles, PlaygroundOptions, PlaygroundView } from '../../types';
import {
	createReplFile,
	createRuntimeStore,
	runtimePreviewOptions,
	toReplFilename
} from '../store';

const props = withDefaults(defineProps<{
	files: PlaygroundFiles;
	entry: string;
	options: PlaygroundOptions;
	styleless?: boolean;
	activeView?: PlaygroundView;
	views?: PlaygroundView[];
}>(), {
	styleless: false,
	activeView: 'runtime',
	views: () => ['runtime']
});
const emit = defineEmits<{
	'files-change': [files: PlaygroundFiles, entry: string, action: EditorFilesChangeAction];
	'view-change': [view: PlaygroundView];
}>();

const env = (import.meta as ImportMeta & { env: { MODE?: string } }).env;
const clearConsole = env.MODE !== 'development';
const copyValue = computed(() => props.files[props.entry] || '');
const store = createRuntimeStore(props.files, props.entry, props.options);
let syncedFiles = { ...props.files };
let syncedEntry = props.entry;

const filesEqual = (a: PlaygroundFiles, b: PlaygroundFiles) => {
	const aKeys = Object.keys(a);
	const bKeys = Object.keys(b);
	return aKeys.length === bKeys.length
		&& aKeys.every(key => a[key] === b[key]);
};

const handleFilesChange = (
	files: PlaygroundFiles,
	entry: string,
	action: EditorFilesChangeAction
) => {
	syncedFiles = { ...files };
	syncedEntry = entry;
	switch (action.type) {
		case 'update': {
			const file = store.files[toReplFilename(action.filename)];
			if (file) file.code = files[action.filename];
			break;
		}
		case 'create':
			store.addFile(createReplFile(action.filename, files[action.filename]));
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
			store.setActive(toReplFilename(entry));
			break;
	}
	emit('files-change', files, entry, action);
};

const handleEditor = () => {
	Editor.popup({
		files: { ...props.files },
		entry: props.entry,
		getCodeErrors: () => store.errors,
		onFilesChange: handleFilesChange,
		onActiveChange: (filename: string) => store.setActive(toReplFilename(filename))
	});
};
const handleView = (view: PlaygroundView) => emit('view-change', view);

watch(() => props.files, (files) => {
	if (filesEqual(files, syncedFiles)) return;
	syncedFiles = { ...files };
	syncedEntry = props.entry;
	void store.setFiles(files, props.entry);
}, { deep: true });

watch(() => props.entry, (entry) => {
	if (!entry || entry === syncedEntry) return;
	syncedEntry = entry;
	store.mainFile = toReplFilename(entry);
	store.setActive(toReplFilename(entry));
});
</script>
<style>
.docs-playground-runtime {
	display: flex;
	min-height: 0;
	flex: 1 1 auto;
	flex-direction: column;
}

.docs-playground__header {
	display: flex;
	height: 48px;
	padding: 0 12px;
	background: #f7f8fa !important;
	box-shadow: inset 0 -1px #edeff1;
	box-sizing: border-box;
	justify-content: flex-end;
	align-items: center;
	flex: 0 0 48px;
}

.docs-playground__views {
	display: flex;
	gap: 4px;
}

.docs-playground__view {
	display: inline-flex;
	width: 30px;
	height: 30px;
	padding: 0;
	font: inherit;
	color: #64748b;
	cursor: pointer;
	background: transparent;
	border: 0;
	border-radius: 8px;
	justify-content: center;
	align-items: center;
}

.docs-playground__view.active {
	color: #fff;
	background: #2563eb;
}

.docs-playground__tools {
	display: flex;
	margin-right: 4px;
	margin-left: auto;
	font-size: 14px;
	line-height: 20px;
	align-items: center;
}

.docs-playground__tool {
	display: inline-flex;
	width: 30px;
	height: 30px;
	padding: 0;
	font: inherit;
	color: #64748b;
	cursor: pointer;
	background: transparent;
	border: 0;
	border-radius: 8px;
	justify-content: center;
	align-items: center;
}

.docs-playground__tool:hover {
	color: #2563eb;
	background: #e8eef8;
}

.docs-playground__editor .docs-playground-icon {
	width: 22px;
	height: 22px;
}

.docs-playground__preview {
	min-height: 0;
	padding: 10px;
	background: #fff;
	box-sizing: border-box;
	flex: 1 1 auto;
}
</style>
