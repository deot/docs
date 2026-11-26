<template>
	<RuntimePreview
		v-if="styleless"
		:files="sourceFiles"
		:entry="currentEntry"
		:options="options"
		:preview-options="previewOptions"
		:preview-inset="resolvedPreviewInset"
		:preview-scroller="previewScroller"
		:local="local"
		:expandable="local ? false : expandable"
		:styleless="true"
		:title="title"
		:id="id"
		:viewport="activeViewport"
		:viewport-options="selectableViewportOptions"
		@files-change="handleFilesChange"
		@navigate="emit('navigate', $event)"
		@viewport-change="handleViewport"
	/>
	<div
		v-else
		ref="rootEl"
		class="docs-playground"
		:class="{
			'docs-playground--files': !mobileEnabled && activeView === 'files',
			'docs-playground--mobile': mobileEnabled,
			'docs-playground--narrow': mobileEnabled && narrow
		}"
		:style="mobileStyle"
	>
		<div v-if="error" class="docs-playground__error">
			{{ error }}
		</div>
		<template v-else>
			<div
				v-if="showHeader"
				class="docs-playground__header"
			>
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
					v-if="showToolbar"
					:copy-value="copyValue"
					:viewport="activeViewport"
					:viewport-options="selectableViewportOptions"
					:views="mobileEnabled ? [] : normalizedViews"
					:active-view="activeView"
					:show-runtime-actions="showRuntimeActions"
					:show-open-popup="hasRuntimeView || mobileEnabled"
					@refresh="handleRefresh"
					@edit="handleEdit"
					@open-popup="handleOpenPopup"
					@viewport-change="handleViewport"
					@view-change="handleView"
				/>
			</div>
			<div
				v-if="mobileEnabled"
				class="docs-playground__split"
			>
				<FilesPreview
					class="docs-playground__code"
					:files="sourceFiles"
					:entry="currentEntry"
					:active-filename="fileActiveFilename"
					:active-view="'files'"
					:views="['files']"
					@active-change="handleFileActive"
				/>
				<RuntimePreview
					ref="runtimeRef"
					class="docs-playground__stage"
					:files="sourceFiles"
					:entry="currentEntry"
					:options="options"
					:preview-options="previewOptions"
					:preview-inset="resolvedPreviewInset"
					:preview-scroller="true"
					:preview-variables="previewVariables"
					:preview-variable-links="previewVariableLinks"
					:overlay="overlay"
					:local="local"
					:expandable="false"
					:mobile="true"
					:hide-chrome="true"
					:title="title"
					:id="id"
					:active-view="'runtime'"
					:views="['runtime']"
					:viewport="activeViewport"
					:viewport-options="selectableViewportOptions"
					@files-change="handleFilesChange"
					@navigate="emit('navigate', $event)"
					@viewport-change="handleViewport"
				/>
			</div>
			<RuntimePreview
				v-if="!mobileEnabled && runtimeActivated && hasRuntimeView"
				ref="runtimeRef"
				v-show="activeView === 'runtime'"
				:files="sourceFiles"
				:entry="currentEntry"
				:options="options"
				:preview-options="previewOptions"
				:preview-inset="resolvedPreviewInset"
				:preview-scroller="previewScroller"
				:preview-variables="previewVariables"
				:preview-variable-links="previewVariableLinks"
				:local="local"
				:expandable="local ? false : expandable"
				:hide-chrome="true"
				:title="title"
				:id="id"
				:active-view="activeView"
				:views="normalizedViews"
				:viewport="activeViewport"
				:viewport-options="selectableViewportOptions"
				@files-change="handleFilesChange"
				@navigate="emit('navigate', $event)"
				@viewport-change="handleViewport"
			/>
			<FilesPreview
				v-if="!mobileEnabled && hasFilesView"
				v-show="activeView === 'files'"
				:files="sourceFiles"
				:entry="currentEntry"
				:active-filename="fileActiveFilename"
				:active-view="activeView"
				:views="normalizedViews"
				@active-change="handleFileActive"
			/>
		</template>
	</div>
