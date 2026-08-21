<template>
	<div
		class="docs-renderer-combo"
		:data-doc-theme="contextValue.theme"
		:data-vc-theme="contextValue.theme"
		@keydown="handleKeydown"
	>
		<header class="docs-renderer-combo__toolbar">
			<div class="docs-renderer-combo__heading">
				<Button type="text" @click="emit('back')">← {{ t('renderer.common.back') }}</Button>
				<strong>{{ store.document.meta.title || t('renderer.common.untitledPage') }}</strong>
			</div>
			<div class="docs-renderer-combo__actions">
				<Button :disabled="!store.canUndo" @click="store.undo()">{{ t('renderer.common.undo') }}</Button>
				<Button :disabled="!store.canRedo" @click="store.redo()">{{ t('renderer.common.redo') }}</Button>
				<Button v-if="draftKey" @click="clearDraft">{{ t('renderer.common.clearDraft') }}</Button>
				<Button type="primary" @click="handleImport">{{ t('renderer.common.import') }}</Button>
				<Button type="primary" @click="handleExport">{{ t('renderer.common.export') }}</Button>
				<Button type="primary" @click="preview">{{ t('renderer.common.preview') }}</Button>
				<Button type="primary" @click="save">{{ t('renderer.common.save') }}</Button>
			</div>
		</header>
		<div class="docs-renderer-combo__body">
			<Widget
				:catalog="catalog"
				:mode="mode"
				:context="moduleContext"
				:document="store.document"
				@create="handleCreate"
			/>
			<main
				class="docs-renderer-combo__stage"
				:class="{ 'is-draggable': mode === 'draggable' }"
				@pointerdown="handleStagePointerDown"
			>
				<div
					v-if="mode === 'sortable'"
					class="docs-renderer-combo__stage-bar"
					role="button"
					tabindex="0"
					:title="t('renderer.json.title')"
					@pointerdown.stop
					@click="handleJson"
					@keydown.enter.prevent="handleJson"
					@keydown.space.prevent="handleJson"
				>
					<span>{{ t('renderer.common.page') }}</span>
					<span>{{ t('renderer.common.blocks', { count: store.document.blocks.length }) }}</span>
				</div>
				<SortableFrame
					v-if="mode === 'sortable'"
					:store="store"
					:catalog="catalog"
					:context="moduleContext"
					@create="handleCreate"
				/>
				<DraggableFrame
					v-else
					:store="store"
					:catalog="catalog"
					:context="moduleContext"
					@create="handleCreate"
				/>
			</main>
			<PropertyEditor
				:store="store"
				:catalog="catalog"
				:context="moduleContext"
				:mode="mode"
			/>
		</div>
		<input ref="fileInput" class="docs-renderer-combo__file" type="file" accept="application/json,.json" @change="handleFile">
	</div>
</template>
<script setup lang="ts">
import {
	computed,
	markRaw,
	nextTick,
	onBeforeUnmount,
	onMounted,
	ref,
	watch
} from 'vue';
import { Button, Message, Portal } from '@deot/vc';
import { provideLocale, useLocale } from '@deot/docs-locale';
import {
	RENDERER_PAGE_TYPE,
	RENDERER_SELECTION_TYPE,
	RENDERER_SORTABLE_CONTENT_WIDTH,
	type RendererContext,
	type RendererDocument,
	type RendererDraggableNode,
	type RendererIssue,
	type RendererModuleContext,
	type RendererModuleSource,
	type RendererNode,
	type RendererSortableNode,
	type RendererValidationResult
} from '../types';
import { cloneRendererValue, validateRendererDocument } from '../validate';
import { createRendererId } from '../utils/id';
import { createRendererModuleCatalog } from '../catalog';
import {
	createEmptyRendererDocument,
	prepareRendererDocument,
	resolveSortableInsertionIndex
} from '../document';
import { RendererStore } from '../store';
import { BuiltinModules } from '../modules';
import Widget from '../widget/index.vue';
import SortableFrame from '../frame/sortable/index.vue';
import DraggableFrame from '../frame/draggable/index.vue';
import { containRotatedPlacement } from '../frame/draggable/geometry';
import type { Point } from '../frame/draggable/geometry';
import { deactivateRendererSelection } from '../frame/shared/blur-selection';
import type { RendererCreateTarget } from '../widget/constants';
import PropertyEditor from '../editor/index.vue';
import JsonPopup from '../editor/json/popup';
import PreviewPopup from '../assist/preview/popup.vue';
import { RendererDraftCache } from './draft';

