<template>
	<div
		class="docs-renderer-node"
		:class="{
			[`docs-renderer-node--${safeType}`]: true,
			'is-editing': isEditing,
			'is-full-width': fillCanvas
		}"
		:style="nodeStyle"
		:data-renderer-node-id="node.id"
		:data-renderer-module="node.module.type"
		@click.capture="suppressEditingEvent"
		@auxclick.capture="suppressEditingEvent"
	>
		<div v-if="issue || loadError || renderError" class="docs-renderer-node__state docs-renderer-node__state--error">
			{{ issue || loadError || renderError }}
		</div>
		<div v-else-if="loading" class="docs-renderer-node__state">{{ t('renderer.common.loading') }}</div>
		<component v-else-if="viewer" :is="viewer" :node="node" :context="context" />
		<div v-else class="docs-renderer-node__state docs-renderer-node__state--missing">
			{{ t('renderer.common.unknownModule', { type: node.module.type }) }}
		</div>
	</div>
</template>
<script setup lang="ts">
import {
	computed,
	markRaw,
	onErrorCaptured,
	ref,
	watch
} from 'vue';
import type { Component, CSSProperties } from 'vue';
import { useLocale } from '@deot/docs-locale';
import type { RendererModuleCatalog } from '../../catalog';
import type {
	RendererFrameMode,
	RendererModuleContext,
	RendererNode,
	RendererSortableCapability
} from '../../types';
import { rendererBorderRadiusStyle } from '../../utils/radius';
import {
	rendererSortableContentCssWidth,
	rendererSortableFillsCanvas,
	rendererSortableMaxWidth
} from '../../frame/shared/sortable-width';

const props = defineProps<{
	node: RendererNode;
	context: RendererModuleContext;
	catalog: RendererModuleCatalog;
	frameMode: RendererFrameMode;
	issue?: string;
}>();
const { t } = useLocale(computed(() => props.context.locale));
const isEditing = computed(() => props.context.scene === 'combo' && !props.context.readonly);
const suppressEditingEvent = (event: Event) => {
	if (!isEditing.value) return;
	event.preventDefault();
};
const viewer = ref<Component>();
const loading = ref(false);
const loadError = ref('');
const renderError = ref('');
const sortableCapability = ref<RendererSortableCapability>();
const fillCanvas = computed(() => props.frameMode === 'sortable'
	&& rendererSortableFillsCanvas(sortableCapability.value, props.node.appearance));
const contentCssWidth = computed(() => rendererSortableContentCssWidth(
	sortableCapability.value,
	props.node.appearance
));
let generation = 0;
const safeType = computed(() => props.node.module.type.replace(/[^a-z\d_-]/giu, '-'));
const nodeStyle = computed<CSSProperties>(() => {
	if (props.frameMode === 'sortable') {
		const appearance = props.node.appearance;
		const liftMargin = props.context.scene === 'combo';
		const maxWidth = rendererSortableMaxWidth(sortableCapability.value, appearance);
		return {
			'minHeight': liftMargin ? '20px' : undefined,
			'marginTop': liftMargin ? '0px' : `${appearance?.marginTop || 0}px`,
			'marginBottom': liftMargin ? '0px' : `${appearance?.marginBottom || 0}px`,
			'paddingTop': `${appearance?.paddingTop || 0}px`,
			'paddingRight': `${appearance?.paddingRight || 0}px`,
			'paddingBottom': `${appearance?.paddingBottom || 0}px`,
			'paddingLeft': `${appearance?.paddingLeft || 0}px`,
			'--docs-renderer-content-width': contentCssWidth.value,
			...(typeof maxWidth === 'number' ? { maxWidth: `${maxWidth}px` } : {}),
			...rendererBorderRadiusStyle(appearance)
		};
	}
	const placement = props.node.placement;
	if (!placement) return {};
	return {
		position: 'absolute',
		left: `${placement.x}px`,
		top: `${placement.y}px`,
		width: `${placement.width}px`,
		height: `${placement.height}px`,
		zIndex: placement.zIndex,
		transform: `rotate(${placement.rotate}deg)`,
		transformOrigin: 'center',
		...rendererBorderRadiusStyle(placement)
	};
});

watch(
	() => [props.catalog, props.node.module.type, props.frameMode] as const,
	async () => {
		const active = ++generation;
		loading.value = true;
		loadError.value = '';
		renderError.value = '';
		viewer.value = undefined;
		sortableCapability.value = undefined;
		try {
			const definition = await props.catalog.get(props.node.module.type);
			if (active !== generation || !definition) return;
			viewer.value = markRaw(definition.frames[props.frameMode]?.viewer || definition.viewer);
			sortableCapability.value = definition.frames.sortable;
		} catch (reason) {
			if (active === generation) loadError.value = reason instanceof Error ? reason.message : String(reason);
		} finally {
			if (active === generation) loading.value = false;
		}
	},
	{ immediate: true }
);

watch(
	() => [props.node.module.props, props.context] as const,
	() => {
		// Viewer 可能只因某次临时属性无效而抛错；后续编辑应允许它重新渲染恢复。
		renderError.value = '';
	},
	{ deep: true }
);

onErrorCaptured((reason) => {
	renderError.value = reason instanceof Error ? reason.message : String(reason);
	return false;
});
</script>
