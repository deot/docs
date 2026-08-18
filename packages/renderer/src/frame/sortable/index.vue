<template>
	<div ref="root" class="docs-renderer-frame docs-renderer-frame--sortable">
		<Scroller ref="scroller" height="100%" :native="false" :show-bar="true" :auto-resize="false">
			<div class="docs-renderer-frame__viewport" :style="viewportStyle" @pointerdown="handleBlankPointerDown">
				<div class="docs-renderer-frame__scaled docs-renderer-frame__scaled--sortable" :style="scaledStyle">
					<div
						ref="canvas"
						class="docs-renderer-frame__canvas"
						:style="canvasStyle"
						@dragover.prevent="handleCanvasDragOver"
						@dragenter.prevent="handleCanvasDragEnter"
						@dragleave="handleCanvasDragLeave"
						@drop.prevent="handleWidgetDrop"
					>
						<TransitionGroup tag="div" name="docs-renderer-flip" class="docs-renderer-frame__list">
							<div
								v-for="(node, index) in blocks"
								:key="node.id"
								:ref="element => setItemRef(node.id, element)"
								class="docs-renderer-frame__item"
								:class="{
									'is-selected': store.selectedId === node.id,
									'is-dragging': Boolean(sortSession && sortSession.id === node.id && sortSession.moved),
									'is-full-width': rendererSortableFillsCanvas(capabilityFor(node.id), node.appearance)
								}"
								:style="itemStyle(node)"
								:draggable="canMove(node.id)"
								@pointerdown="event => handleItemPointerDown(event, node.id)"
								@click="event => handleItemClick(event, node.id)"
								@dragstart="event => handleSortStart(event, node.id, index)"
								@dragenter="event => handleSortEnter(event, node.id, index)"
								@dragover.prevent
								@dragend="handleSortEnd"
							>
								<div class="docs-renderer-frame__item-body">
									<RendererNode
										:node="node"
										:context="context"
										:catalog="catalog"
										frame-mode="sortable"
									/>
								</div>
								<div
									v-if="store.selectedId === node.id"
									class="docs-renderer-selection docs-renderer-selection--sortable"
								>
									<button
										v-if="canDelete(node.id)"
										type="button"
										class="docs-renderer-selection__delete"
										:aria-label="t('renderer.inspector.delete')"
										@click.stop="store.removeNode(node.id)"
									>
										✕
									</button>
								</div>
								<div
									v-if="widgetDropIndex === index"
									class="docs-renderer-frame__drop-slot"
								>
									{{ t('renderer.canvas.releaseToInsert') }}
								</div>
							</div>
						</TransitionGroup>
						<div
							v-if="widgetDropIndex === blocks.length && (blocks.length || widgetDragging)"
							class="docs-renderer-frame__drop-slot"
						>
							{{ t('renderer.canvas.releaseToInsert') }}
						</div>
						<div v-if="!blocks.length && !widgetDragging" class="docs-renderer-frame__empty">
							{{ t('renderer.canvas.dropModules') }}
						</div>
					</div>
				</div>
			</div>
		</Scroller>
		<ZoomBar :scale="scale" :fit-scale="fitScale" @update:scale="handleScaleUpdate" />
	</div>
</template>
<script setup lang="ts">
import {
	computed,
	nextTick,
	onBeforeUnmount,
	onMounted,
	ref,
	watch
} from 'vue';
import { Scroller } from '@deot/vc';
import { useLocale } from '@deot/docs-locale';
import type { ComponentPublicInstance, CSSProperties } from 'vue';
import type { RendererModuleCatalog } from '../../catalog';
import type {
	RendererModuleContext,
	RendererSortableCapability,
	RendererSortableNode
} from '../../types';
import type { RendererStore } from '../../store';
import { RENDERER_WIDGET_MIME } from '../../widget/constants';
import type { RendererCreateTarget } from '../../widget/constants';
import RendererNode from '../../assist/renderer/node.vue';
import ZoomBar from '../shared/zoom-bar.vue';
import { captureZoomAnchor, restoreZoomAnchor } from '../shared/zoom-anchor';
import { deactivateRendererSelection } from '../shared/blur-selection';
import { rendererContentBlocks } from '../../modules/shared/page';
import { rendererPageBackgroundCss } from '../../utils/page-background';
import {
	rendererSortableFillsCanvas,
	rendererSortableItemStyle
} from '../shared/sortable-width';