/** 两种画布都会触发创建，sortable 只给 index，draggable 额外给落点。 */
type CreatePayload = RendererCreateTarget & {
	index?: number;
	point?: Point;
};

const props = withDefaults(defineProps<{
	modelValue?: RendererDocument | null;
	modules?: readonly RendererModuleSource[];
	context?: RendererContext;
	historyLimit?: number;
	draftKey?: string;
}>(), {
	modelValue: null,
	modules: undefined,
	context: () => ({}),
	historyLimit: 100
});
const emit = defineEmits<{
	'update:modelValue': [document: RendererDocument];
	'change': [document: RendererDocument];
	'save': [document: RendererDocument];
	'back': [];
	'error': [issues: RendererIssue[]];
}>();
const localeContext = useLocale(computed(() => props.context?.locale));
const { t } = localeContext;
// Combo 的 context.locale 必须覆盖宿主 Locale，并继续传递给内置及业务 Editor。
provideLocale(localeContext.locale);

const initial = props.modelValue
	? validateRendererDocument(props.modelValue)
	: { valid: true, issues: [], document: undefined };
const store = markRaw(new RendererStore(
	initial.document || createEmptyRendererDocument(),
	{ historyLimit: props.historyLimit }
));
const sources = computed<readonly RendererModuleSource[]>(() => props.modules === undefined
	? BuiltinModules
	: props.modules);
const catalog = computed(() => createRendererModuleCatalog(sources.value));
const mode = computed(() => store.document.layout.mode);
const contextValue = computed(() => props.context || {});
const moduleContext = computed<RendererModuleContext>(() => ({
	...contextValue.value,
	scene: 'combo',
	frameMode: mode.value,
	readonly: false
}));
const fileInput = ref<HTMLInputElement>();
const portalName = createRendererId();
const jsonPortal = new Portal(JsonPopup, {
	name: `docs-renderer-json-${portalName}`,
	leaveDelay: 0,
	multiple: false
});
const previewPortal = new Portal(PreviewPopup, {
	name: `docs-renderer-preview-${portalName}`,
	leaveDelay: 0,
	multiple: false
});
const activePortals = new Set<{ destroy: () => void }>();
const draftCache = new RendererDraftCache();
let draftTimer: ReturnType<typeof setTimeout> | undefined;
let draftReady = !props.draftKey;
let suppressDraftWrite = false;
let sourceDocument = cloneRendererValue(
	initial.document || createEmptyRendererDocument()
) as RendererDocument;

const signatureOf = (value: unknown) => {
	try {
		return JSON.stringify(value);
	} catch {
		return null;
	}
};
let externalSignature = signatureOf(props.modelValue);
watch(() => props.modelValue, (value) => {
	const nextSignature = signatureOf(value);
	if (nextSignature === null) {
		emit('error', [{
			path: '$',
			code: 'document.json',
			message: '页面文档必须是 JSON-safe 数据',
			severity: 'error'
		}]);
		return;
	}
	if (!value || nextSignature === JSON.stringify(store.document)) {
		externalSignature = nextSignature;
		return;
	}
	const result = validateRendererDocument(value);
	if (!result.document) {
		emit('error', result.issues);
		return;
	}
	externalSignature = nextSignature;
	store.resetExternal(result.document);
	sourceDocument = cloneRendererValue(result.document) as RendererDocument;
}, { deep: true });
watch(() => store.document, (value) => {
	const signature = JSON.stringify(value);
	if (signature === externalSignature) return;
	const document = cloneRendererValue(value) as RendererDocument;
	externalSignature = signature;
	emit('update:modelValue', document);
	emit('change', document);
	const draftKey = props.draftKey;
	if (draftKey && draftReady && !suppressDraftWrite) {
		if (draftTimer) clearTimeout(draftTimer);
		draftTimer = setTimeout(() => {
			draftCache.set({
				key: draftKey,
				document: cloneRendererValue(store.document) as RendererDocument,
				updatedAt: Date.now()
			}).catch(() => {
				// 草稿是辅助能力，浏览器禁止 IndexedDB 时不影响当前编辑。
			});
		}, 500);
	}
}, { deep: true });

