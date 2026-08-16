<template>
	<div ref="host" class="docs-renderer" :data-renderer-mode="mode" :style="hostStyle">
		<div v-if="fatalError" class="docs-renderer__error">{{ fatalError }}</div>
		<div v-else-if="prepared" class="docs-renderer__viewport" :style="viewportStyle">
			<div class="docs-renderer__canvas" :style="canvasStyle">
				<NodeView
					v-for="node in contentBlocks"
					:key="node.id"
					:node="node"
					:context="moduleContext"
					:catalog="catalog"
					:frame-mode="mode"
					:issue="nodeIssues.get(node.id)"
				/>
			</div>
		</div>
	</div>
</template>
<script setup lang="ts">
import {
	computed,
	onBeforeUnmount,
	onMounted,
	ref,
	shallowRef,
	watch
} from 'vue';
import type { CSSProperties } from 'vue';
import { provideLocale, useLocale } from '@deot/docs-locale';
import { createRendererModuleCatalog } from '../../catalog';
import { prepareRendererDocument } from '../../document';
import { BuiltinModules } from '../../modules';
import { rendererPublishedBlocks } from '../../modules/shared/selection';
import { rendererPageBackgroundCss } from '../../utils/page-background';
import type {
	RendererContext,
	RendererDocument,
	RendererFit,
	RendererModuleContext,
	RendererModuleSource
} from '../../types';
import NodeView from './node.vue';

const props = defineProps<{
	document: RendererDocument;
	modules?: readonly RendererModuleSource[];
	context?: RendererContext;
	fit?: RendererFit;
}>();
const localeContext = useLocale(computed(() => props.context?.locale));
// Renderer 可以独立使用，不能要求业务 Viewer 自行读取 context 才能获得正确语言。
provideLocale(localeContext.locale);
const host = ref<HTMLElement>();
const prepared = shallowRef<RendererDocument>();
const fatalError = ref('');
const issues = ref<Array<{ nodeId?: string; message: string; severity: string }>>([]);
const scale = ref(1);
let generation = 0;
let observer: ResizeObserver | undefined;
const sources = computed(() => props.modules === undefined ? BuiltinModules : props.modules);
const catalog = computed(() => createRendererModuleCatalog(sources.value));
const mode = computed(() => props.document?.layout?.mode === 'draggable' ? 'draggable' : 'sortable');
const moduleContext = computed<RendererModuleContext>(() => ({
	...(props.context || {}),
	scene: 'renderer',
	frameMode: mode.value,
	readonly: true
}));
const nodeIssues = computed(() => {
	const result = new Map<string, string>();
	issues.value.filter(issue => issue.nodeId && issue.severity === 'error').forEach((issue) => {
		if (!result.has(issue.nodeId!)) result.set(issue.nodeId!, issue.message);
	});
	return result;
});

const resize = () => {
	if (!host.value || mode.value !== 'draggable') {
		scale.value = 1;
		return;
	}
	const layout = props.document?.layout;
	if (!layout) return;
	if (layout.mode !== 'draggable') return;
	const fit = props.fit || 'width';
	if (fit === 'none') {
		scale.value = 1;
		return;
	}
	const widthScale = host.value.clientWidth / layout.width;
	const heightScale = host.value.clientHeight > 0 ? host.value.clientHeight / layout.height : widthScale;
	scale.value = Math.max(0.01, fit === 'contain' ? Math.min(widthScale, heightScale) : widthScale);
};

watch(
	() => [props.document, sources.value, props.context] as const,
	async () => {
		const active = ++generation;
		fatalError.value = '';
		try {
			const result = await prepareRendererDocument(
				props.document,
				catalog.value,
				moduleContext.value,
				{ unknownModuleSeverity: 'error' }
			);
			if (active !== generation) return;
			issues.value = result.issues;
			prepared.value = result.document;
			if (!result.document) fatalError.value = result.issues.map(issue => issue.message).join('; ');
		} catch (reason) {
			if (active === generation) fatalError.value = reason instanceof Error ? reason.message : String(reason);
		}
	},
	{ immediate: true, deep: true }
);
watch(() => [props.document?.layout, props.fit], resize, { deep: true });

const contentBlocks = computed(() => rendererPublishedBlocks(
	[...(prepared.value?.blocks || [])]
));

const hostStyle = computed<CSSProperties>(() => mode.value === 'draggable' && (props.fit || 'width') === 'contain'
	? { minHeight: 0, height: '100%' }
	: {});
const viewportStyle = computed<CSSProperties>(() => {
	if (!prepared.value || prepared.value.layout.mode !== 'draggable') return {};
	return {
		width: `${prepared.value.layout.width * scale.value}px`,
		height: `${prepared.value.layout.height * scale.value}px`
	};
});
const canvasStyle = computed<CSSProperties>(() => {
	if (!prepared.value) return {};
	const layout = prepared.value.layout;
	if (layout.mode === 'sortable') {
		const style: CSSProperties = {
			width: '100%',
			background: rendererPageBackgroundCss(layout.background)
		};
		if ((layout.minHeight || 0) > 0) style.minHeight = `${layout.minHeight}px`;
		return style;
	}
	return {
		position: 'relative',
		width: `${layout.width}px`,
		height: `${layout.height}px`,
		background: rendererPageBackgroundCss(layout.background),
		transform: `scale(${scale.value})`,
		transformOrigin: 'top left'
	};
});

onMounted(() => {
	resize();
	if (typeof ResizeObserver !== 'undefined' && host.value) {
		observer = new ResizeObserver(resize);
		observer.observe(host.value);
	}
});
onBeforeUnmount(() => {
	generation += 1;
	observer?.disconnect();
});
</script>
