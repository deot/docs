<template>
	<div class="docs-playground-runtime-host">
		<div
			v-if="styleless"
			ref="runtimeRoot"
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
		<div v-else ref="runtimeRoot" class="docs-playground-runtime">
			<div class="docs-playground__header">
				<span
					v-if="displayTitle"
					ref="titleEl"
					class="docs-playground__title"
					:id="titleId"
					tabindex="-1"
					:title="displayTitle"
				>
					<a
						class="docs-playground__title-anchor"
						:href="`#${titleId}`"
					>#</a>
					<span class="docs-playground__title-text">{{ displayTitle }}</span>
				</span>
				<RuntimeToolbar
					:copy-value="copyValue"
					:viewport="viewport"
					:viewport-options="viewportOptions"
					:show-open-popup="true"
					@refresh="handleInlineRefresh"
					@edit="handleEditor"
					@open-popup="handleOpenPopup"
					@viewport-change="handleViewportChange"
				/>
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
			<section
				class="docs-playground__preview"
				:class="{ 'is-expanded': previewExpanded }"
				:style="previewStyle"
			>
				<div class="docs-playground-runtime__viewport-stage">
					<div class="docs-playground-runtime__viewport" :style="viewportStyle">
						<Sandbox
							:key="sandboxKey"
							ref="sandboxRef"
							:store="store"
							:auto-store-init="false"
							:clear-console="clearConsole"
							:preview-options="mergedPreviewOptions"
						/>
					</div>
				</div>
				<button
					v-if="canExpandPreview"
					type="button"
					class="docs-playground__expand"
					data-action="expand-preview"
					:class="{ 'is-expanded': previewExpanded }"
					:aria-expanded="previewExpanded"
					:title="expandLabel"
					:aria-label="expandLabel"
					@click="handleTogglePreviewExpand"
				>
					<PlaygroundIcon name="expand" />
				</button>
			</section>
		</div>
	</div>
</template>
<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { useLocale } from '@deot/docs-locale';
import { Sandbox } from '@vue/repl';
import { Editor } from '../../editor';
import type { EditorFilesChangeAction } from '../../editor';
import PlaygroundIcon from '../../icon';
import type {
	PlaygroundExpandable,
	PlaygroundFiles,
	PlaygroundFilesProps,
	PlaygroundOptions,
	PlaygroundPreviewInset,
	PlaygroundPreviewOptions,
	PlaygroundView,
	PlaygroundViewport,
	PlaygroundViewsProps
} from '../../types';
import { filesEqual, playgroundViewMessage, resolvePlaygroundTitleId } from '../../utils';
import { resolveSandboxContainer, useSandboxAutoHeight } from './auto-height';
import type { SandboxExposed } from './auto-height';
import {
	getVisibleViewportRect,
	isPlaygroundExpandable,
	resolveExpandedPreviewHeight,
	resolveRemainingPreviewHeight,
	scrollPlaygroundToViewportStart
} from './expand';
import {
	formatSandboxRuntimeError,
	toErrorText,
	useSandboxRuntimeErrorGuard
} from './error-guard';
import { Alone } from './alone';
import { useSandboxTheme } from './theme';
import RuntimeToolbar from './toolbar.vue';
import {
	getViewportHeight,
	getViewportWidth
} from './viewport';
import {
	createReplFile,
	createRuntimePreviewOptions,
	createRuntimeStore,
	PLAYGROUND_RUNTIME_CANVAS_BACKGROUND,
	toReplFilename
} from '../store';
import { whenSassReady } from '../scss';