</template>
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { provideLocale, useLocale } from '@deot/docs-locale';
import type { Language } from '@deot/docs-locale';
import { DEFAULT_ENTRY, NEW_SFC_CODE } from './constants';
import { filesEqual, resolvePlaygroundTitleId } from './utils';
import { FilesPreview, RuntimePreview } from './core';
import RuntimeToolbar from './core/runtime/toolbar.vue';
import type { EditorFilesChangeAction } from './editor';
import type {
	PlaygroundExpandable,
	PlaygroundFiles,
	PlaygroundOptions,
	PlaygroundPreviewInset,
	PlaygroundPreviewOptions,
	PlaygroundPreviewScroller,
	PlaygroundPreviewVariable,
	PlaygroundPreviewVariableLinks,
	PlaygroundOverlayOptions,
	PlaygroundView,
	PlaygroundViewport
} from './types';
import {
	isNarrowPlayground,
	isPlaygroundMobile,
	PLAYGROUND_MOBILE_NARROW_CODE_MAX_HEIGHT,
	PLAYGROUND_MOBILE_NARROW_PREVIEW_MAX_HEIGHT,
	resolvePlaygroundMobileMaxHeight,
	resolvePlaygroundMobilePreviewWidth,
	resolvePlaygroundPreviewInset
} from './core/runtime/mobile';
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
	previewInset?: PlaygroundPreviewInset;
	/**
	 * 预览高度是否可展开。未传不显示控件；`true` 展开到剩余视口；正数为目标高度 px。
	 */
	expandable?: PlaygroundExpandable;
	/**
	 * 顶栏标题。空串或不传不渲染标题文本。
	 * runtime / 双视图始终保留顶栏；files-only 仅在有标题时渲染顶栏。
	 */
	title?: string;
	/**
	 * 标题锚点 id。未传时按 markdown-it-anchor 规则从 `title` 生成。
	 */
	id?: string;
	/**
	 * 是否在 iframe 内用 `@deot/vc` Scroller 替换原生滚动条。
	 * 默认关闭；开启后动态探测 `Scroller`，不存在则回退。
	 */
	previewScroller?: PlaygroundPreviewScroller;
	/**
	 * 左代码、右预览。`true` 限高 640px；正数为最大高度 px。
	 * 容器窄于 720px 时改为上预览、下代码。`styleless` 下忽略。
	 */
	mobile?: boolean | number;
	/**
	 * 预览底部可切换的 CSS 变量。未传不显示底栏。
	 */
	previewVariables?: readonly PlaygroundPreviewVariable[];
	/**
	 * 预览变量联动。缺省为 `--rem` → `--vc-rem`；`false` 关闭。
	 */
	previewVariableLinks?: PlaygroundPreviewVariableLinks;
	/**
	 * local 移动端预览的弹层适配器，通常写在站点配置 `components.playground.overlay`。
	 * 外部模块加载后、示例代码执行前调用 `setup({ element, modules })`。
	 */
	overlay?: PlaygroundOverlayOptions;
	/**
	 * 在当前文档直接编译挂载。默认开启；`false` 改回 iframe Sandbox。
	 */
	local?: boolean;
	previewOptions?: PlaygroundPreviewOptions;
	locale?: Language;
}>(), {
	modelValue: '',
	files: () => ({}),
	entry: '',
	views: () => ['runtime'],
	styleless: false,
	// 类型含 false，Vue 会把缺省的布尔类 prop 转成 false；显式默认 undefined 才能区分「未写」与「关闭」。
	previewVariableLinks: undefined,
	previewScroller: false,
	local: true,
	title: '',
	id: '',
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
const runtimeRef = ref<{
	refresh: () => void;
	edit: () => void;
	openPopup: () => void;
} | null>(null);
const titleEl = ref<HTMLElement | null>(null);

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
const hasRuntimeView = computed(() => normalizedViews.value.includes('runtime'));
const hasFilesView = computed(() => normalizedViews.value.includes('files'));
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
const displayTitle = computed(() => props.title.trim());
const titleId = computed(() => resolvePlaygroundTitleId(
	displayTitle.value,
	props.id,
	(candidate) => {
		if (typeof document === 'undefined') return false;
		const existing = document.getElementById(candidate);
		return !!existing && existing !== titleEl.value;
	}
));
const copyValue = computed(() => sourceFiles.value[currentEntry.value] || '');
const mobileEnabled = computed(() => isPlaygroundMobile(props.mobile));
const resolvedPreviewInset = computed(() => resolvePlaygroundPreviewInset(
	props.previewInset,
	mobileEnabled.value && !props.styleless
));
const mobileMaxHeight = computed(() => (
	mobileEnabled.value ? resolvePlaygroundMobileMaxHeight(props.mobile as true | number) : 0
));
const mobileStyle = computed(() => {
	if (!mobileEnabled.value) return undefined;
	const maxHeight = mobileMaxHeight.value;
	return {
		'--docs-playground-mobile-max-height': `${maxHeight}px`,
		'--docs-playground-preview-width': `${resolvePlaygroundMobilePreviewWidth(activeViewport.value)}px`,
		'--docs-playground-narrow-preview-max-height': `${Math.min(PLAYGROUND_MOBILE_NARROW_PREVIEW_MAX_HEIGHT, maxHeight)}px`,
		'--docs-playground-narrow-code-max-height': `${Math.min(PLAYGROUND_MOBILE_NARROW_CODE_MAX_HEIGHT, maxHeight)}px`
	};
});
const rootEl = ref<HTMLElement | null>(null);
const narrow = ref(false);
let narrowObserver: ResizeObserver | null = null;
const syncNarrow = () => {
	narrow.value = isNarrowPlayground(rootEl.value?.clientWidth ?? 0);
};
onMounted(() => {
	syncNarrow();
	if (typeof ResizeObserver === 'undefined' || !rootEl.value) return;
	narrowObserver = new ResizeObserver(syncNarrow);
	narrowObserver.observe(rootEl.value);
});
onBeforeUnmount(() => {
	narrowObserver?.disconnect();
	narrowObserver = null;
});
/** runtime / 双视图始终有顶栏；files-only 仅有标题时渲染。移动端分栏始终保留顶栏。 */
const showHeader = computed(() => (
	mobileEnabled.value || hasRuntimeView.value || !!displayTitle.value
));
const showToolbar = computed(() => mobileEnabled.value || hasRuntimeView.value);
const showRuntimeActions = computed(() => mobileEnabled.value || activeView.value === 'runtime');

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

const handleRefresh = () => {
	runtimeRef.value?.refresh();
};
const handleEdit = () => {
	runtimeRef.value?.edit();
};
const handleOpenPopup = () => {
	runtimeRef.value?.openPopup();
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
	if (mobileEnabled.value || activeView.value === 'runtime') runtimeActivated.value = true;
	else if (!views.includes('runtime')) runtimeActivated.value = false;
});

