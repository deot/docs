<template>
	<div
		v-if="styleless"
		class="docs-playground-runtime--styleless"
		:style="stylelessStyle"
	>
		<div class="docs-playground-runtime__viewport" :style="viewportStyle">
			<Sandbox
				ref="sandboxRef"
				:store="store"
				:auto-store-init="false"
				:preview-options="runtimePreviewOptions"
			/>
		</div>
	</div>
	<div v-else class="docs-playground-runtime">
		<div class="docs-playground__header">
			<div class="docs-playground__tools">
				<Dropdown
					v-if="viewportOptions.length > 1"
					v-model="viewportMenuVisible"
					class="docs-playground__viewport-menu"
					:portal="true"
					trigger="click"
					placement="bottom-right"
				>
					<button
						type="button"
						class="docs-playground__tool docs-playground__viewport-trigger"
						:class="{ 'is-active': viewport !== 'auto' }"
						:title="`视口：${viewportLabel}`"
						:aria-label="`视口：${viewportLabel}`"
						:aria-expanded="viewportMenuVisible"
						aria-haspopup="menu"
					>
						<PlaygroundIcon name="viewport" />
					</button>
					<template #content>
						<DropdownMenu
							class="docs-playground__viewport-options"
							role="menu"
							aria-label="运行时视口"
						>
							<DropdownItem
								v-for="(item, index) in viewportOptions"
								:key="getViewportKey(item)"
								class="docs-playground__viewport-option"
								:value="index"
								:selected="viewportEquals(item, viewport)"
								role="menuitemradio"
								:aria-checked="viewportEquals(item, viewport)"
								@click="handleViewport(index)"
							>
								{{ formatViewportLabel(item) }}
							</DropdownItem>
						</DropdownMenu>
					</template>
				</Dropdown>
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
					:class="{ 'is-active': item === activeView }"
					:title="PLAYGROUND_VIEW_TEXT[item]"
					:aria-label="PLAYGROUND_VIEW_TEXT[item]"
					:aria-pressed="item === activeView"
					@click="handleView(item)"
				>
					<PlaygroundIcon :name="item" />
				</button>
			</div>
		</div>
		<section class="docs-playground__preview" :style="previewStyle">
			<div class="docs-playground-runtime__viewport-stage">
				<div class="docs-playground-runtime__viewport" :style="viewportStyle">
					<Sandbox
						ref="sandboxRef"
						:store="store"
						:auto-store-init="false"
						:clear-console="clearConsole"
						:preview-options="runtimePreviewOptions"
					/>
				</div>
			</div>
		</section>
	</div>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Clipboard, Dropdown, DropdownItem, DropdownMenu } from '@deot/vc';
import { Sandbox } from '@vue/repl';
import { PLAYGROUND_VIEW_TEXT } from '../../constants';
import { Editor } from '../../editor';
import type { EditorFilesChangeAction } from '../../editor';
import PlaygroundIcon from '../../icon';
import type {
	PlaygroundFiles,
	PlaygroundOptions,
	PlaygroundView,
	PlaygroundViewport
} from '../../types';
import { useSandboxAutoHeight } from './auto-height';
import type { SandboxExposed } from './auto-height';
import { useSandboxRuntimeErrorGuard } from './error-guard';
import {
	formatViewportLabel,
	getViewportHeight,
	getViewportKey,
	getViewportWidth,
	viewportEquals
} from './viewport';
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
	viewport?: PlaygroundViewport;
	viewportOptions?: PlaygroundViewport[];
}>(), {
	styleless: false,
	activeView: 'runtime',
	views: () => ['runtime'],
	viewport: 'auto',
	viewportOptions: () => ['auto', 375]
});
const emit = defineEmits<{
	'files-change': [files: PlaygroundFiles, entry: string, action: EditorFilesChangeAction];
	'view-change': [view: PlaygroundView];
	'viewport-change': [viewport: PlaygroundViewport];
}>();

const env = (import.meta as ImportMeta & { env: { MODE?: string } }).env;
const clearConsole = env.MODE !== 'development';
const copyValue = computed(() => props.files[props.entry] || '');
const store = createRuntimeStore(props.files, props.entry, props.options);
const sandboxRef = ref<SandboxExposed | null>(null);
const runtimeHeight = useSandboxAutoHeight(sandboxRef);
useSandboxRuntimeErrorGuard(sandboxRef);
const viewportMenuVisible = ref(false);
const viewportLabel = computed(() => formatViewportLabel(props.viewport));
const desiredViewportHeight = computed(() => getViewportHeight(props.viewport) || runtimeHeight.value);
const previewStyle = computed(() => ({ height: `${desiredViewportHeight.value + 20}px` }));
const stylelessStyle = computed(() => ({ height: `${desiredViewportHeight.value}px` }));
const viewportStyle = computed(() => {
	const width = getViewportWidth(props.viewport);
	return {
		width: width ? `${width}px` : '100%',
		maxWidth: '100%',
		height: '100%'
	};
});
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
const handleViewport = (index: number) => {
	const viewport = props.viewportOptions[index];
	if (viewport && !viewportEquals(viewport, props.viewport)) {
		emit('viewport-change', viewport);
	}
};

watch(() => props.viewportOptions.length, (length) => {
	if (length <= 1) viewportMenuVisible.value = false;
});

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
<style lang="scss">
@use '../../style' as *;

@include block(docs-playground-runtime) {
	display: flex;
	width: 100%;
	min-height: 0;
	overflow: hidden;
	flex: 1 1 auto;
	flex-direction: column;

	@include modifier(styleless) {
		display: flex;
		width: 100%;
		min-height: 0;
		overflow: hidden;
		justify-content: center;
	}

	@include element(viewport-stage) {
		display: flex;
		width: 100%;
		height: 100%;
		min-width: 0;
		justify-content: center;
	}

	@include element(viewport) {
		position: relative;
		height: 100%;
		min-width: 0;
		overflow: hidden;
		box-sizing: border-box;
		flex: 0 1 auto;
	}
}

@include block(docs-playground) {
	@include element(header) {
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

	@include element(views) {
		display: flex;
		gap: 4px;
	}

	@include element(view) {
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

		@include when(active) {
			color: #fff;
			background: #2563eb;
		}
	}

	@include element(tools) {
		display: flex;
		margin-right: 4px;
		margin-left: auto;
		font-size: 14px;
		line-height: 20px;
		align-items: center;
	}

	@include element(tool) {
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

		&:hover {
			color: #2563eb;
			background: #e8eef8;
		}

		@include when(active) {
			color: #2563eb;
			background: #e8eef8;
		}
	}

	@include element(viewport-menu) {
		display: inline-flex;
	}

	@include element(viewport-trigger) {
		.docs-playground-icon {
			width: 20px;
			height: 20px;
		}
	}

	@include element(viewport-options) {
		min-width: 136px;
	}

	@include element(viewport-option) {
		white-space: nowrap;
	}

	@include element(editor) {
		.docs-playground-icon {
			width: 22px;
			height: 22px;
		}
	}

	@include element(preview) {
		min-height: 0;
		padding: 10px;
		overflow: hidden;
		background: #fff;
		box-sizing: border-box;
		flex: 1 1 auto;
	}
}
</style>