const handleStagePointerDown = (event: PointerEvent) => {
	deactivateRendererSelection(store, event);
};

const handleCreate = async (payload: CreatePayload) => {
	try {
		const definition = await catalog.value.get(payload.type);
		const capability = definition?.frames[mode.value];
		if (!definition || !capability || payload.type === RENDERER_PAGE_TYPE || payload.type === RENDERER_SELECTION_TYPE) return;
		const count = store.document.blocks.filter(node => node.module.type === payload.type).length;
		if (capability.maxInstances && count >= capability.maxInstances) {
			Message.warning(t('renderer.modules.maxInstances', { count: capability.maxInstances, type: payload.type }));
			return;
		}
		const index = Math.min(
			Math.max(0, payload.index ?? store.document.blocks.length),
			store.document.blocks.length
		);
		const createContext = {
			frameMode: mode.value,
			presetKey: payload.presetKey,
			index,
			document: store.document,
			context: contextValue.value
		};
		const widget = capability.widget || definition.widget;
		const preset = widget.presets?.find(value => value.key === payload.presetKey);
		if (payload.presetKey && !preset) {
			throw new Error(`Unknown renderer preset: ${payload.type}/${payload.presetKey}`);
		}
		const propsValue = definition.data.create(createContext);
		const frameDraft = capability.create?.(createContext);
		const presetDraft = preset?.create?.(createContext);
		const draft = {
			props: { ...frameDraft?.props, ...presetDraft?.props },
			appearance: { ...frameDraft?.appearance, ...presetDraft?.appearance },
			placement: { ...frameDraft?.placement, ...presetDraft?.placement }
		};
		const module = {
			type: definition.identity.type,
			version: definition.identity.version,
			props: { ...propsValue, ...draft?.props }
		};
		let node: RendererNode;
		let target = index;
		if (mode.value === 'sortable') {
			target = await resolveSortableInsertionIndex(
				store.document.blocks as readonly RendererSortableNode[],
				catalog.value,
				payload.type,
				index
			);
			const fill = Boolean(definition.frames.sortable?.fullWidth);
			node = {
				id: createRendererId(),
				module,
				appearance: {
					marginTop: 0,
					marginBottom: 0,
					paddingTop: 0,
					paddingBottom: 0,
					paddingLeft: 0,
					paddingRight: 0,
					fullWidth: fill,
					...(fill
						? {}
						: { maxWidth: definition.frames.sortable?.maxWidth || RENDERER_SORTABLE_CONTENT_WIDTH }),
					...draft?.appearance
				}
			} satisfies RendererSortableNode;
		} else {
			const draggable = definition.frames.draggable;
			if (!draggable) return;
			let placement = { ...draggable.initialPlacement(), ...draft?.placement };
			if (typeof draft.placement?.zIndex !== 'number') {
				placement.zIndex = Math.max(
					0,
					...store.document.blocks.map(node => node.placement?.zIndex || 0)
				) + 1;
			}
			if (payload.point) {
				placement.x = payload.point.x - placement.width / 2;
				placement.y = payload.point.y - placement.height / 2;
			}
			if (draggable.containment !== 'none' && store.document.layout.mode === 'draggable') {
				placement = containRotatedPlacement(
					placement,
					store.document.layout.width,
					store.document.layout.height
				);
			}
			node = { id: createRendererId(), module, placement } satisfies RendererDraggableNode;
		}
		store.insertNode(target, node);
	} catch (reason) {
		Message.error(reason instanceof Error ? reason.message : String(reason));
	}
};