const SORT_MIME = 'application/x-docs-renderer-sort';

const props = defineProps<{
	store: RendererStore;
	catalog: RendererModuleCatalog;
	context: RendererModuleContext;
}>();
const emit = defineEmits<{
	create: [payload: RendererCreateTarget & { index: number }];
}>();
const { t } = useLocale(computed(() => props.context.locale));
const root = ref<HTMLElement>();
const canvas = ref<HTMLElement>();
const scroller = ref<{ refresh: () => Promise<void> }>();
const canvasHeight = ref(0);
const viewportSize = ref({ width: 0, height: 0 });
const itemRefs = new Map<string, HTMLElement>();
const widgetDropIndex = ref(-1);
const widgetDragging = ref(false);
const blocks = computed(() => rendererContentBlocks(
	props.store.document.blocks as readonly RendererSortableNode[]
));
const capabilities = ref(new Map<string, RendererSortableCapability>());
let capabilityGeneration = 0;
watch(
	() => [
		props.catalog,
		blocks.value.map(node => `${node.id}:${node.module.type}`).join('|')
	] as const,
	async () => {
		const active = ++capabilityGeneration;
		const entries = await Promise.all(blocks.value.map(async (node) => {
			try {
				const definition = await props.catalog.get(node.module.type);
				return [node.id, definition?.frames.sortable] as const;
			} catch {
				return [node.id, undefined] as const;
			}
		}));
		if (active !== capabilityGeneration) return;
		capabilities.value = new Map(entries.filter(
			(entry): entry is readonly [string, RendererSortableCapability] => Boolean(entry[1])
		));
	},
	{ immediate: true }
);
const capabilityFor = (id: string) => capabilities.value.get(id);
const itemStyle = (node: RendererSortableNode) => rendererSortableItemStyle(
	capabilityFor(node.id),
	node.appearance
);
const canDelete = (id: string) => {
	const capability = capabilityFor(id);
	return Boolean(capability && capability.deletable !== false);
};
const canMove = (id: string) => {
	const capability = capabilityFor(id);
	return Boolean(capability && capability.movable !== false);
};
const SORTABLE_PAD = 48;
const layout = computed(() => props.store.document.layout.mode === 'sortable' ? props.store.document.layout : null);
const scale = computed(() => props.store.viewport.scale);
const pageWidth = computed(() => layout.value?.maxWidth);
const minHeight = computed(() => layout.value?.minHeight || 0);
// 画板宽度来自页面 layout.maxWidth；发布页仍随容器铺开。
const canvasWidth = computed(() => Math.max(320, pageWidth.value || 1920));
const canvasStyle = computed<CSSProperties>(() => {
	const style: CSSProperties = {
		width: `${canvasWidth.value}px`,
		margin: 0,
		background: rendererPageBackgroundCss(layout.value?.background),
		transform: `scale(${scale.value})`,
		transformOrigin: 'top left'
	};
	if (minHeight.value > 0) style.minHeight = `${minHeight.value}px`;
	return style;
});
const scaledStyle = computed<CSSProperties>(() => ({
	width: `${canvasWidth.value * scale.value}px`,
	height: `${Math.max(canvasHeight.value, minHeight.value) * scale.value}px`
}));
const viewportStyle = computed<CSSProperties>(() => {
	const width = canvasWidth.value * scale.value;
	const height = Math.max(canvasHeight.value, minHeight.value) * scale.value;
	const pad = SORTABLE_PAD;
	return {
		boxSizing: 'border-box',
		width: `${Math.max(viewportSize.value.width, width + pad * 2)}px`,
		height: `${height + pad * 2}px`,
		padding: `${pad}px`
	};
});
let mutationObserver: MutationObserver | undefined;
let sizeObserver: ResizeObserver | undefined;
let resizeFrame = 0;
let pendingForceRefresh = false;
const syncCanvasHeight = async (forceRefresh = false) => {
	const next = Math.max(canvas.value?.scrollHeight || 0, canvas.value?.offsetHeight || 0);
	const changed = next !== canvasHeight.value;
	if (changed) canvasHeight.value = next;
	if (!changed && !forceRefresh) return;
	await nextTick();
	await scroller.value?.refresh();
};
const scheduleCanvasHeight = (forceRefresh = false) => {
	pendingForceRefresh = pendingForceRefresh || forceRefresh;
	if (resizeFrame) cancelAnimationFrame(resizeFrame);
	resizeFrame = requestAnimationFrame(() => {
		resizeFrame = 0;
		const force = pendingForceRefresh;
		pendingForceRefresh = false;
		void syncCanvasHeight(force);
	});
};
const syncViewportSize = () => {
	const wrapper = root.value?.querySelector<HTMLElement>('.vc-scroller__wrapper');
	if (!wrapper) return;
	viewportSize.value = { width: wrapper.clientWidth, height: wrapper.clientHeight };
};
const fitScale = computed(() => Math.min(1, Math.max(
	0.1,
	(viewportSize.value.width - SORTABLE_PAD * 2) / canvasWidth.value
)));
const getScrollWrapper = () => root.value?.querySelector<HTMLElement>('.vc-scroller__wrapper') || null;
let scaleGeneration = 0;
const handleWindowResize = () => {
	syncViewportSize();
	scheduleCanvasHeight(true);
};
watch(() => [
	blocks.value.length,
	layout.value?.minHeight,
	canvasWidth.value,
	scale.value
], () => {
	nextTick(() => scheduleCanvasHeight(true));
});
const handleScaleUpdate = async (value: number) => {
	const active = ++scaleGeneration;
	const wrapper = getScrollWrapper();
	const selected = props.store.selectedId ? itemRefs.get(props.store.selectedId) || null : null;
	const anchor = captureZoomAnchor(wrapper, canvas.value || null, selected);
	props.store.updateViewport({ scale: value });
	await nextTick();
	await scroller.value?.refresh();
	await nextTick();
	if (active === scaleGeneration) restoreZoomAnchor(wrapper, anchor);
};

