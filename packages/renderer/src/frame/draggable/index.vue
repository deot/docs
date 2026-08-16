<template>
	<div ref="root" class="docs-renderer-frame docs-renderer-frame--draggable">
		<div
			class="docs-renderer-frame__inner"
			:class="{ 'is-hide-ruler': !store.viewport.showRuler }"
			@pointerdown="handleBlankPointerDown"
		>
			<Ruler
				:hidden="!store.viewport.showRuler"
				:scroll-left="store.viewport.scrollLeft"
				:scroll-top="store.viewport.scrollTop"
				:frame-w="layout?.width || 1"
				:frame-h="layout?.height || 1"
				:client-w="viewportSize.width"
				:client-h="viewportSize.height"
				:scale="scale"
				:placeholder="rulerPad * 2"
				:dark="context.theme === 'dark'"
				:origin-title="store.viewport.showGuides
					? t('renderer.canvas.hideGuidesHint')
					: t('renderer.canvas.showGuidesHint')"
				:delete-title="t('renderer.canvas.deleteGuide')"
				:show-guides="store.viewport.showGuides"
				:guide-x="store.viewport.guideX"
				:guide-y="store.viewport.guideY"
				:preview="rulerPreview"
				@toggle-guides="toggleViewport('showGuides')"
				@axis-pointerdown="handleRulerPointerDown"
				@axis-move="handleRulerMove"
				@axis-leave="rulerPreview = undefined"
				@guide-pointerdown="handleGuidePointerDown"
				@guide-dblclick="removeGuide"
			>
				<Scroller ref="scroller" height="100%" :native="false" :show-bar="true">
					<div
						class="docs-renderer-frame__viewport docs-renderer-frame__viewport--draggable"
						:style="viewportStyle"
					>
						<div class="docs-renderer-frame__scaled" :style="scaledStyle">
							<div
								ref="artboard"
								class="docs-renderer-frame__artboard"
								:class="{ 'has-grid': store.viewport.showGrid }"
								:style="artboardStyle"
								@pointerdown="handleCanvasPointerDown"
								@dragover.prevent="handleWidgetDragOver"
								@dragleave="handleWidgetDragLeave"
								@drop.prevent="handleWidgetDrop"
								@contextmenu.prevent="handleContextMenu"
							>
								<GridLines
									v-if="store.viewport.showGrid && layout"
									:width="layout.width"
									:height="layout.height"
									:grid="[store.viewport.gridSize, store.viewport.gridSize]"
								/>
								<PageViewer
									:node="pageNode"
									:context="pageContext"
									@resize="handlePageResize"
								/>
								<RendererNode
									v-for="node in blocks"
									:key="node.id"
									:node="node"
									:context="context"
									:catalog="catalog"
									frame-mode="draggable"
								/>
								<div
									v-if="dropGhost"
									class="docs-renderer-drop-ghost"
									:style="dropGhostStyle"
								/>
								<div class="docs-renderer-overlay">
									<div
										v-for="node in selectedNodes"
										:key="node.id"
										class="docs-renderer-selection docs-renderer-selection--draggable"
										:class="{
											'is-primary': node.id === store.selectedId,
											'is-locked': Boolean(node.locked)
										}"
										:data-renderer-node-id="node.id"
										:style="selectionStyle(node.placement)"
										@pointerdown.stop="event => handleMoveStart(event, node.id)"
										@contextmenu.prevent.stop="event => handleContextMenu(event, node.id)"
									>
										<template
											v-if="node.id === store.selectedId && selectedNodes.length === 1 && selectedCapability && !node.locked"
										>
											<button
												v-for="handle in handles"
												:key="handle"
												type="button"
												class="docs-renderer-selection__handle"
												:class="`docs-renderer-selection__handle--${handle}`"
												:aria-label="t('renderer.canvas.resize', { handle })"
												@pointerdown.stop="event => handleResizeStart(event, handle)"
											/>
											<button
												v-if="selectedCapability?.rotatable !== false"
												type="button"
												class="docs-renderer-selection__rotate"
												:aria-label="t('renderer.canvas.rotate')"
												@pointerdown.stop="handleRotateStart"
											/>
											<div
												v-if="isRotating"
												class="docs-renderer-selection__rotate-beam"
												:style="{ width: `${rotateHudLength}px` }"
											/>
										</template>
										<button
											v-if="node.id === store.selectedId && selectedCapability && selectedCapability.deletable !== false"
											type="button"
											class="docs-renderer-selection__delete"
											:aria-label="t('renderer.inspector.delete')"
											@click.stop="store.removeNode(node.id)"
										>
											✕
										</button>
									</div>
									<div
										v-if="rotatingNode?.placement"
										class="docs-renderer-rotate-hud"
										:style="rotateHudStyle"
									>
										<div
											v-for="deg in [0, 45, 90, 135]"
											:key="deg"
											class="docs-renderer-rotate-hud__deg"
											:class="`is-${deg}`"
											:style="{ width: `${rotateHudLength}px` }"
										/>
										<div class="docs-renderer-selection__rotate-tip">
											{{ Math.round(rotatingNode.placement.rotate) }} °
										</div>
									</div>
									<div v-if="marquee" class="docs-renderer-marquee" :style="marqueeStyle" />
									<template v-if="store.viewport.showGuides">
										<div
											v-for="value in guideX"
											:key="`snap-x-${value}`"
											class="docs-renderer-guide docs-renderer-guide--vertical is-snap"
											:style="{ left: `${value}px` }"
										/>
										<div
											v-for="value in guideY"
											:key="`snap-y-${value}`"
											class="docs-renderer-guide docs-renderer-guide--horizontal is-snap"
											:style="{ top: `${value}px` }"
										/>
									</template>
								</div>
							</div>
						</div>
					</div>
				</Scroller>
			</Ruler>
		</div>
		<div
			v-if="store.viewport.showThumbnail"
			class="docs-renderer-thumbnail"
			@click="handleThumbnailClick"
		>
			<div class="docs-renderer-thumbnail__canvas" :style="thumbnailStyle">
				<div
					v-for="node in thumbnailNodes"
					:key="node.id"
					class="docs-renderer-thumbnail__node"
					:style="thumbnailNodeStyle(node.placement)"
				/>
				<div
					class="docs-renderer-thumbnail__visible"
					:style="thumbnailVisibleStyle"
					@mousedown.stop="handleThumbnailVisibleDown"
					@click.stop
				/>
			</div>
		</div>
		<ZoomBar :scale="scale" :fit-scale="fitScale" @update:scale="handleScaleUpdate">
			<template #aids>
				<div class="docs-renderer-frame__controls">
					<Button type="text" @click="toggleViewport('showGrid')">{{ t('renderer.canvas.grid') }}</Button>
					<Button type="text" @click="toggleViewport('showRuler')">{{ t('renderer.canvas.ruler') }}</Button>
					<Button type="text" @click="toggleViewport('showGuides')">{{ t('renderer.canvas.guides') }}</Button>
					<Button type="text" @click="toggleViewport('showThumbnail')">{{ t('renderer.canvas.map') }}</Button>
				</div>
			</template>
		</ZoomBar>
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
import type { CSSProperties } from 'vue';
import { Button, Message, Scroller } from '@deot/vc';
import { useLocale } from '@deot/docs-locale';
import type { RendererModuleCatalog } from '../../catalog';
import type {
	RendererDraggableCapability,
	RendererDraggableLayout,
	RendererDraggableNode,
	RendererModuleContext,
	RendererPlacement,
	RendererResizeHandle
} from '../../types';
import type { RendererStore } from '../../store';
import { RENDERER_WIDGET_MIME, getWidgetDragSession } from '../../widget/constants';
import RendererNode from '../../assist/renderer/node.vue';
import ZoomBar from '../shared/zoom-bar.vue';
import { captureZoomAnchor, restoreZoomAnchor } from '../shared/zoom-anchor';
import { deactivateRendererSelection } from '../shared/blur-selection';
import {
	containGroupTranslation,
	containRotatedPlacement,
	resizeRotatedPlacement,
	snapPlacementToGuides
} from './geometry';
import GridLines from './grid-lines.vue';
import Ruler from './ruler.vue';
import { RULER_SIZE } from './ruler-paint';
import PageViewer from '../../modules/shared/page/viewer.vue';
import { createRendererPageNode, rendererContentBlocks } from '../../modules/shared/page';
import {
	findSelectionGroup,
	isRendererSelectionModule,
	selectionMemberIds
} from '../../modules/shared/selection';
import { rendererPageBackgroundCss } from '../../utils/page-background';
import {
	createRightMenuPortal,
	RENDERER_RIGHT_MENU,
	type RendererRightMenuAction
} from './right-menu';

