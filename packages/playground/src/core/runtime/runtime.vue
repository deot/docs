<template>
	<div
		v-if="styleless"
		class="docs-playground-runtime--styleless"
		:style="stylelessStyle"
	>
		<pre
			v-if="errorText"
			class="docs-playground__runtime-error"
			role="alert"
		>{{ errorText }}</pre>
		<div class="docs-playground-runtime__viewport" :style="viewportStyle">
			<Sandbox
				ref="sandboxRef"
				:store="store"
				:auto-store-init="false"
				:preview-options="mergedPreviewOptions"
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
						:title="t('playground.runtime.viewport', { value: viewportLabel })"
						:aria-label="t('playground.runtime.viewport', { value: viewportLabel })"
						:aria-expanded="viewportMenuVisible"
						aria-haspopup="menu"
					>
						<PlaygroundIcon name="viewport" />
					</button>
					<template #content>
						<DropdownMenu
							class="docs-playground__viewport-options"
							role="menu"
							:aria-label="t('playground.runtime.viewportMenu')"
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
								{{ formatViewportLabel(item, t('playground.runtime.auto')) }}
							</DropdownItem>
						</DropdownMenu>
					</template>
				</Dropdown>
				<Clipboard
					class="docs-playground__tool"
					:value="copyValue"
					tag="button"
					type="button"
					:title="t('playground.common.copy')"
					:aria-label="t('playground.common.copy')"
				>
					<PlaygroundIcon name="copy" />
				</Clipboard>
				<button
					type="button"
					class="docs-playground__tool docs-playground__editor"
					data-action="edit"
					:title="t('playground.runtime.editFiles')"
					:aria-label="t('playground.runtime.editFiles')"
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
					:title="getViewText(item)"
					:aria-label="getViewText(item)"
					:aria-pressed="item === activeView"
					@click="handleView(item)"
				>
					<PlaygroundIcon :name="item" />
				</button>
			</div>
		</div>
		<pre
			v-if="errorText"
			class="docs-playground__runtime-error"
			role="alert"
		>{{ errorText }}</pre>
		<section class="docs-playground__preview" :style="previewStyle">
			<div class="docs-playground-runtime__viewport-stage">
				<div class="docs-playground-runtime__viewport" :style="viewportStyle">
					<Sandbox
						ref="sandboxRef"
						:store="store"
						:auto-store-init="false"
						:clear-console="clearConsole"
						:preview-options="mergedPreviewOptions"
					/>
				</div>
			</div>
		</section>
	</div>
</template>
<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { Clipboard, Dropdown, DropdownItem, DropdownMenu } from '@deot/vc';
import { useLocale } from '@deot/docs-locale';
import { Sandbox } from '@vue/repl';
import { Editor } from '../../editor';
import type { EditorFilesChangeAction } from '../../editor';
import PlaygroundIcon from '../../icon';
import type {
	PlaygroundFiles,
	PlaygroundFilesProps,
	PlaygroundOptions,
	PlaygroundPreviewOptions,
	PlaygroundView,
	PlaygroundViewport,
	PlaygroundViewsProps
} from '../../types';
import { filesEqual, playgroundViewMessage } from '../../utils';
import { resolveSandboxContainer, useSandboxAutoHeight } from './auto-height';
import type { SandboxExposed } from './auto-height';
import {
	formatSandboxRuntimeError,
	toErrorText,
	useSandboxRuntimeErrorGuard
} from './error-guard';
import { useSandboxTheme } from './theme';
import {
	formatViewportLabel,
	getViewportHeight,
	getViewportKey,
	getViewportWidth,
	viewportEquals
} from './viewport';
import {
	createReplFile,
	createRuntimePreviewOptions,
	createRuntimeStore,
	toReplFilename
} from '../store';
import { whenSassReady } from '../scss';

const props = withDefaults(defineProps<PlaygroundFilesProps & Partial<PlaygroundViewsProps> & {
	options: PlaygroundOptions;
	previewOptions?: PlaygroundPreviewOptions;
	styleless?: boolean;
	viewport?: PlaygroundViewport;
	viewportOptions?: PlaygroundViewport[];
}>(), {
	styleless: false,
	activeView: 'runtime',
	views: () => ['runtime'],
	viewport: 'auto',
	viewportOptions: () => ['auto', 375]
});
const { locale, t } = useLocale();
const getViewText = (view: PlaygroundView) => t(playgroundViewMessage(view));
const emit = defineEmits<{
	'files-change': [files: PlaygroundFiles, entry: string, action: EditorFilesChangeAction];
	'view-change': [view: PlaygroundView];
	'viewport-change': [viewport: PlaygroundViewport];
	'navigate': [to: string];
}>();