interface SortSession {
	id: string;
	startIndex: number;
	endIndex: number;
	moved: boolean;
}
const sortSession = ref<SortSession>();
let sortTimer: ReturnType<typeof setTimeout> | undefined;
const setItemRef = (id: string, value: Element | ComponentPublicInstance | null) => {
	if (value instanceof HTMLElement) itemRefs.set(id, value);
	else itemRefs.delete(id);
};
const interactive = (target: EventTarget | null) => target instanceof Element && Boolean(
	target.closest('a,button,input,textarea,select,[contenteditable="true"]')
);
const handleBlankPointerDown = (event: PointerEvent) => {
	deactivateRendererSelection(props.store, event);
};
const handleItemPointerDown = (event: PointerEvent, id: string) => {
	if (event.button !== 0 || interactive(event.target)) return;
	props.store.select(id);
};
const handleItemClick = (event: MouseEvent, id: string) => {
	if (interactive(event.target)) return;
	props.store.select(id);
};
const clearSortSession = () => {
	sortSession.value = undefined;
	if (sortTimer) {
		clearTimeout(sortTimer);
		sortTimer = undefined;
	}
};
const handleSortStart = (event: DragEvent, id: string, index: number) => {
	if (!canMove(id) || interactive(event.target)) {
		event.preventDefault();
		return;
	}
	props.store.select(id);
	event.dataTransfer?.setData(SORT_MIME, id);
	if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
	sortSession.value = { id, startIndex: index, endIndex: index, moved: false };
};
const handleSortEnter = (event: DragEvent, id: string, index: number) => {
	const session = sortSession.value;
	if (!session || session.id === id) return;
	event.preventDefault();
	session.moved = true;
	if (sortTimer) return;
	sortTimer = setTimeout(() => {
		sortTimer = undefined;
	}, 500);
	if (session.endIndex === index) return;
	props.store.moveNode(session.id, index, { history: false });
	session.endIndex = props.store.getNodeIndex(session.id);
};
const handleSortEnd = () => {
	const session = sortSession.value;
	clearSortSession();
	if (!session) return;
	const endIndex = props.store.getNodeIndex(session.id);
	if (endIndex >= 0 && endIndex !== session.startIndex) {
		props.store.commitMove(session.id, session.startIndex, endIndex);
	}
};
const handleIdlePointerUp = () => {
	const session = sortSession.value;
	if (!session || session.moved) return;
	clearSortSession();
};
onMounted(() => {
	if (typeof MutationObserver !== 'undefined' && canvas.value) {
		mutationObserver = new MutationObserver(() => scheduleCanvasHeight());
		mutationObserver.observe(canvas.value, {
			characterData: true,
			childList: true,
			subtree: true
		});
	}
	if (typeof ResizeObserver !== 'undefined' && canvas.value) {
		sizeObserver = new ResizeObserver(() => scheduleCanvasHeight());
		sizeObserver.observe(canvas.value);
	}
	window.addEventListener('resize', handleWindowResize);
	window.addEventListener('dragend', handleSortEnd);
	window.addEventListener('pointerup', handleIdlePointerUp);
	nextTick(() => {
		syncViewportSize();
		handleScaleUpdate(fitScale.value);
		scheduleCanvasHeight(true);
	});
});
onBeforeUnmount(() => {
	capabilityGeneration += 1;
	scaleGeneration += 1;
	mutationObserver?.disconnect();
	sizeObserver?.disconnect();
	window.removeEventListener('resize', handleWindowResize);
	window.removeEventListener('dragend', handleSortEnd);
	window.removeEventListener('pointerup', handleIdlePointerUp);
	if (resizeFrame) cancelAnimationFrame(resizeFrame);
	clearSortSession();
});
const isWidgetDrag = (event: DragEvent) => (
	Array.from(event.dataTransfer?.types || []).includes(RENDERER_WIDGET_MIME)
);
const resolveDropIndex = (clientY: number) => {
	for (let index = 0; index < blocks.value.length; index += 1) {
		const element = itemRefs.get(blocks.value[index].id);
		if (!element) continue;
		const rect = element.getBoundingClientRect();
		if (clientY < rect.top + rect.height / 2) return index;
	}
	return blocks.value.length;
};
const autoScroll = (clientY: number) => {
	const wrapper = getScrollWrapper();
	if (!wrapper) return;
	const rect = wrapper.getBoundingClientRect();
	if (clientY < rect.top + 36) wrapper.scrollTop -= 18;
	else if (clientY > rect.bottom - 36) wrapper.scrollTop += 18;
};
const handleCanvasDragEnter = (event: DragEvent) => {
	if (!isWidgetDrag(event) || sortSession.value) return;
	widgetDragging.value = true;
};
const handleCanvasDragOver = (event: DragEvent) => {
	if (!isWidgetDrag(event) || sortSession.value) return;
	widgetDragging.value = true;
	widgetDropIndex.value = resolveDropIndex(event.clientY);
	autoScroll(event.clientY);
};
const handleCanvasDragLeave = (event: DragEvent) => {
	const related = event.relatedTarget as Node | null;
	if (related && canvas.value?.contains(related)) return;
	widgetDragging.value = false;
	widgetDropIndex.value = -1;
};
const handleWidgetDrop = (event: DragEvent) => {
	const source = event.dataTransfer?.getData(RENDERER_WIDGET_MIME);
	const index = resolveDropIndex(event.clientY);
	widgetDragging.value = false;
	widgetDropIndex.value = -1;
	if (!source) return;
	try {
		const payload = JSON.parse(source) as RendererCreateTarget;
		emit('create', { ...payload, index });
	} catch {
		// 非 Renderer 拖拽数据交给浏览器处理。
	}
};
</script>