const props = defineProps<{
	store: RendererStore;
	catalog: RendererModuleCatalog;
	context: RendererModuleContext;
}>();
const emit = defineEmits<{
	create: [payload: { type: string; presetKey?: string; index: number; point: { x: number; y: number } }];
}>();
const { t } = useLocale(computed(() => props.context.locale));
const root = ref<HTMLElement>();
const artboard = ref<HTMLElement>();
const scroller = ref<{ refresh: () => Promise<void> }>();
const viewportSize = ref({ width: 0, height: 0 });
const blocks = computed(() => rendererContentBlocks(
	props.store.document.blocks as readonly RendererDraggableNode[]
));
const thumbnailNodes = computed(() => blocks.value.filter(node => !isRendererSelectionModule(node.module.type)));
const layout = computed(() => props.store.document.layout.mode === 'draggable' ? props.store.document.layout : null);
const pageNode = computed(() => layout.value
	? createRendererPageNode(layout.value)
	: createRendererPageNode({ mode: 'draggable', width: 1200, height: 800, background: '#ffffff' }));
let pageLayoutBefore: RendererDraggableLayout | undefined;
const handlePageResize = (payload: { width: number; height: number; done?: boolean }) => {
	const current = layout.value;
	if (!current) return;
	if (!pageLayoutBefore) pageLayoutBefore = { ...current };
	const next = { ...current, width: payload.width, height: payload.height };
	props.store.updateLayout(next, { history: false });
	if (payload.done) {
		props.store.commitLayout(pageLayoutBefore, next);
		pageLayoutBefore = undefined;
	}
};
const dropGhost = ref<{ x: number; y: number; width: number; height: number }>();
const dropGhostStyle = computed<CSSProperties>(() => dropGhost.value
	? {
			left: `${dropGhost.value.x}px`,
			top: `${dropGhost.value.y}px`,
			width: `${dropGhost.value.width}px`,
			height: `${dropGhost.value.height}px`
		}
	: {});
