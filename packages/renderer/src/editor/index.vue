<template>
	<aside class="docs-renderer-editor">
		<div class="docs-renderer-panel-title">
			<span>{{ t('renderer.inspector.title') }}</span>
			<small>{{ isPage ? t('renderer.inspector.page') : selectedNode?.module.type }}</small>
		</div>
		<Scroller ref="scroller" height="100%" :native="false" :show-bar="true" :auto-resize="true">
			<div class="docs-renderer-editor__content">
				<section v-if="isPage" class="docs-renderer-editor__section">
					<h3>{{ t('renderer.inspector.page') }}</h3>
					<component
						:is="pageEditor"
						:node="pageNode"
						:model-value="store.document.layout"
						:context="context"
						@update:model-value="handleUpdateLayout"
					/>
				</section>
				<template v-else-if="selectedNode">
					<section v-if="mode === 'sortable' && selectedNode.appearance" class="docs-renderer-editor__section">
						<h3>{{ t('renderer.inspector.layout') }}</h3>
						<SortableBox
							:appearance="selectedNode.appearance"
							:capability="sortableCapability"
							@update:appearance="updateAppearance"
						/>
					</section>
					<section v-if="mode === 'sortable' && selectedNode.appearance" class="docs-renderer-editor__section">
						<h3>{{ t('renderer.inspector.spacing') }}</h3>
						<p class="docs-renderer-editor__sub">{{ t('renderer.inspector.margin') }}</p>
						<div class="docs-renderer-editor__pair">
							<NumberEditor
								prefix="T"
								:title="t('renderer.inspector.marginTop')"
								:model-value="selectedNode.appearance.marginTop"
								:min="0"
								:max="240"
								@update:model-value="value => updateAppearance({ marginTop: value })"
							/>
							<NumberEditor
								prefix="B"
								:title="t('renderer.inspector.marginBottom')"
								:model-value="selectedNode.appearance.marginBottom"
								:min="0"
								:max="240"
								@update:model-value="value => updateAppearance({ marginBottom: value })"
							/>
						</div>
						<p class="docs-renderer-editor__sub">{{ t('renderer.inspector.padding') }}</p>
						<div class="docs-renderer-editor__pair">
							<NumberEditor
								prefix="T"
								:title="t('renderer.inspector.paddingTop')"
								:model-value="selectedNode.appearance.paddingTop"
								:min="0"
								:max="240"
								@update:model-value="value => updateAppearance({ paddingTop: value })"
							/>
							<NumberEditor
								prefix="B"
								:title="t('renderer.inspector.paddingBottom')"
								:model-value="selectedNode.appearance.paddingBottom"
								:min="0"
								:max="240"
								@update:model-value="value => updateAppearance({ paddingBottom: value })"
							/>
							<NumberEditor
								prefix="L"
								:title="t('renderer.inspector.paddingLeft')"
								:model-value="selectedNode.appearance.paddingLeft || 0"
								:min="0"
								:max="240"
								@update:model-value="value => updateAppearance({ paddingLeft: value })"
							/>
							<NumberEditor
								prefix="R"
								:title="t('renderer.inspector.paddingRight')"
								:model-value="selectedNode.appearance.paddingRight || 0"
								:min="0"
								:max="240"
								@update:model-value="value => updateAppearance({ paddingRight: value })"
							/>
						</div>
					</section>
					<section v-else-if="selectedNode.placement" class="docs-renderer-editor__section">
						<h3>{{ t('renderer.inspector.placement') }}</h3>
						<p class="docs-renderer-editor__sub">{{ t('renderer.inspector.position') }}</p>
						<div class="docs-renderer-editor__pair">
							<NumberEditor
								v-for="key in positionKeys"
								:key="key"
								:prefix="placementPrefix[key]"
								:title="key"
								:model-value="selectedNode.placement[key]"
								v-bind="placementLimits[key]"
								@update:model-value="value => updatePlacement(key, value)"
							/>
						</div>
						<p class="docs-renderer-editor__sub">{{ t('renderer.inspector.dimensions') }}</p>
						<div class="docs-renderer-editor__pair">
							<NumberEditor
								v-for="key in sizeKeys"
								:key="key"
								:prefix="placementPrefix[key]"
								:title="key"
								:model-value="selectedNode.placement[key]"
								v-bind="placementLimits[key]"
								@update:model-value="value => updatePlacement(key, value)"
							/>
						</div>
						<div class="docs-renderer-editor__pair">
							<NumberEditor
								v-for="key in extraKeys"
								:key="key"
								:prefix="placementPrefix[key]"
								:title="key"
								:model-value="selectedNode.placement[key]"
								v-bind="placementLimits[key]"
								@update:model-value="value => updatePlacement(key, value)"
							/>
						</div>
					</section>
					<section v-if="radiusSource" class="docs-renderer-editor__section">
						<h3>{{ t('renderer.inspector.appearance') }}</h3>
						<p class="docs-renderer-editor__sub">{{ t('renderer.inspector.borderRadius') }}</p>
						<RadiusEditor :model-value="radiusSource" @update:model-value="updateRadius" />
					</section>
					<section class="docs-renderer-editor__section">
						<h3>{{ t('renderer.inspector.module') }}</h3>
						<div v-if="loading">{{ t('renderer.inspector.loading') }}</div>
						<div v-else-if="error" class="docs-renderer-editor__error">{{ error }}</div>
						<component
							:is="moduleEditor"
							v-else-if="moduleEditor"
							:node="selectedNode"
							:model-value="selectedNode.module.props"
							:context="context"
							@update:model-value="handleUpdateProps"
						/>
					</section>
				</template>
			</div>
		</Scroller>
	</aside>