const validate = async (): Promise<RendererValidationResult> => prepareRendererDocument(
	store.document,
	catalog.value,
	moduleContext.value
);
const save = async () => {
	const result = await validate();
	if (!result.valid || !result.document) {
		emit('error', result.issues);
		const first = result.issues.find(issue => issue.severity === 'error');
		if (first?.nodeId) store.select(first.nodeId);
		Message.error(first?.message || t('renderer.common.validationFailed'));
		return result;
	}
	emit('save', cloneRendererValue(result.document));
	sourceDocument = cloneRendererValue(result.document) as RendererDocument;
	if (props.draftKey) {
		cancelDraftWrite();
		await draftCache.remove(props.draftKey).catch(() => {
			// 保存已成功；草稿清不掉时下次编辑仍可手动清除。
		});
	}
	return result;
};
const preview = async () => {
	const leaf = previewPortal.popup({
		document: cloneRendererValue(store.document),
		modules: sources.value,
		context: contextValue.value
	});
	activePortals.add(leaf);
	try {
		await leaf;
	} catch {
		// 用户关闭预览不属于编辑错误。
	} finally {
		activePortals.delete(leaf);
	}
};
const handleJson = async () => {
	const leaf = jsonPortal.popup({
		document: cloneRendererValue(store.document),
		modules: sources.value,
		context: moduleContext.value
	});
	activePortals.add(leaf);
	try {
		const value = await leaf as RendererDocument;
		if (value) store.replaceDocument(value);
	} catch {
		// 用户取消 JSON 草稿时不修改当前文档。
	} finally {
		activePortals.delete(leaf);
	}
};
const importDocument = async (value: unknown): Promise<RendererValidationResult> => {
	const result = await prepareRendererDocument(value, catalog.value, moduleContext.value);
	if (!result.valid || !result.document) {
		emit('error', result.issues);
		return result;
	}
	store.replaceDocument(result.document);
	return result;
};
const exportDocument = () => JSON.stringify(store.document, null, '\t');
const select = (id: string | null) => store.select(id);
const handleImport = () => fileInput.value?.click();
const handleFile = async (event: Event) => {
	const input = event.target as HTMLInputElement;
	const file = input.files?.[0];
	input.value = '';
	if (!file) return;
	try {
		const result = await importDocument(JSON.parse(await file.text()));
		if (!result.valid || !result.document) {
			throw new Error(result.issues.map(issue => issue.message).join('\n'));
		}
	} catch (reason) {
		Message.error(reason instanceof Error ? reason.message : String(reason));
	}
};
const handleExport = () => {
	const blob = new Blob([exportDocument()], { type: 'application/json' });
	const anchor = document.createElement('a');
	anchor.href = URL.createObjectURL(blob);
	anchor.download = `${store.document.meta.title || 'document'}.json`;
	anchor.click();
	URL.revokeObjectURL(anchor.href);
};
const handleKeydown = async (event: KeyboardEvent) => {
	const target = event.target as HTMLElement;
	if (target.matches('input,textarea,select,[contenteditable="true"]')) return;
	if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
		event.preventDefault();
		if (event.shiftKey) store.redo();
		else store.undo();
	} else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'c') {
		event.preventDefault();
		store.copySelection();
	} else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'v') {
		event.preventDefault();
		store.pasteClipboard();
	} else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'x') {
		const node = store.selectedId ? store.getNode(store.selectedId) : undefined;
		if (!node || node.module.type === RENDERER_PAGE_TYPE || node.module.type === RENDERER_SELECTION_TYPE) return;
		event.preventDefault();
		store.copySelection();
		store.removeNode(node.id);
	} else if ((event.key === 'Delete' || event.key === 'Backspace') && store.selectedId) {
		const removable: string[] = [];
		for (const id of store.selectedIds) {
			const node = store.getNode(id);
			if (!node) continue;
			try {
				const definition = await catalog.value.get(node.module.type);
				if (definition?.frames[mode.value]?.deletable !== false) removable.push(id);
			} catch {
				// 模块定义不可用时保留节点，避免键盘操作误删未知数据。
			}
		}
		store.removeNodes(removable);
	}
};
const getDocument = () => cloneRendererValue(store.document) as RendererDocument;
const cancelDraftWrite = () => {
	if (!draftTimer) return;
	clearTimeout(draftTimer);
	draftTimer = undefined;
};
const clearDraft = async () => {
	if (!props.draftKey) return;
	cancelDraftWrite();
	const restore = cloneRendererValue(sourceDocument) as RendererDocument;
	suppressDraftWrite = true;
	try {
		await draftCache.remove(props.draftKey);
		store.resetExternal(restore);
		externalSignature = signatureOf(restore);
		emit('update:modelValue', restore);
		emit('change', restore);
		await nextTick();
		Message.success(t('renderer.common.draftCleared'));
	} catch {
		Message.error(t('renderer.common.draftClearFailed'));
	} finally {
		suppressDraftWrite = false;
	}
};
onMounted(async () => {
	if (!initial.valid) emit('error', initial.issues);
	if (!props.draftKey) return;
	const loaded = props.modelValue
		? validateRendererDocument(props.modelValue).document
		: initial.document;
	if (loaded) sourceDocument = cloneRendererValue(loaded) as RendererDocument;
	try {
		const draft = await draftCache.get(props.draftKey);
		const documentUpdatedAt = Number(props.modelValue?.meta.updatedAt || 0);
		if (draft && draft.updatedAt > documentUpdatedAt) {
			const result = await prepareRendererDocument(draft.document, catalog.value, moduleContext.value);
			if (result.valid && result.document) store.resetExternal(result.document);
		}
	} catch {
		Message.error(t('renderer.common.draftRestoreFailed'));
	} finally {
		draftReady = true;
	}
});
onBeforeUnmount(() => {
	cancelDraftWrite();
	activePortals.forEach(leaf => leaf.destroy());
	activePortals.clear();
});
defineExpose({
	validate,
	save,
	preview,
	undo: store.undo.bind(store),
	redo: store.redo.bind(store),
	getDocument,
	importDocument,
	exportDocument,
	select,
	clearDraft
});
</script>
<style lang="scss">
@use '../../node_modules/@deot/docs-theme/src/functions' as *;