watch(mobileEnabled, (enabled) => {
	if (enabled) runtimeActivated.value = true;
}, { immediate: true });

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

@mixin docs-playground-mobile-stack {
	.docs-playground__split {
		grid-template-columns: minmax(0, 1fr);
		grid-template-rows:
			minmax(0, var(--docs-playground-narrow-preview-max-height, 480px))
			minmax(0, var(--docs-playground-narrow-code-max-height, 320px));
		max-height: none;
	}

	.docs-playground__stage {
		order: -1;
		width: 100%;
		max-height: var(--docs-playground-narrow-preview-max-height, 480px);
	}

	.docs-playground__code {
		max-height: var(--docs-playground-narrow-code-max-height, 320px);
	}
}

@include block(docs-playground) {
	display: flex;
	width: 100%;
	margin-bottom: 16px;
	overflow: hidden;
	background: transparent;
	box-sizing: border-box;
	justify-content: center;
	flex-direction: column;
	gap: 8px;

	@include modifier(files) {
		height: 100%;
		min-height: 0;
		overflow: hidden;
	}

	@include element(error) {
		display: flex;
		height: 100%;
		box-sizing: border-box;
		justify-content: center;
		align-items: center;
	}

	@include element(header) {
		display: flex;
		padding: 0 4px 0 0;
		background: transparent;
		box-sizing: border-box;
		justify-content: space-between;
		align-items: center;
		gap: 12px;
		flex: 0 0 44px;
	}

	@include element(title) {
		position: relative;
		display: inline-flex;
		min-width: 0;
		padding-right: 12px;
		overflow: hidden;
		font-size: 14px;
		font-weight: 600;
		line-height: 20px;
		color: var(--docs-foreground-color-dark, var(--vc-foreground-color, #18181b));
		flex: 1 1 auto;
		align-items: center;
	}

	@include element(title-anchor) {
		position: absolute;
		top: 50%;
		right: 100%;
		width: 14px;
		font-size: 12px;
		line-height: 1;
		color: inherit;
		text-align: center;
		text-decoration: none;
		opacity: 0;
		transform: translateY(-50%);
		transition: opacity 0.2s ease;

		&:focus-visible {
			outline: 2px solid var(--docs-color-primary, var(--vc-color-primary, #2563eb));
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

	@include element(tools) {
		display: flex;
		margin-left: auto;
		font-size: 13px;
		line-height: 20px;
		gap: 8px;
		align-items: center;
		flex: 0 0 auto;
	}

	@include element(tool-group) {
		display: inline-flex;
		padding: 2px;
		background: var(--docs-background-color-light, var(--vc-background-color, #f1f5f9));
		border-radius: 999px;
		gap: 0;
		align-items: center;
	}

	@include element(tool-divider) {
		display: inline-block;
		width: 1px;
		height: 16px;
		background: var(--docs-border-color, var(--vc-border-color, #e2e8f0));
		flex: 0 0 1px;
	}

	@include element(views) {
		display: inline-flex;
		padding: 2px;
		background: var(--docs-background-color-light, var(--vc-background-color, #f1f5f9));
		border-radius: 999px;
		gap: 0;
		align-items: center;
	}

	@include element(view) {
		display: inline-flex;
		height: 28px;
		padding: 0 12px;
		font: inherit;
		font-size: 13px;
		font-weight: 500;
		line-height: 20px;
		color: var(--docs-foreground-color-light, var(--vc-color-dark-lightest, #64748b));
		cursor: pointer;
		background: transparent;
		border: 0;
		border-radius: 999px;
		justify-content: center;
		align-items: center;
		transition: color 0.15s ease, background-color 0.15s ease, box-shadow 0.15s ease;

		&:hover {
			color: var(--docs-foreground-color-dark, var(--vc-foreground-color, #18181b));
		}

		&:focus-visible {
			outline: 2px solid var(--docs-color-primary, var(--vc-color-primary, #2563eb));
			outline-offset: 1px;
		}

		@include when(active) {
			color: var(--docs-foreground-color-dark, var(--vc-foreground-color, #18181b));
			background: var(--docs-background-color-lightest, var(--vc-background-color-lightest, #fff));
			box-shadow: 0 1px 2px rgb(15 23 42 / 8%);
		}
	}

	@include element(tool) {
		display: inline-flex;
		width: 28px;
		height: 28px;
		padding: 0;
		font: inherit;
		color: var(--docs-foreground-color-light, var(--vc-color-dark-lightest, #64748b));
		cursor: pointer;
		background: transparent;
		border: 0;
		border-radius: 999px;
		justify-content: center;
		align-items: center;
		transition: color 0.15s ease, background-color 0.15s ease, box-shadow 0.15s ease;

		.docs-playground-icon {
			width: 16px;
			height: 16px;
		}

		&:hover {
			color: var(--docs-foreground-color-dark, var(--vc-foreground-color, #18181b));
		}

		&:focus-visible {
			outline: 2px solid var(--docs-color-primary, var(--vc-color-primary, #2563eb));
			outline-offset: 1px;
		}

		@include when(active) {
			color: var(--docs-foreground-color-dark, var(--vc-foreground-color, #18181b));
			background: var(--docs-background-color-lightest, var(--vc-background-color-lightest, #fff));
			box-shadow: 0 1px 2px rgb(15 23 42 / 8%);
		}
	}

	@include element(viewport-menu) {
		display: inline-flex;
	}

	@include element(viewport-trigger) {
		.docs-playground-icon {
			width: 16px;
			height: 16px;
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
			width: 16px;
			height: 16px;
		}
	}

	@include element(popup-close-mark) {
		font-size: 16px;
		line-height: 1;
	}

	@include modifier(mobile) {
		container-name: docs-playground;
		container-type: inline-size;

		@include element(split) {
			display: grid;
			max-height: var(--docs-playground-mobile-max-height, 640px);
			min-width: 0;
			grid-template-columns: minmax(0, 1fr) var(--docs-playground-preview-width, 375px);
			grid-template-rows: minmax(0, var(--docs-playground-mobile-max-height, 640px));
			align-items: stretch;
			gap: 8px;
		}

		@include element(code) {
			display: flex;
			max-height: 100%;
			min-width: 0;
			min-height: 0;
			overflow: hidden;
			flex-direction: column;
		}

		@include element(stage) {
			display: flex;
			width: 100%;
			max-height: 100%;
			min-width: 0;
			min-height: 0;
			overflow: hidden;
			container-name: docs-playground-preview;
			container-type: inline-size;
			flex-direction: column;
		}

		.docs-playground-files,
		.docs-playground-runtime-host,
		.docs-playground-runtime,
		.docs-playground-runtime__body,
		.docs-code-preview,
		.docs-code-preview__scroller,
		.docs-playground__stage .vc-scroller,
		.docs-playground__code .vc-scroller {
			height: 100%;
			max-height: 100%;
			min-height: 0;
		}

		&.docs-playground--narrow {
			@include docs-playground-mobile-stack;
		}
	}
}

@container docs-playground (max-width: 719px) {
	.docs-playground--mobile {
		@include docs-playground-mobile-stack;
	}
}
</style>