const scale = computed(() => props.store.viewport.scale);
const pageContext = computed(() => ({
	...props.context,
	frameMode: 'draggable' as const,
	extra: { ...props.context.extra, scale: scale.value }
}));
const selectedNodes = computed(() => props.store.selectedIds
	.map(id => props.store.getNode(id) as RendererDraggableNode | undefined)
	.filter((value): value is RendererDraggableNode => Boolean(value?.placement)));
const capabilities = ref(new Map<string, RendererDraggableCapability>());
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
				return [node.id, definition?.frames.draggable] as const;
			} catch {
				// 单个延迟模块不可用时只禁用该节点的几何编辑能力。
				return [node.id, undefined] as const;
			}
		}));
		if (active !== capabilityGeneration) return;
		capabilities.value = new Map(entries.filter(
			(entry): entry is readonly [string, RendererDraggableCapability] => Boolean(entry[1])
		));
	},
	{ immediate: true }
);
const selectedCapability = computed(() => props.store.selectedId
	? capabilities.value.get(props.store.selectedId)
	: undefined);
const handles = computed(() => selectedCapability.value?.resizable === false
	? []
	: selectedCapability.value?.handles || ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'] as RendererResizeHandle[]);

const rulerPad = computed(() => props.store.viewport.showRuler ? RULER_SIZE : 0);
const scaledStyle = computed<CSSProperties>(() => ({
	width: `${(layout.value?.width || 1) * scale.value}px`,
	height: `${(layout.value?.height || 1) * scale.value}px`
}));
const viewportStyle = computed<CSSProperties>(() => {
	const pad = rulerPad.value;
	const width = (layout.value?.width || 1) * scale.value;
	const height = (layout.value?.height || 1) * scale.value;
	return {
		boxSizing: 'border-box',
		width: `${Math.max(viewportSize.value.width, width + pad * 2)}px`,
		height: `${height + pad * 2}px`,
		padding: `${pad}px`
	};
});
const artboardStyle = computed<CSSProperties>(() => ({
	width: `${layout.value?.width || 1}px`,
	height: `${layout.value?.height || 1}px`,
	margin: 0,
	backgroundColor: rendererPageBackgroundCss(layout.value?.background),
	transform: `scale(${scale.value})`,
	transformOrigin: 'top left'
}));
const selectionStyle = (placement: RendererPlacement): CSSProperties => ({
	left: `${placement.x}px`,
	top: `${placement.y}px`,
	width: `${placement.width}px`,
	height: `${placement.height}px`,
	transform: `rotate(${placement.rotate}deg)`,
	transformOrigin: 'center'
});

const toCanvasPoint = (event: Pick<PointerEvent | DragEvent | MouseEvent, 'clientX' | 'clientY'>) => {
	const rect = artboard.value?.getBoundingClientRect();
	return {
		x: (event.clientX - (rect?.left || 0)) / scale.value,
		y: (event.clientY - (rect?.top || 0)) / scale.value
	};
};

type Interaction
	= | { type: 'move'; pointerId: number; start: { x: number; y: number }; placements: Map<string, RendererPlacement> }
		| { type: 'resize'; pointerId: number; handle: RendererResizeHandle; original: RendererPlacement }
		| { type: 'rotate'; pointerId: number; original: RendererPlacement; center: { x: number; y: number }; startAngle: number }
		| { type: 'marquee'; pointerId: number; start: { x: number; y: number } }
		| { type: 'guide'; pointerId: number; axis: 'x' | 'y'; index: number };
const interaction = ref<Interaction>();
const isRotating = computed(() => interaction.value?.type === 'rotate');
const rotatingNode = computed(() => {
	if (!isRotating.value || !props.store.selectedId) return undefined;
	return props.store.getNode(props.store.selectedId) as RendererDraggableNode | undefined;
});
const rotateHudLength = computed(() => {
	const placement = rotatingNode.value?.placement;
	if (!placement) return 500;
	return Math.floor(Math.sqrt(placement.width ** 2 + placement.height ** 2) * 1.15);
});
const rotateHudStyle = computed<CSSProperties>(() => {
	const placement = rotatingNode.value?.placement;
	if (!placement) return {};
	return {
		left: `${placement.x}px`,
		top: `${placement.y}px`,
		width: `${placement.width}px`,
		height: `${placement.height}px`
	};
});
const marquee = ref<{ left: number; top: number; right: number; bottom: number }>();
const guideX = ref<number[]>([]);
const guideY = ref<number[]>([]);
const rulerPreview = ref<{ axis: 'x' | 'y'; value: number }>();
const marqueeStyle = computed<CSSProperties>(() => marquee.value
	? {
			left: `${marquee.value.left}px`,
			top: `${marquee.value.top}px`,
			width: `${marquee.value.right - marquee.value.left}px`,
			height: `${marquee.value.bottom - marquee.value.top}px`
		}
	: {});

const capture = (event: PointerEvent) => {
	(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
	window.addEventListener('pointermove', handlePointerMove);
	window.addEventListener('pointerup', handlePointerUp);
	window.addEventListener('pointercancel', handlePointerUp);
};
const resolveFrameNode = (id: string) => {
	const group = findSelectionGroup(blocks.value, id);
	return (group || props.store.getNode(id)) as RendererDraggableNode | undefined;
};
const handleMoveStart = (event: PointerEvent, id: string) => {
	const node = resolveFrameNode(id);
	if (event.button !== 0 || !node?.placement || node.locked) return;
	const capability = capabilities.value.get(node.id);
	if (!capability || capability.movable === false) return;
	if (!props.store.selectedIds.includes(node.id)) props.store.select(node.id);
	const placements = new Map<string, RendererPlacement>();
	[node.id, ...selectionMemberIds(node)].forEach((nodeId) => {
		const current = props.store.getNode(nodeId) as RendererDraggableNode | undefined;
		if (current?.placement) placements.set(nodeId, { ...current.placement });
	});
	interaction.value = { type: 'move', pointerId: event.pointerId, start: toCanvasPoint(event), placements };
	capture(event);
};
const handleResizeStart = (event: PointerEvent, handle: RendererResizeHandle) => {
	const node = props.store.selectedId ? props.store.getNode(props.store.selectedId) as RendererDraggableNode : undefined;
	if (!node?.placement || selectedCapability.value?.resizable === false) return;
	interaction.value = { type: 'resize', pointerId: event.pointerId, handle, original: { ...node.placement } };
	capture(event);
};
const handleRotateStart = (event: PointerEvent) => {
	const node = props.store.selectedId ? props.store.getNode(props.store.selectedId) as RendererDraggableNode : undefined;
	if (!node?.placement || selectedCapability.value?.rotatable === false) return;
	const center = { x: node.placement.x + node.placement.width / 2, y: node.placement.y + node.placement.height / 2 };
	const point = toCanvasPoint(event);
	interaction.value = {
		type: 'rotate',
		pointerId: event.pointerId,
		original: { ...node.placement },
		center,
		startAngle: Math.atan2(point.y - center.y, point.x - center.x) * 180 / Math.PI
	};
	capture(event);
};
const handleCanvasPointerDown = (event: PointerEvent) => {
	if (event.button !== 0) return;
	const element = event.target as Element;
	const nodeElement = element.closest<HTMLElement>('[data-renderer-node-id]');
	if (nodeElement) {
		const id = nodeElement.dataset.rendererNodeId || '';
		const node = resolveFrameNode(id);
		props.store.select(node?.id || null, event.metaKey || event.ctrlKey);
		return;
	}
	const start = toCanvasPoint(event);
	deactivateRendererSelection(props.store, event);
	interaction.value = { type: 'marquee', pointerId: event.pointerId, start };
	marquee.value = { left: start.x, right: start.x, top: start.y, bottom: start.y };
	capture(event);
};
const handleBlankPointerDown = (event: PointerEvent) => {
	deactivateRendererSelection(props.store, event);
};
const handleGuidePointerDown = (event: PointerEvent, axis: 'x' | 'y', index: number) => {
	interaction.value = { type: 'guide', pointerId: event.pointerId, axis, index };
	capture(event);
};
const handleRulerPointerDown = (event: PointerEvent, axis: 'x' | 'y') => {
	const point = toCanvasPoint(event);
	const key = axis === 'x' ? 'guideX' : 'guideY';
	const value = Math.floor(axis === 'x' ? point.x : point.y);
	const values = [...props.store.viewport[key], value];
	props.store.updateViewport({ [key]: values });
	handleGuidePointerDown(event, axis, values.length - 1);
};
const handleRulerMove = (event: MouseEvent, axis: 'x' | 'y') => {
	const point = toCanvasPoint(event);
	rulerPreview.value = {
		axis,
		value: Math.floor(axis === 'x' ? point.x : point.y)
	};
};
const removeGuide = (axis: 'x' | 'y', index: number) => {
	const key = axis === 'x' ? 'guideX' : 'guideY';
	const values = [...props.store.viewport[key]];
	values.splice(index, 1);
	props.store.updateViewport({ [key]: values });
};

const alignmentSnap = (placement: RendererPlacement, excluded: Set<string>) => {
	guideX.value = [];
	guideY.value = [];
	if (!props.store.viewport.showGuides) return { dx: 0, dy: 0 };
	const threshold = 5 / scale.value;
	const targetsX: number[] = [
		...props.store.viewport.guideX,
		...(layout.value ? [0, layout.value.width / 2, layout.value.width] : [])
	];
	const targetsY: number[] = [
		...props.store.viewport.guideY,
		...(layout.value ? [0, layout.value.height / 2, layout.value.height] : [])
	];
	for (const node of blocks.value) {
		if (excluded.has(node.id)) continue;
		targetsX.push(
			node.placement.x,
			node.placement.x + node.placement.width / 2,
			node.placement.x + node.placement.width
		);
		targetsY.push(
			node.placement.y,
			node.placement.y + node.placement.height / 2,
			node.placement.y + node.placement.height
		);
	}
	const result = snapPlacementToGuides(placement, targetsX, targetsY, threshold);
	guideX.value = result.guideX;
	guideY.value = result.guideY;
	return { dx: result.dx, dy: result.dy };
};
const clampPlacement = (id: string, value: RendererPlacement) => {
	const capability = capabilities.value.get(id);
	if (capability?.containment === 'none' || !layout.value) return value;
	return containRotatedPlacement(value, layout.value.width, layout.value.height);
};
const handlePointerMove = (event: PointerEvent) => {
	const active = interaction.value;
	if (!active || active.pointerId !== event.pointerId) return;
	const point = toCanvasPoint(event);
	if (active.type === 'move') {
		let delta = { x: point.x - active.start.x, y: point.y - active.start.y };
		const primary = props.store.selectedId && active.placements.get(props.store.selectedId);
		if (primary) {
			const grid = props.store.viewport.showGrid ? props.store.viewport.gridSize : 0;
			const candidate = {
				...primary,
				x: grid ? Math.round((primary.x + delta.x) / grid) * grid : primary.x + delta.x,
				y: grid ? Math.round((primary.y + delta.y) / grid) * grid : primary.y + delta.y
			};
			const adjustment = alignmentSnap(candidate, new Set(active.placements.keys()));
			delta.x = candidate.x - primary.x + adjustment.dx;
			delta.y = candidate.y - primary.y + adjustment.dy;
		}
		if (layout.value) {
			const contained = [...active.placements]
				.filter(([id]) => capabilities.value.get(id)?.containment !== 'none')
				.map(([, placement]) => placement);
			delta = containGroupTranslation(
				contained,
				delta,
				layout.value.width,
				layout.value.height
			);
		}
		active.placements.forEach((original, id) => {
			props.store.updatePlacement(id, {
				...original,
				x: original.x + delta.x,
				y: original.y + delta.y
			}, { history: false });
		});
	} else if (active.type === 'resize' && props.store.selectedId) {
		const capability = selectedCapability.value;
		const next = resizeRotatedPlacement(active.original, active.handle, point, {
			minWidth: capability?.minWidth,
			minHeight: capability?.minHeight,
			maxWidth: capability?.maxWidth,
			maxHeight: capability?.maxHeight,
			aspectRatio: capability?.aspectRatio,
			grid: props.store.viewport.showGrid ? [props.store.viewport.gridSize, props.store.viewport.gridSize] : undefined
		});
		props.store.updatePlacement(
			props.store.selectedId,
			clampPlacement(props.store.selectedId, next),
			{ history: false }
		);
	} else if (active.type === 'rotate' && props.store.selectedId) {
		const angle = Math.atan2(point.y - active.center.y, point.x - active.center.x) * 180 / Math.PI;
		props.store.updatePlacement(props.store.selectedId, {
			...active.original,
			rotate: active.original.rotate + angle - active.startAngle
		}, { history: false });
	} else if (active.type === 'marquee') {
		marquee.value = {
			left: Math.min(active.start.x, point.x),
			right: Math.max(active.start.x, point.x),
			top: Math.min(active.start.y, point.y),
			bottom: Math.max(active.start.y, point.y)
		};
	} else if (active.type === 'guide') {
		const key = active.axis === 'x' ? 'guideX' : 'guideY';
		const values = [...props.store.viewport[key]];
		values[active.index] = active.axis === 'x' ? point.x : point.y;
		props.store.updateViewport({ [key]: values });
	}
	event.preventDefault();
};
const handlePointerUp = (event: PointerEvent) => {
	const active = interaction.value;
	if (!active || active.pointerId !== event.pointerId) return;
	const cancelled = event.type === 'pointercancel';
	if (cancelled && active.type === 'move') {
		active.placements.forEach((placement, id) => {
			props.store.updatePlacement(id, placement, { history: false });
		});
	} else if (
		cancelled
		&& (active.type === 'resize' || active.type === 'rotate')
		&& props.store.selectedId
	) {
		props.store.updatePlacement(props.store.selectedId, active.original, { history: false });
	} else if (active.type === 'move') {
		const changes: Array<{ id: string; before: RendererPlacement; after: RendererPlacement }> = [];
		active.placements.forEach((before, id) => {
			const node = props.store.getNode(id) as RendererDraggableNode | undefined;
			if (node?.placement) changes.push({ id, before, after: { ...node.placement } });
		});
		props.store.commitPlacements(changes);
	} else if ((active.type === 'resize' || active.type === 'rotate') && props.store.selectedId) {
		const node = props.store.getNode(props.store.selectedId) as RendererDraggableNode | undefined;
		if (node?.placement) props.store.commitPlacement(props.store.selectedId, active.original, { ...node.placement });
	} else if (active.type === 'marquee' && !cancelled && marquee.value) {
		props.store.applyMarquee(marquee.value);
	}
	interaction.value = undefined;
	marquee.value = undefined;
	guideX.value = [];
	guideY.value = [];
	window.removeEventListener('pointermove', handlePointerMove);
	window.removeEventListener('pointerup', handlePointerUp);
	window.removeEventListener('pointercancel', handlePointerUp);
};

const getScrollWrapper = () => root.value?.querySelector<HTMLElement>('.vc-scroller__wrapper') || null;
const syncViewportSize = () => {
	const wrapper = getScrollWrapper();
	if (!wrapper) return;
	viewportSize.value = { width: wrapper.clientWidth, height: wrapper.clientHeight };
};
const handleNativeScroll = (event: Event) => {
	const target = event.target as HTMLElement;
	props.store.updateViewport({
		scrollLeft: target.scrollLeft,
		scrollTop: target.scrollTop
	});
};
let scrollTarget: HTMLElement | null = null;
const bindScrollerEvents = () => {
	const wrapper = getScrollWrapper();
	if (wrapper === scrollTarget) return;
	scrollTarget?.removeEventListener('scroll', handleNativeScroll);
	scrollTarget = wrapper;
	scrollTarget?.addEventListener('scroll', handleNativeScroll, { passive: true });
};
const fitScale = computed(() => {
	if (!layout.value) return 1;
	const pad = rulerPad.value * 2;
	return Math.min(
		1,
		Math.max(0.1, (viewportSize.value.width - pad) / layout.value.width),
		Math.max(0.1, (viewportSize.value.height - pad) / layout.value.height)
	);
});
let scaleGeneration = 0;
const handleScaleUpdate = async (value: number) => {
	const active = ++scaleGeneration;
	const wrapper = getScrollWrapper();
	const selected = root.value?.querySelector<HTMLElement>(
		'.docs-renderer-selection--draggable.is-primary'
	) || null;
	const anchor = captureZoomAnchor(wrapper, artboard.value || null, selected);
	props.store.updateViewport({ scale: value });
	await nextTick();
	await scroller.value?.refresh();
	await nextTick();
	if (active === scaleGeneration) restoreZoomAnchor(wrapper, anchor);
};
const toggleViewport = (key: 'showGrid' | 'showRuler' | 'showGuides' | 'showThumbnail') => {
	props.store.updateViewport({ [key]: !props.store.viewport[key] });
};
const isWidgetDrag = (event: DragEvent) => (
	Array.from(event.dataTransfer?.types || []).includes(RENDERER_WIDGET_MIME)
);
const handleWidgetDragOver = (event: DragEvent) => {
	if (!isWidgetDrag(event)) return;
	const session = getWidgetDragSession();
	const point = toCanvasPoint(event);
	const width = session?.width || 200;
	const height = session?.height || 120;
	dropGhost.value = {
		x: point.x - width / 2,
		y: point.y - height / 2,
		width,
		height
	};
};
const handleWidgetDragLeave = (event: DragEvent) => {
	const related = event.relatedTarget as Node | null;
	if (related && artboard.value?.contains(related)) return;
	dropGhost.value = undefined;
};
const handleWidgetDrop = (event: DragEvent) => {
	dropGhost.value = undefined;
	const source = event.dataTransfer?.getData(RENDERER_WIDGET_MIME);
	if (!source) return;
	try {
		const payload = JSON.parse(source) as { type: string; presetKey?: string };
		emit('create', { ...payload, index: blocks.value.length, point: toCanvasPoint(event) });
	} catch {
		// 非 Renderer 拖拽数据交给浏览器处理。
	}
};
const THUMBNAIL_W = 192;
const THUMBNAIL_H = 108;
const thumbnailShrink = computed(() => layout.value
	? Math.max(layout.value.width / THUMBNAIL_W, layout.value.height / THUMBNAIL_H)
	: 1);
const thumbnailStyle = computed<CSSProperties>(() => ({
	width: `${THUMBNAIL_W}px`,
	height: `${THUMBNAIL_H}px`
}));
const thumbnailNodeStyle = (placement: RendererPlacement): CSSProperties => ({
	left: `${placement.x / thumbnailShrink.value}px`,
	top: `${placement.y / thumbnailShrink.value}px`,
	width: `${placement.width / thumbnailShrink.value}px`,
	height: `${placement.height / thumbnailShrink.value}px`
});
const thumbnailVisibleStyle = computed<CSSProperties>(() => {
	const shrink = thumbnailShrink.value;
	const current = scale.value || 1;
	const visibleW = Math.min((viewportSize.value.width || 0) / shrink / current, THUMBNAIL_W);
	const visibleH = Math.min((viewportSize.value.height || 0) / shrink / current, THUMBNAIL_H);
	const left = (props.store.viewport.scrollLeft || 0) / shrink / current;
	const top = (props.store.viewport.scrollTop || 0) / shrink / current;
	return {
		width: `${visibleW}px`,
		height: `${visibleH}px`,
		left: `${left + visibleW > THUMBNAIL_W ? THUMBNAIL_W - visibleW : left}px`,
		top: `${top + visibleH > THUMBNAIL_H ? THUMBNAIL_H - visibleH : top}px`
	};
});
const handleThumbnailClick = (event: MouseEvent) => {
	const wrapper = getScrollWrapper();
	const thumbnail = event.currentTarget as HTMLElement;
	if (!wrapper || !layout.value) return;
	const rect = thumbnail.getBoundingClientRect();
	const point = {
		x: (event.clientX - rect.left) * thumbnailShrink.value,
		y: (event.clientY - rect.top) * thumbnailShrink.value
	};
	wrapper.scrollTo({
		left: point.x * scale.value - wrapper.clientWidth / 2,
		top: point.y * scale.value - wrapper.clientHeight / 2,
		behavior: 'smooth'
	});
};
let thumbnailLast = { x: 0, y: 0 };
const handleThumbnailPan = (event: MouseEvent) => {
	const wrapper = getScrollWrapper();
	if (!wrapper) return;
	const shrink = thumbnailShrink.value;
	const x = wrapper.scrollLeft + (event.clientX - thumbnailLast.x) * shrink * scale.value;
	const y = wrapper.scrollTop + (event.clientY - thumbnailLast.y) * shrink * scale.value;
	thumbnailLast = { x: event.clientX, y: event.clientY };
	const maxX = Math.max(0, wrapper.scrollWidth - wrapper.clientWidth);
	const maxY = Math.max(0, wrapper.scrollHeight - wrapper.clientHeight);
	wrapper.scrollLeft = Math.min(maxX, Math.max(0, x));
	wrapper.scrollTop = Math.min(maxY, Math.max(0, y));
};
const stopThumbnailPan = () => {
	window.removeEventListener('mousemove', handleThumbnailPan);
	window.removeEventListener('mouseup', stopThumbnailPan);
};
const handleThumbnailVisibleDown = (event: MouseEvent) => {
	thumbnailLast = { x: event.clientX, y: event.clientY };
	window.addEventListener('mousemove', handleThumbnailPan);
	window.addEventListener('mouseup', stopThumbnailPan);
};
let rightMenu: ReturnType<typeof createRightMenuPortal> | undefined;
let rightMenuLeaf: { destroy?: () => void } | undefined;
const menuItemsFor = (node: RendererDraggableNode | null): RendererRightMenuAction[] => {
	const paste = props.store.hasClipboard ? [RENDERER_RIGHT_MENU.PASTE] as const : [];
	if (!node) return [...paste];
	if (isRendererSelectionModule(node.module.type)) {
		return [
			RENDERER_RIGHT_MENU.TOP,
			RENDERER_RIGHT_MENU.BOTTOM,
			RENDERER_RIGHT_MENU.DELETE,
			RENDERER_RIGHT_MENU.SELECTION,
			RENDERER_RIGHT_MENU.LOCK,
			RENDERER_RIGHT_MENU.COPY,
			...paste
		];
	}
	return [
		RENDERER_RIGHT_MENU.TOP,
		RENDERER_RIGHT_MENU.BOTTOM,
		RENDERER_RIGHT_MENU.UP,
		RENDERER_RIGHT_MENU.DOWN,
		RENDERER_RIGHT_MENU.DELETE,
		RENDERER_RIGHT_MENU.LOCK,
		RENDERER_RIGHT_MENU.COPY,
		...paste
	];
};
const applyRightMenu = (action: RendererRightMenuAction, node: RendererDraggableNode | undefined, event: MouseEvent) => {
	if (action === RENDERER_RIGHT_MENU.PASTE) {
		props.store.pasteClipboard(toCanvasPoint(event));
		return;
	}
	if (!node) return;
	if (action === RENDERER_RIGHT_MENU.COPY) {
		props.store.select(node.id);
		props.store.copySelection();
		return;
	}
	if (action === RENDERER_RIGHT_MENU.DELETE) {
		props.store.removeNode(node.id);
		return;
	}
	if (action === RENDERER_RIGHT_MENU.SELECTION) {
		props.store.ungroupNode(node.id);
		return;
	}
	if (action === RENDERER_RIGHT_MENU.LOCK) {
		props.store.setLocked(node.id, !node.locked);
		return;
	}
	const moved = props.store.applyLayer(node.id, (
		action === RENDERER_RIGHT_MENU.TOP
			? 'top'
			: action === RENDERER_RIGHT_MENU.BOTTOM
				? 'bottom'
				: action === RENDERER_RIGHT_MENU.UP
					? 'up'
					: 'down'
	));
	if (!moved && (action === RENDERER_RIGHT_MENU.TOP || action === RENDERER_RIGHT_MENU.BOTTOM)) {
		Message.warning(action === RENDERER_RIGHT_MENU.TOP
			? t('renderer.canvas.alreadyTop')
			: t('renderer.canvas.alreadyBottom'));
	}
};
const nodeFromContextMenu = (event: MouseEvent, nodeId?: string) => {
	if (nodeId) return resolveFrameNode(nodeId);
	const element = event.target;
	if (!(element instanceof Element)) return undefined;
	const nodeElement = element.closest<HTMLElement>('[data-renderer-node-id]');
	return nodeElement?.dataset.rendererNodeId
		? resolveFrameNode(nodeElement.dataset.rendererNodeId)
		: undefined;
};
const handleContextMenu = async (event: MouseEvent, nodeId?: string) => {
	const node = nodeFromContextMenu(event, nodeId);
	if (node) props.store.select(node.id);
	else if (!props.store.hasClipboard) return;
	const items = menuItemsFor(node || null);
	if (!items.length) return;
	rightMenu ||= createRightMenuPortal();
	try {
		const leaf = rightMenu.popup({
			event,
			items,
			locked: Boolean(node?.locked),
			locale: props.context.locale,
			theme: props.context.theme
		}, {
			el: document.body,
			fragment: true,
			leaveDelay: 0
		});
		rightMenuLeaf = leaf;
		applyRightMenu(await leaf as RendererRightMenuAction, node, event);
	} catch {
		// 点空白关闭菜单不属于编辑错误。
	} finally {
		rightMenuLeaf = undefined;
	}
};
onMounted(() => {
	window.addEventListener('resize', syncViewportSize);
	nextTick(() => {
		bindScrollerEvents();
		syncViewportSize();
		requestAnimationFrame(() => handleScaleUpdate(fitScale.value));
	});
});
watch(
	() => props.store.viewport.showRuler,
	() => nextTick(() => {
		syncViewportSize();
		bindScrollerEvents();
	})
);
onBeforeUnmount(() => {
	capabilityGeneration += 1;
	scaleGeneration += 1;
	rightMenuLeaf?.destroy?.();
	window.removeEventListener('resize', syncViewportSize);
	window.removeEventListener('pointermove', handlePointerMove);
	window.removeEventListener('pointerup', handlePointerUp);
	window.removeEventListener('pointercancel', handlePointerUp);
	stopThumbnailPan();
	scrollTarget?.removeEventListener('scroll', handleNativeScroll);
});
</script>