.docs-renderer-combo {
	display: grid;
	grid-template-rows: 50px minmax(0, 1fr);
	width: 100%;
	height: 100vh;
	min-width: 960px;
	min-height: 560px;
	color: varfix(foreground-color);
	background: varfix(background-color);

	&__toolbar {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 16px;
		padding: 0 16px;
		border-bottom: 1px solid varfix(border-color-light);
		align-items: center;
	}

	&__heading,
	&__actions {
		display: flex;
		gap: 8px;
		min-width: 0;
		align-items: center;
	}

	&__heading strong {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	&__body {
		display: grid;
		grid-template-columns: 284px minmax(0, 1fr) 380px;
		min-width: 0;
		min-height: 0;
	}

	&__stage {
		display: grid;
		grid-template-rows: 30px minmax(0, 1fr);
		min-width: 0;
		min-height: 0;
		background-color: varfix(background-color-soft);
		background-image: radial-gradient(varfix(border-color) 1px, transparent 1px);
		background-size: 16px 16px;

		&.is-draggable {
			grid-template-rows: minmax(0, 1fr);
			background-color: varfix(background-color-mute);
			background-image: none;
		}
	}

	&__stage-bar {
		display: flex;
		padding: 0 12px;
		font-size: 12px;
		color: varfix(foreground-color-mute);
		cursor: pointer;
		background: varfix(background-color);
		border-bottom: 1px solid varfix(border-color-light);
		align-items: center;
		justify-content: space-between;

		&:hover,
		&:focus-visible {
			color: varfix(foreground-color);
			background: varfix(background-color-soft);
		}
	}

	&__file {
		display: none;
	}
}

.docs-renderer-json-modal {
	text-align: left;

	.vc-modal__header,
	.vc-modal__title,
	.vc-modal__content {
		text-align: left;
	}

	&__content {
		padding: 0 !important;
	}

	&__body {
		display: grid;
		grid-template-rows: auto minmax(0, 1fr);
		height: 100%;
		min-width: 760px;
		min-height: 0;
		padding: 16px 20px 24px;
		font-size: 12px;
		line-height: 1.5;
		text-align: left;
		box-sizing: border-box;
	}

	&__switcher {
		display: inline-flex;
		gap: 4px;
		padding: 3px;
		margin-bottom: 16px;
		background: varfix(background-color-soft);
		border-radius: 8px;
	}

	&__error {
		padding: 10px 12px;
		margin: 0;
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
		font-size: 12px;
		line-height: 1.55;
		color: varfix(error-color);
		text-align: left;
		white-space: pre-wrap;
		background: varfix(error-background);
		border-radius: 8px;
	}

	&__workspace {
		display: grid;
		grid-template-rows: minmax(0, 1fr) auto;
		gap: 12px;
		height: 100%;
		min-width: 760px;
		min-height: 0;
		padding: 0 8px 8px 0;
		text-align: left;
		align-content: start;
	}

	input,
	textarea {
		text-align: left;
	}

	.vc-textarea__wrapper,
	.vc-textarea__content {
		align-items: stretch;
	}
}

.docs-renderer-json {
	text-align: left;

	input,
	textarea {
		text-align: left;
	}

	.vc-input,
	.vc-input-number,
	.vc-select,
	.vc-textarea {
		--vc-input-background-color-light: var(--docs-background-color);
		--vc-input-color-dark-light: var(--docs-foreground-color);
		--vc-input-color-disabled: transparent;
		--vc-input-color-light-deeper: var(--docs-border-color);
		--vc-input-color-primary: var(--docs-primary-color);
		--vc-textarea-background-color-light: var(--docs-code-background);
		--vc-textarea-color-dark-light: var(--docs-foreground-color);
		--vc-textarea-color-light-deeper: var(--docs-border-color);
		--vc-textarea-color-primary: var(--docs-primary-color);

		min-width: 0;
		color: varfix(foreground-color);
		text-align: left;
		background-color: varfix(background-color);
	}

	.vc-input,
	.vc-input-number {
		min-height: 28px;
		font-size: 12px;
	}

	.vc-input__content input,
	.vc-textarea__content textarea {
		padding: 4px 8px;
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
		font-size: 12px;
		line-height: 1.5;
		color: varfix(foreground-color);
		text-align: left;
	}

	.vc-input.is-disabled,
	.vc-input-number.is-disabled {
		background-color: transparent !important;
	}

	.vc-input.is-disabled input {
		color: varfix(foreground-color-light) !important;
	}

	.vc-select__input {
		background-color: transparent !important;
	}

	.vc-select__append {
		color: varfix(foreground-color-mute) !important;
	}

	.vc-input-number__icon {
		display: none;
	}

	.vc-select {
		min-height: 28px;
		font-size: 12px;
	}

	&__source {
		height: 100%;
		min-height: 0;
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
		font-size: 12px;
		line-height: 1.6;
		text-align: left;
		background: varfix(code-background);

		.vc-textarea__wrapper,
		.vc-textarea__content,
		textarea {
			height: 100%;
			min-height: 0;
			align-items: stretch;
		}

		textarea {
			padding: 12px 14px;
			resize: none;
			tab-size: 4;
		}
	}

	&__tree {
		display: grid;
		gap: 6px;
		min-width: 760px;
		text-align: left;
	}

	&__node {
		position: relative;
		min-width: 0;

		&:not(.is-root)::before {
			position: absolute;
			top: 16px;
			left: -16px;
			width: 16px;
			height: 1px;
			background: varfix(border-color);
			content: '';
		}

		&.is-last:not(.is-root)::after {
			position: absolute;
			top: 17px;
			bottom: -999px;
			left: -17px;
			width: 3px;
			background: varfix(background-color);
			content: '';
		}
	}

	&__fields {
		display: grid;
		grid-template-columns: minmax(128px, 200px) 104px minmax(0, 1fr) 48px;
		gap: 8px 10px;
		width: 100%;
		min-height: 32px;
		padding: 2px 4px;
		text-align: left;
		border-radius: 8px;
		box-sizing: border-box;
		align-items: center;

		> * {
			min-width: 0;
		}

		&:hover {
			background: varfix(background-color-soft);
		}

		&.is-locked {
			background: varfix(background-color-soft);
		}

		&.is-locked .vc-input,
		&.is-locked .vc-input-number,
		&.is-locked .vc-select,
		&.is-locked .vc-select__input {
			color: varfix(foreground-color-light);
			background-color: transparent !important;
			box-shadow: none;

			&::before,
			&::after {
				border-color: transparent !important;
				box-shadow: none !important;
			}
		}
	}

	&__children {
		position: relative;
		display: grid;
		gap: 6px;
		padding-left: 16px;
		margin-top: 6px;
		margin-left: 8px;
		overflow: hidden;

		&::before {
			position: absolute;
			top: 0;
			bottom: 0;
			left: 0;
			width: 1px;
			background: varfix(border-color);
			content: '';
		}
	}

	&__sort-list,
	&__sort-list > .vc-transition-fade {
		display: grid;
		gap: 6px;
	}

	&__ops {
		display: flex;
		gap: 6px;
		align-items: center;
		justify-content: flex-end;
	}

	&__op-slot,
	&__add,
	&__remove {
		display: inline-flex;
		flex: none;
		align-items: center;
		justify-content: center;
		width: 20px;
		height: 20px;
	}

	&__add,
	&__remove {
		position: relative;
		padding: 0;
		margin: 0;
		color: varfix(foreground-color-mute);
		cursor: pointer;
		background: varfix(background-color);
		border: 1px solid varfix(border-color);
		border-radius: 50%;
		appearance: none;

		&::before,
		&::after {
			position: absolute;
			top: 50%;
			left: 50%;
			background: currentcolor;
			border-radius: 1px;
			content: '';
		}

		&:hover:not(:disabled) {
			color: varfix(primary-color);
			border-color: varfix(primary-color);
		}

		&:disabled {
			cursor: not-allowed;
			opacity: 0.45;
		}
	}

	&__add {
		&::before,
		&::after {
			width: 8px;
			height: 1.5px;
			transform: translate(-50%, -50%);
		}

		&::after {
			transform: translate(-50%, -50%) rotate(90deg);
		}
	}

	&__remove {
		&::before,
		&::after {
			width: 8px;
			height: 1.5px;
		}

		&::before {
			transform: translate(-50%, -50%) rotate(45deg);
		}

		&::after {
			transform: translate(-50%, -50%) rotate(-45deg);
		}

		&:hover:not(:disabled) {
			color: #fff;
			background: varfix(error-color);
			border-color: varfix(error-color);
		}

		&:disabled {
			cursor: not-allowed;
			opacity: 0.45;
		}
	}

	&__key,
	&__kind,
	&__summary {
		overflow: hidden;
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
		font-size: 12px;
		line-height: 28px;
		color: varfix(foreground-color-light);
		text-align: left;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	&__kind {
		padding: 0 2px;
		color: varfix(foreground-color-mute);
	}

	&__key {
		display: flex;
		gap: 8px;
		padding: 0 8px;
		align-items: center;
	}

	&__drag-handle {
		color: varfix(foreground-color-mute);
		cursor: grab;
		user-select: none;
	}
}
</style>