const props = withDefaults(defineProps<PlaygroundFilesProps & Partial<PlaygroundViewsProps> & {
	options: PlaygroundOptions;
	previewInset?: PlaygroundPreviewInset;
	previewOptions?: PlaygroundPreviewOptions;
	styleless?: boolean;
	expandable?: PlaygroundExpandable;
	title?: string;
	id?: string;
	viewport?: PlaygroundViewport;
	viewportOptions?: PlaygroundViewport[];
}>(), {
	styleless: false,
	previewInset: 10,
	title: '',
	id: '',
	activeView: 'runtime',
	views: () => ['runtime'],
	viewport: 'auto',
	viewportOptions: () => ['auto', 375]
});
const { locale, t } = useLocale();
const getViewText = (view: PlaygroundView) => t(playgroundViewMessage(view));
const displayTitle = computed(() => props.title.trim());
const titleEl = ref<HTMLElement | null>(null);
const titleId = computed(() => resolvePlaygroundTitleId(
	displayTitle.value,
	props.id,
	(candidate) => {
		if (typeof document === 'undefined') return false;
		const existing = document.getElementById(candidate);
		return !!existing && existing !== titleEl.value;
	}
));
const emit = defineEmits<{
	'files-change': [files: PlaygroundFiles, entry: string, action: EditorFilesChangeAction];
	'view-change': [view: PlaygroundView];
	'viewport-change': [viewport: PlaygroundViewport];
	'navigate': [to: string];
}>();