</template>
<script setup lang="ts">
import {
	computed,
	markRaw,
	nextTick,
	onBeforeUnmount,
	onMounted,
	ref,
	shallowRef,
	watch
} from 'vue';
import type { Component } from 'vue';
import { Message, Scroller } from '@deot/vc';
import { useLocale } from '@deot/docs-locale';
import type { RendererModuleCatalog } from '../catalog';
import type {
	RendererCornerRadii,
	RendererDraggableNode,
	RendererFrameMode,
	RendererLayout,
	RendererModuleContext,
	RendererPlacement,
	RendererSortableAppearance,
	RendererSortableCapability,
	RendererSortableNode
} from '../types';
import type { RendererStore } from '../store';
import { isRendererJsonSafe } from '../validate';
import { convertRendererDocumentFrame } from '../document';
import { createRendererPageNode, isRendererPageModule } from '../modules/shared/page';
import PageEditor from './page/index.vue';
import NumberEditor from './common/number/index.vue';
import RadiusEditor from './common/radius/index.vue';
import SortableBox from './common/sortable-box/index.vue';

const props = defineProps<{
	store: RendererStore;
	catalog: RendererModuleCatalog;
	context: RendererModuleContext;
	mode: RendererFrameMode;
}>();
const { t } = useLocale(computed(() => props.context.locale));
const scroller = ref<{ refresh: () => Promise<void> }>();
let refreshFrame = 0;
const scheduleRefresh = () => {
	if (refreshFrame) cancelAnimationFrame(refreshFrame);
	refreshFrame = requestAnimationFrame(() => {
		refreshFrame = 0;
		void scroller.value?.refresh();
	});
};
onMounted(() => nextTick(scheduleRefresh));
onBeforeUnmount(() => {
	if (refreshFrame) cancelAnimationFrame(refreshFrame);
});
const selectedNode = computed(() => {
	void props.store.document.blocks;
	return props.store.selectedId ? props.store.getNode(props.store.selectedId) : undefined;
});
const isPage = computed(() => Boolean(
	!selectedNode.value || isRendererPageModule(selectedNode.value.module.type)
));
const pageNode = computed(() => createRendererPageNode(props.store.document.layout));
const pageEditor = shallowRef<Component>(markRaw(PageEditor));
const moduleEditor = ref<Component>();
const sortableCapability = ref<RendererSortableCapability>();
const loading = ref(false);
const error = ref('');
let generation = 0;
watch(() => props.catalog, async (catalog) => {
	try {
		const definition = await catalog.get(pageNode.value.module.type);
		pageEditor.value = definition ? markRaw(definition.editor) : markRaw(PageEditor);
	} catch {
		pageEditor.value = markRaw(PageEditor);
	}
}, { immediate: true });
watch([isPage, pageEditor], () => nextTick(scheduleRefresh));
watch(() => [props.catalog, selectedNode.value?.module.type, props.mode] as const, async ([, type]) => {
	const active = ++generation;
	moduleEditor.value = undefined;
	sortableCapability.value = undefined;
	error.value = '';
	if (!type || isRendererPageModule(type)) return;
	loading.value = true;
	try {
		const definition = await props.catalog.get(type);
		if (active === generation && definition) {
			moduleEditor.value = markRaw(definition.frames[props.mode]?.editor || definition.editor);
			sortableCapability.value = definition.frames.sortable;
		}
	} catch (reason) {
		if (active === generation) error.value = reason instanceof Error ? reason.message : String(reason);
	} finally {
		if (active === generation) {
			loading.value = false;
			nextTick(scheduleRefresh);
		}
	}
}, { immediate: true });
watch(() => selectedNode.value?.module.props, () => nextTick(scheduleRefresh), { deep: true });
type RendererPlacementGeometry = Pick<RendererPlacement, 'x' | 'y' | 'width' | 'height' | 'rotate' | 'zIndex'>;
const positionKeys: Array<keyof RendererPlacementGeometry> = ['x', 'y'];
const sizeKeys: Array<keyof RendererPlacementGeometry> = ['width', 'height'];
const extraKeys: Array<keyof RendererPlacementGeometry> = ['rotate', 'zIndex'];
const placementPrefix: Record<keyof RendererPlacementGeometry, string> = {
	x: 'X',
	y: 'Y',
	width: 'W',
	height: 'H',
	rotate: 'R',
	zIndex: 'Z'
};
const placementLimits: Record<keyof RendererPlacementGeometry, { min: number; max: number; step?: number }> = {
	x: { min: -2000, max: 5000 },
	y: { min: -2000, max: 5000 },
	width: { min: 1, max: 3840 },
	height: { min: 1, max: 3840 },
	rotate: { min: -180, max: 180 },
	zIndex: { min: -100, max: 1000 }
};
const radiusSource = computed<RendererCornerRadii | undefined>(() => {
	if (isPage.value) return undefined;
	if (selectedNode.value && 'appearance' in selectedNode.value) return selectedNode.value.appearance;
	if (selectedNode.value && 'placement' in selectedNode.value) return selectedNode.value.placement;
	return undefined;
});
const updateAppearance = (patch: Partial<RendererSortableAppearance>) => {
	const node = selectedNode.value as RendererSortableNode | undefined;
	if (!node?.appearance) return;
	const next = { ...node.appearance, ...patch };
	if (typeof next.maxWidth !== 'number' || !Number.isFinite(next.maxWidth) || next.maxWidth <= 0) {
		delete next.maxWidth;
	}
	props.store.updateAppearance(node.id, next);
};
const updatePlacement = (key: keyof RendererPlacementGeometry, value: number) => {
	const node = selectedNode.value as RendererDraggableNode | undefined;
	if (node?.placement) props.store.updatePlacement(node.id, { ...node.placement, [key]: value });
};
const updateRadius = (patch: Partial<RendererCornerRadii>) => {
	const node = selectedNode.value;
	if (!node || isPage.value) return;
	if ('appearance' in node && node.appearance) {
		updateAppearance(patch);
		return;
	}
	if ('placement' in node && node.placement) {
		props.store.updatePlacement(node.id, { ...node.placement, ...patch });
	}
};
const handleUpdateProps = (value: Record<string, unknown>) => {
	if (!selectedNode.value) return;
	if (!isRendererJsonSafe(value)) {
		Message.error(t('renderer.common.validationFailed'));
		return;
	}
	props.store.updateProps(selectedNode.value.id, value);
};
const handleUpdateLayout = async (value: Record<string, unknown> | RendererLayout) => {
	const layout = value as RendererLayout;
	if (layout.mode !== 'sortable' && layout.mode !== 'draggable') return;
	if (layout.mode === props.store.document.layout.mode) {
		props.store.updateLayout(layout);
		return;
	}
	props.store.replaceDocument(await convertRendererDocumentFrame(
		props.store.document,
		layout,
		props.catalog
	));
};
</script>