const joinCode = (...values: Array<string | undefined>) => values.filter(Boolean).join('\n');
const mergedPreviewOptions = computed(() => {
	const runtimePreviewOptions = createRuntimePreviewOptions(props.options.cdnURL);
	return {
		...runtimePreviewOptions,
		...props.previewOptions,
		headHTML: [
			runtimePreviewOptions.headHTML,
			props.previewOptions?.headHTML
		].filter(Boolean).join('\n'),
		customCode: {
			importCode: joinCode(
				runtimePreviewOptions.customCode?.importCode,
				props.previewOptions?.customCode?.importCode
			),
			useCode: joinCode(
				runtimePreviewOptions.customCode?.useCode,
				props.previewOptions?.customCode?.useCode
			)
		}
	};
});

const env = (import.meta as ImportMeta & { env: { MODE?: string } }).env;
const clearConsole = env.MODE !== 'development';
const copyValue = computed(() => props.files[props.entry] || '');
const store = createRuntimeStore(props.files, props.entry, props.options);
const sandboxRef = ref<SandboxExposed | null>(null);
const runtimeHeight = useSandboxAutoHeight(sandboxRef);
const runtimeError = useSandboxRuntimeErrorGuard(sandboxRef);
useSandboxTheme(sandboxRef);
const compileErrorText = computed(() => (store.errors || [])
	.map(toErrorText)
	.filter(Boolean)
	.join('\n'));
const errorText = computed(() => {
	const runtime = runtimeError.value
		? formatSandboxRuntimeError(runtimeError.value, t('playground.runtime.importMapTip'))
		: '';
	return [compileErrorText.value, runtime].filter(Boolean).join('\n\n');
});
const handleBridgeMessage = (event: MessageEvent) => {
	const iframe = resolveSandboxContainer(sandboxRef.value)?.querySelector('iframe');
	if (!iframe || event.source !== iframe.contentWindow) return;
	const data = event.data;
	if (
		!data
		|| data.action !== 'docs:navigate'
		|| typeof data.to !== 'string'
	) return;
	emit('navigate', data.to);
};
if (typeof window !== 'undefined') window.addEventListener('message', handleBridgeMessage);
onBeforeUnmount(() => window.removeEventListener('message', handleBridgeMessage));
const viewportMenuVisible = ref(false);
const viewportLabel = computed(() => formatViewportLabel(
	props.viewport,
	t('playground.runtime.auto')
));
const desiredViewportHeight = computed(() => getViewportHeight(props.viewport) || runtimeHeight.value);
const previewStyle = computed(() => ({ height: `${desiredViewportHeight.value + 20}px` }));
const stylelessStyle = computed(() => (errorText.value
	? undefined
	: { height: `${desiredViewportHeight.value}px` }));
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

const handleFilesChange = (
	files: PlaygroundFiles,
	entry: string,
	action: EditorFilesChangeAction
) => {
	syncedFiles = { ...files };
	syncedEntry = entry;
	const apply = () => {
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
	whenSassReady(files, apply);
};

const handleEditor = () => {
	Editor.popup({
		files: { ...props.files },
		entry: props.entry,
		locale: locale.value,
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
	runtimeError.value = '';
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
		flex-direction: column;
		align-items: center;

		.docs-playground__runtime-error {
			align-self: stretch;
		}
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
		padding: 0 12px;
		background: var(--docs-background-color-soft, var(--vc-background-color, #f7f8fa)) !important;
		box-shadow: inset 0 -1px var(--docs-border-color, var(--vc-color-light-deeper, #edeff1));
		box-sizing: border-box;
		justify-content: flex-end;
		align-items: center;
		flex: 0 0 44px;
	}

	@include element(views) {
		display: flex;
		gap: 4px;
	}

	@include element(view) {
		display: inline-flex;
		width: 28px;
		height: 28px;
		padding: 0;
		font: inherit;
		color: var(--docs-foreground-color-mute, var(--vc-color-dark-lightest, #64748b));
		cursor: pointer;
		background: transparent;
		border: 0;
		border-radius: 8px;
		justify-content: center;
		align-items: center;

		@include when(active) {
			color: var(--vc-color-light, #fff);
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
		width: 28px;
		height: 28px;
		padding: 0;
		font: inherit;
		color: var(--docs-foreground-color-mute, var(--vc-color-dark-lightest, #64748b));
		cursor: pointer;
		background: transparent;
		border: 0;
		border-radius: 8px;
		justify-content: center;
		align-items: center;

		&:hover {
			color: #2563eb;
			background: var(--docs-primary-color-light, var(--vc-color-primary-lighter, #e8eef8));
		}

		@include when(active) {
			color: #2563eb;
			background: var(--docs-primary-color-light, var(--vc-color-primary-lighter, #e8eef8));
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
		background: var(--docs-background-color, var(--vc-background-color-light, #fff));
		box-sizing: border-box;
		flex: 1 1 auto;
	}

	@include element(runtime-error) {
		max-height: 240px;
		padding: 12px 16px;
		margin: 0;
		overflow: auto;
		font: inherit;
		font-size: 13px;
		line-height: 1.6;
		color: var(--vc-color-error, #b91c1c);
		white-space: pre-wrap;
		background: var(--docs-error-background, #fef2f2);
		border-top: 1px solid #f5c2c2;
		box-sizing: border-box;
		overflow-wrap: anywhere;
	}
}
</style>