const joinCode = (...values: Array<string | undefined>) => values.filter(Boolean).join('\n');
const mergePreviewOptions = (
	extraHeadHTML?: string
): NonNullable<PlaygroundPreviewOptions> => {
	const runtimePreviewOptions = createRuntimePreviewOptions(props.options.cdnURL);
	return {
		...runtimePreviewOptions,
		...props.previewOptions,
		headHTML: [
			runtimePreviewOptions.headHTML,
			props.previewOptions?.headHTML,
			extraHeadHTML
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
};
const mergedPreviewOptions = computed(() => mergePreviewOptions());
const popupPreviewOptions = computed(() => mergePreviewOptions(
	'<style>html,body{height:100%;min-height:100%}</style>'
));

const env = (import.meta as ImportMeta & { env: { MODE?: string } }).env;
const clearConsole = env.MODE !== 'development';
const copyValue = computed(() => props.files[props.entry] || '');
const store = createRuntimeStore(props.files, props.entry, props.options);
const sandboxRef = ref<SandboxExposed | null>(null);
const sandboxKey = ref(0);
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
const runtimeRoot = ref<HTMLElement | null>(null);
const previewExpanded = ref(false);
/** `expandable: true` 时在展开瞬间冻结，避免滚动重算高度造成抖动。 */
const frozenExpandedHeight = ref(0);

const measurePreviewChromeHeight = () => {
	const root = runtimeRoot.value;
	if (!root) return 0;
	const header = root.querySelector('.docs-playground__header');
	const error = root.querySelector('.docs-playground__runtime-error');
	return (header instanceof HTMLElement ? header.offsetHeight : 0)
		+ (error instanceof HTMLElement ? error.offsetHeight : 0);
};

const measureExpandedPreviewHeight = () => {
	if (typeof window === 'undefined') return runtimeHeight.value;
	const chromeHeight = measurePreviewChromeHeight();
	const viewport = getVisibleViewportRect(runtimeRoot.value);
	return resolveExpandedPreviewHeight(
		true,
		resolveRemainingPreviewHeight({
			viewportHeight: viewport.height,
			chromeHeight
		})
	);
};

const syncFrozenExpandedHeight = () => {
	if (!previewExpanded.value || props.expandable !== true) return;
	frozenExpandedHeight.value = measureExpandedPreviewHeight();
};

if (typeof window !== 'undefined') {
	window.addEventListener('message', handleBridgeMessage);
	window.addEventListener('resize', syncFrozenExpandedHeight);
}
const canExpandPreview = computed(() => !props.styleless && isPlaygroundExpandable(props.expandable));
const expandLabel = computed(() => t(previewExpanded.value
	? 'playground.runtime.collapsePreview'
	: 'playground.runtime.expandPreview'));
const desiredViewportHeight = computed(() => {
	if (previewExpanded.value && props.expandable === true) {
		return frozenExpandedHeight.value;
	}
	if (previewExpanded.value && isPlaygroundExpandable(props.expandable)) {
		return resolveExpandedPreviewHeight(props.expandable, 0);
	}
	const fixedHeight = getViewportHeight(props.viewport);
	if (fixedHeight) return fixedHeight;
	return runtimeHeight.value;
});
const scrollExpandedPreviewIntoView = () => {
	scrollPlaygroundToViewportStart(runtimeRoot.value);
};

const handleTogglePreviewExpand = () => {
	if (!canExpandPreview.value) return;
	if (!previewExpanded.value) {
		if (props.expandable === true) {
			frozenExpandedHeight.value = measureExpandedPreviewHeight();
		} else {
			frozenExpandedHeight.value = 0;
		}
		previewExpanded.value = true;
		void nextTick(scrollExpandedPreviewIntoView);
		return;
	}
	previewExpanded.value = false;
	frozenExpandedHeight.value = 0;
};
watch(canExpandPreview, (enabled) => {
	if (!enabled) {
		previewExpanded.value = false;
		frozenExpandedHeight.value = 0;
	}
});
const normalizedPreviewInset = computed<[vertical: number, horizontal: number]>(() => {
	const value = props.previewInset;
	if (typeof value === 'number') {
		return Number.isFinite(value) && value >= 0 ? [value, value] : [10, 10];
	}
	if (Array.isArray(value)
		&& value.length === 2
		&& value.every(item => typeof item === 'number' && Number.isFinite(item) && item >= 0)) {
		return [value[0], value[1]];
	}
	return [10, 10];
});
const previewStyle = computed(() => {
	const [vertical, horizontal] = normalizedPreviewInset.value;
	return {
		height: `${desiredViewportHeight.value + vertical * 2}px`,
		padding: vertical === horizontal
			? `${vertical}px`
			: `${vertical}px ${horizontal}px`,
		background: PLAYGROUND_RUNTIME_CANVAS_BACKGROUND
	};
});
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
const handleInlineRefresh = () => {
	runtimeError.value = '';
	sandboxKey.value++;
};
const handleClosePopup = () => {
	Alone.destroy();
};
const handleOpenPopup = () => {
	Alone.popup({
		store,
		copyValue: copyValue.value,
		title: props.title,
		viewport: props.viewport,
		viewportOptions: props.viewportOptions,
		previewOptions: popupPreviewOptions.value,
		clearConsole,
		onEdit: handleEditor,
		onViewportChange: handleViewportChange,
		onNavigate: (to: string) => emit('navigate', to)
	});
};
const handleView = (view: PlaygroundView) => emit('view-change', view);
const handleViewportChange = (viewport: PlaygroundViewport) => {
	emit('viewport-change', viewport);
};

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

watch(() => props.activeView, (view) => {
	if (view !== 'runtime') handleClosePopup();
});

onBeforeUnmount(() => {
	window.removeEventListener('message', handleBridgeMessage);
	window.removeEventListener('resize', syncFrozenExpandedHeight);
	handleClosePopup();
});
</script>
<style lang="scss">
@use '../../style' as *;

@include block(docs-playground-runtime-host) {
	display: flex;
	width: 100%;
	min-height: 0;
	overflow: hidden;
	flex: 1 1 auto;
	flex-direction: column;
}

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
	.iframe-container,
	.iframe-container iframe {
		width: 100%;
		height: 100%;

		// 覆盖 @vue/repl 的 iframe `#fff` / `.dark` `#1e1e1e`，与 sandbox 画布对齐。
		background: var(--vc-background-color-light, var(--docs-background-color, #fff)) !important;
	}

	.iframe-container iframe {
		display: block;
		border: 0;
	}

	@include element(header) {
		display: flex;
		padding: 0 12px;
		background: var(--docs-background-color-soft, var(--vc-background-color, #f7f8fa)) !important;
		border-bottom: 1px solid var(--docs-border-color, var(--vc-color-light-deeper, #e5e7eb));
		box-sizing: border-box;
		justify-content: flex-end;
		align-items: center;
		flex: 0 0 44px;
	}

	@include element(title) {
		display: inline-flex;
		min-width: 0;
		padding-right: 12px;
		padding-left: 14px;
		overflow: hidden;
		font-size: 16px;
		font-weight: 500;
		line-height: 20px;
		color: var(--docs-foreground-color, var(--vc-foreground-color, #18181b));
		flex: 1 1 auto;
		align-items: center;
	}

	@include element(title-anchor) {
		width: 14px;
		margin-left: -14px;
		font-size: 12px;
		line-height: 1;
		color: inherit;
		text-align: center;
		text-decoration: none;
		opacity: 0;
		flex: 0 0 14px;
		transition: opacity 0.2s ease;

		&:focus-visible {
			outline: 2px solid var(--docs-primary-color, var(--vc-color-primary, #2563eb));
			outline-offset: 1px;
			opacity: 1;
		}
	}

	@include element(title-text) {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.docs-playground__title:hover .docs-playground__title-anchor {
		opacity: 1;
	}

	@include element(views) {
		display: flex;
		padding-left: 8px;
		margin-left: 4px;
		border-left: 1px solid var(--docs-border-color, var(--vc-color-light-deeper, #e5e7eb));
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
		transition: color 0.15s ease, background-color 0.15s ease;

		&:hover {
			color: var(--docs-primary-color, var(--vc-color-primary, #2563eb));
			background: var(--docs-primary-color-light, var(--vc-color-primary-lighter, #e8eef8));
		}

		&:focus-visible {
			outline: 2px solid var(--docs-primary-color, var(--vc-color-primary, #2563eb));
			outline-offset: 1px;
		}

		@include when(active) {
			color: var(--docs-primary-color, var(--vc-color-primary, #2563eb));
			background: var(--docs-primary-color-light, var(--vc-color-primary-lighter, #e8eef8));
		}
	}

	@include element(tools) {
		display: flex;
		margin-left: auto;
		font-size: 14px;
		line-height: 20px;
		gap: 2px;
		align-items: center;
		flex: 0 0 auto;
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
		transition: color 0.15s ease, background-color 0.15s ease;

		.docs-playground-icon {
			width: 18px;
			height: 18px;
		}

		&:hover {
			color: var(--docs-primary-color, var(--vc-color-primary, #2563eb));
			background: var(--docs-primary-color-light, var(--vc-color-primary-lighter, #e8eef8));
		}

		&:focus-visible {
			outline: 2px solid var(--docs-primary-color, var(--vc-color-primary, #2563eb));
			outline-offset: 1px;
		}

		@include when(active) {
			color: var(--docs-primary-color, var(--vc-color-primary, #2563eb));
			background: var(--docs-primary-color-light, var(--vc-color-primary-lighter, #e8eef8));
		}
	}

	@include element(viewport-menu) {
		display: inline-flex;
	}

	@include element(viewport-trigger) {
		.docs-playground-icon {
			width: 18px;
			height: 18px;
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
			width: 18px;
			height: 18px;
		}
	}

	@include element(popup-close-mark) {
		font-size: 16px;
		line-height: 1;
	}

	@include element(preview) {
		position: relative;
		min-height: 0;
		overflow: hidden;
		background: var(--vc-background-color-light, var(--docs-background-color, #fff));
		box-sizing: border-box;
		flex: 1 1 auto;
	}

	@include element(expand) {
		position: absolute;
		bottom: 2px;
		left: 50%;
		z-index: 2;
		display: inline-flex;
		width: 32px;
		height: 24px;
		min-width: 24px;
		min-height: 24px;
		padding: 0;
		color: var(--docs-foreground-color-mute, var(--vc-color-dark-lightest, #64748b));
		cursor: pointer;
		background: var(--vc-background-color-light, var(--docs-background-color, #fff));
		border: 0;
		border-radius: 8px;
		transform: translateX(-50%);
		box-sizing: border-box;
		transition: color 0.15s ease, background-color 0.15s ease;
		justify-content: center;
		align-items: center;

		.docs-playground-icon {
			width: 14px;
			height: 14px;
			transition: transform 0.15s ease;
		}

		&:hover {
			color: var(--docs-primary-color, var(--vc-color-primary, #2563eb));
			background: var(--docs-primary-color-light, var(--vc-color-primary-lighter, #e8eef8));
		}

		&:focus-visible {
			outline: 2px solid var(--docs-primary-color, var(--vc-color-primary, #2563eb));
			outline-offset: 1px;
		}

		@include when(expanded) {
			.docs-playground-icon {
				transform: rotate(180deg);
			}
		}
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
