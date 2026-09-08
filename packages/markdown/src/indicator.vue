<template>
	<aside
		v-if="markers.length"
		ref="indicatorRoot"
		class="docs-markdown-indicator"
		:class="`is-${resolvedPosition}`"
		:style="rootStyle"
		:aria-label="t('markdown.indicator.label')"
	>
		<div
			ref="viewport"
			class="docs-markdown-indicator__viewport"
			:class="{ 'is-dragging': dragging }"
			role="slider"
			aria-orientation="vertical"
			:aria-valuemin="0"
			:aria-valuemax="100"
			:aria-valuenow="scrollProgress"
			:aria-valuetext="`${scrollProgress}%`"
			:style="viewportStyle"
			@pointermove="handlePointerMove"
			@pointerleave="handlePointerLeave"
			@pointerdown="handlePointerDown"
			@pointerup="handlePointerUp"
			@pointercancel="handlePointerUp"
		>
			<div ref="rail" class="docs-markdown-indicator__rail">
				<div
					class="docs-markdown-indicator__window"
					:style="windowStyle"
				></div>
				<div
					v-for="(marker, index) in markers"
					:key="marker.id"
					class="docs-markdown-indicator__marker"
					:class="{
						'is-heading': marker.isHeading,
						'is-hovered': index === hoverIndex,
						'is-active': index === activeIndex,
						'is-in-view': isMarkerInView(index)
					}"
					:style="getMarkerStyle(index)"
				></div>
			</div>
		</div>

		<div
			v-if="options.preview !== false && !dragging && hoveredMarker"
			class="docs-markdown-indicator__preview"
			:style="previewStyle"
		>
			<div class="docs-markdown-indicator__preview-title">
				{{ hoveredMarker.title }}
			</div>
			<div
				v-if="hoveredMarker.content"
				class="docs-markdown-indicator__preview-content"
			>
				{{ hoveredMarker.content }}
			</div>
		</div>
	</aside>
</template>

<script setup lang="ts">
import {
	computed,
	inject,
	nextTick,
	onBeforeUnmount,
	ref,
	shallowRef,
	watch
} from 'vue';
import { getScroller } from '@deot/helper-dom';
import { useLocale } from '@deot/docs-locale';
import type { ScrollerExposed } from '@deot/vc';
import type { CSSProperties } from 'vue';
import type { MarkdownIndicatorOptions } from './types';
import {
	capIndicatorMaxHeight,
	capStickyAvailableHeight,
	findActiveMinimapIndex,
	getIndicatorInlineOffset,
	getMinimapPointerRatio,
	getMinimapWindow,
	isMinimapMarkerInView
} from './indicator-anchor';
import { collectMarkdownHeadings } from './headings';

type ScrollHost = HTMLElement | Window;
type IndicatorScrollBehavior = 'auto' | 'smooth';

interface ParentScrollerContext extends ScrollerExposed {
	clientHeight?: number;
	off?: (listener: () => void) => void;
	on?: (listener: () => void) => void;
	scrollHeight?: number;
	scrollTop?: number;
	wrapper?: HTMLElement;
}

interface IndicatorMarker {
	content: string;
	element: HTMLElement;
	id: string;
	isHeading: boolean;
	ratio: number;
	title: string;
}

interface ScrollMetrics {
	clientHeight: number;
	scrollHeight: number;
	scrollTop: number;
}

const LAYOUT_SELECTOR = '.docs-layout';
const RAIL_START_SELECTOR = '.docs-layout__rail--start';
const RAIL_END_SELECTOR = '.docs-layout__rail--end';
const VIEWPORT_WIDTH = 40;
/** 与 docs-page-outline 上下 padding 一致，需从轨道高度中扣除。 */
const INDICATOR_CHROME = 40 + 96;

const props = defineProps<{
	options: MarkdownIndicatorOptions;
	target?: HTMLElement;
}>();
const { lang: localeName, t } = useLocale();

const parentScroller = inject<ParentScrollerContext | null>('vc-scroller', null);
const indicatorRoot = ref<HTMLElement>();
const viewport = ref<HTMLElement>();
const rail = ref<HTMLElement>();
const markers = shallowRef<IndicatorMarker[]>([]);
const hoverIndex = ref<number>();
const activeIndex = ref(-1);
const previewTop = ref(0);
const dragging = ref(false);
const cappedHeight = ref(0);
const inlineAnchor = ref<number>();
const windowBox = ref(getMinimapWindow(0, 0, 0));
let observer: MutationObserver | undefined;
let hostResizeObserver: ResizeObserver | undefined;
let scrollHost: ScrollHost | undefined;
let usesParentScroller = false;
let captureTarget: HTMLElement | undefined;
let refreshFrame = 0;
let windowFrame = 0;
let targetGeneration = 0;

const toCssLength = (value: number | string | undefined, fallback: string) => (
	typeof value === 'number' ? `${value}px` : value || fallback
);

const resolvedHeight = computed(() => {
	const cap = cappedHeight.value;
	const configured = props.options.height;
	if (typeof configured === 'number' && Number.isFinite(configured) && configured > 0) {
		return `${cap > 0 ? Math.min(configured, cap) : configured}px`;
	}
	if (typeof configured === 'string' && configured.trim()) return configured;
	if (cap > 0) return `${cap}px`;
	return 'calc(100svh - 60px)';
});

/** 扣除上下 padding 后的轨道高度。小地图轨高等于该值，不再内部滚动。 */
const resolvedTrackHeight = computed(() => {
	const height = resolvedHeight.value;
	if (height.endsWith('px')) {
		const total = Number.parseFloat(height);
		if (Number.isFinite(total)) {
			return `${Math.max(0, total - INDICATOR_CHROME)}px`;
		}
	}
	return `calc(${height} - ${INDICATOR_CHROME}px)`;
});

const rootStyle = computed<CSSProperties>(() => ({
	'--docs-markdown-indicator-height': resolvedHeight.value,
	'--docs-markdown-indicator-track-height': resolvedTrackHeight.value,
	'--docs-markdown-indicator-top': toCssLength(props.options.top, '0px')
}));

const hoveredMarker = computed(() => typeof hoverIndex.value === 'number'
	? markers.value[hoverIndex.value]
	: undefined);

const isMarkerInView = (index: number) => {
	const marker = markers.value[index];
	if (!marker) return false;
	return isMinimapMarkerInView(
		marker.ratio,
		windowBox.value.top,
		windowBox.value.height
	);
};

const resolvedPosition = computed(() => (
	props.options.position === 'right' ? 'right' : 'left'
));

const scrollProgress = computed(() => Math.round(windowBox.value.top * 100));

const viewportStyle = computed<CSSProperties | undefined>(() => {
	if (typeof inlineAnchor.value !== 'number') return;
	return {
		left: `${inlineAnchor.value}px`,
		right: 'auto'
	};
});

const windowStyle = computed<CSSProperties>(() => ({
	height: `${windowBox.value.height * 100}%`,
	top: `${windowBox.value.top * 100}%`
}));

const previewStyle = computed(() => {
	const style: CSSProperties = { top: `${previewTop.value}px` };
	if (typeof inlineAnchor.value !== 'number') return style;
	if (resolvedPosition.value === 'left') {
		style.left = `${inlineAnchor.value + 24}px`;
		style.right = 'auto';
	} else {
		style.left = 'auto';
		style.right = `calc(100% - ${inlineAnchor.value}px)`;
	}
	return style;
});

/**
 * 保留文档块的有效换行，同时折叠每行内部的多余空白。
 * @param element 当前文档块。
 * @returns 适合摘要卡展示的文本。
 */
const getBlockText = (element: HTMLElement) => (
	(element.textContent || '')
		.split(/\n+/)
		.map(line => line.replace(/\s+/g, ' ').trim())
		.filter(Boolean)
		.join('\n')
);

/**
 * 取当前标题到下一标题之间的第一段正文，作为悬停摘要。
 * @param heading 当前标题。
 * @param nextHeading 下一个标题，没有则为空。
 * @returns 摘要文本。
 */
const getPreviewContent = (heading: HTMLElement, nextHeading?: HTMLElement) => {
	let node = heading.nextElementSibling as HTMLElement | null;
	while (node && node !== nextHeading) {
		if (!/^H[1-6]$/.test(node.tagName)) {
			const text = getBlockText(node);
			if (text) return text;
		}
		node = node.nextElementSibling as HTMLElement | null;
	}
	return '';
};

/**
 * 获取 Markdown 使用的原生滚动宿主。
 * Scroller 组件由注入上下文优先处理；仅在没有 Scroller 时才向上查找普通滚动层。
 * @returns 当前文档使用的滚动容器。
 */
const getScrollHost = (): ScrollHost => getScroller(props.target) || window;

/**
 * 读取当前滚动容器的可视高度。
 * @returns 滚动容器 clientHeight，窗口滚动时回退到 innerHeight。
 */
const getScrollHostClientHeight = () => {
	if (usesParentScroller) {
		return parentScroller?.wrapper?.clientHeight
			|| parentScroller?.clientHeight
			|| window.innerHeight;
	}
	if (scrollHost instanceof HTMLElement) return scrollHost.clientHeight;
	return window.innerHeight;
};

/**
 * 读取主滚动的位置与尺寸，供可视窗口和 scrub 共用。
 * @returns 当前滚动偏移、可视高度和内容总高度。
 */
const getScrollMetrics = (): ScrollMetrics => {
	if (usesParentScroller) {
		return {
			clientHeight: parentScroller?.clientHeight
				|| parentScroller?.wrapper?.clientHeight
				|| 0,
			scrollHeight: parentScroller?.scrollHeight
				|| parentScroller?.wrapper?.scrollHeight
				|| 0,
			scrollTop: parentScroller?.scrollTop || 0
		};
	}
	if (scrollHost instanceof HTMLElement) {
		return {
			clientHeight: scrollHost.clientHeight,
			scrollHeight: scrollHost.scrollHeight,
			scrollTop: scrollHost.scrollTop
		};
	}
	return {
		clientHeight: window.innerHeight,
		scrollHeight: document.documentElement.scrollHeight,
		scrollTop: window.scrollY
	};
};

/**
 * 按正文、主滚动可视高度，以及 sticky 父级剩余空间封顶，避免盖住 footer。
 * @returns 指示器可用的最大高度，单位 px。
 */
const getStickyAvailableHeight = () => {
	const root = indicatorRoot.value;
	const parent = root?.parentElement;
	if (!root || !parent) return Number.POSITIVE_INFINITY;
	const parentBox = parent.getBoundingClientRect();
	// jsdom 空盒子无法测量，不额外压缩。
	if (parentBox.height <= 0 && parentBox.bottom === 0) return Number.POSITIVE_INFINITY;
	return parentBox.bottom - root.getBoundingClientRect().top;
};

const updateCappedHeight = () => {
	cappedHeight.value = capStickyAvailableHeight(
		capIndicatorMaxHeight(
			props.target?.offsetHeight || 0,
			getScrollHostClientHeight()
		),
		getStickyAvailableHeight()
	);
};

/** 根据主滚动位置更新小地图可视窗口和当前刻度。 */
const updateWindow = () => {
	windowFrame = 0;
	const metrics = getScrollMetrics();
	windowBox.value = getMinimapWindow(
		metrics.scrollTop,
		metrics.clientHeight,
		metrics.scrollHeight
	);
	activeIndex.value = findActiveMinimapIndex(
		markers.value.map(marker => marker.ratio),
		windowBox.value.top,
		windowBox.value.height
	);
};

/**
 * 有文档壳斜纹轨时，把刻度靠近轨道内侧并留出间距；否则清空偏移，沿用正文边缘定位。
 */
const updateInlineAnchor = () => {
	const root = indicatorRoot.value;
	if (!root) {
		inlineAnchor.value = undefined;
		return;
	}
	const layout = root.closest(LAYOUT_SELECTOR);
	const layoutRail = layout?.querySelector<HTMLElement>(
		resolvedPosition.value === 'left' ? RAIL_START_SELECTOR : RAIL_END_SELECTOR
	);
	const railRect = layoutRail && getComputedStyle(layoutRail).display !== 'none'
		? layoutRail.getBoundingClientRect()
		: undefined;
	inlineAnchor.value = getIndicatorInlineOffset(
		root.getBoundingClientRect(),
		railRect,
		resolvedPosition.value,
		viewport.value?.offsetWidth || VIEWPORT_WIDTH
	);
};

/** 同步高度封顶、斜纹轨锚点、刻度比例和可视窗口。 */
const updateLayout = () => {
	updateCappedHeight();
	updateInlineAnchor();
	if (props.target && markers.value.length) {
		const article = props.target;
		markers.value = markers.value.map(marker => ({
			...marker,
			ratio: getBlockRatio(marker.element, article)
		}));
	}
	updateWindow();
};

/** 跟随滚动容器、正文和指示器自身的尺寸变化。 */
const observeHostSize = () => {
	hostResizeObserver?.disconnect();
	hostResizeObserver = undefined;
	if (typeof ResizeObserver !== 'undefined') {
		hostResizeObserver = new ResizeObserver(updateLayout);
		const host = usesParentScroller
			? parentScroller?.wrapper
			: (scrollHost instanceof HTMLElement ? scrollHost : undefined);
		if (host) hostResizeObserver.observe(host);
		if (props.target) hostResizeObserver.observe(props.target);
		if (viewport.value) hostResizeObserver.observe(viewport.value);
		if (indicatorRoot.value) hostResizeObserver.observe(indicatorRoot.value);
		const parent = indicatorRoot.value?.parentElement;
		if (parent) hostResizeObserver.observe(parent);
		const layout = indicatorRoot.value?.closest(LAYOUT_SELECTOR);
		if (layout instanceof HTMLElement) hostResizeObserver.observe(layout);
		const startRail = layout?.querySelector(RAIL_START_SELECTOR);
		const endRail = layout?.querySelector(RAIL_END_SELECTOR);
		if (startRail instanceof HTMLElement) hostResizeObserver.observe(startRail);
		if (endRail instanceof HTMLElement) hostResizeObserver.observe(endRail);
	}
	updateLayout();
};

/**
 * 计算文档块相对正文顶部的比例，用于铺在固定高度轨道上。
 * @param element 当前文档块。
 * @param article 正文根节点。
 * @returns 0–1 的纵向比例。
 */
const getBlockRatio = (element: HTMLElement, article: HTMLElement) => {
	const articleHeight = article.offsetHeight || article.getBoundingClientRect().height;
	if (articleHeight <= 0) return 0;
	const top = element.getBoundingClientRect().top - article.getBoundingClientRect().top;
	return Math.min(1, Math.max(0, top / articleHeight));
};

/** 从最新渲染的 Markdown DOM 重建小地图刻度。 */
const refreshMarkers = () => {
	refreshFrame = 0;
	const target = props.target;
	if (!target) {
		markers.value = [];
		return;
	}
	const headings = collectMarkdownHeadings(target);
	markers.value = headings.map((heading, index) => ({
		content: getPreviewContent(heading.element, headings[index + 1]?.element),
		element: heading.element,
		id: heading.id || `${index}`,
		isHeading: true,
		ratio: getBlockRatio(heading.element, target),
		title: heading.text
	}));
	hoverIndex.value = undefined;
	updateWindow();
};

/** 合并 MutationObserver 的密集通知，避免 Playground 挂载时重复扫描。 */
const scheduleRefresh = () => {
	if (!refreshFrame) refreshFrame = requestAnimationFrame(refreshMarkers);
};

/** 将连续滚动事件合并到下一帧：更新可视窗口，并按父级底部收缩高度。 */
const handleScroll = () => {
	if (!windowFrame) {
		windowFrame = requestAnimationFrame(() => {
			updateCappedHeight();
			updateWindow();
		});
	}
};

/** 解除旧文档的观察和滚动监听。 */
const cleanupTarget = () => {
	observer?.disconnect();
	observer = undefined;
	hostResizeObserver?.disconnect();
	hostResizeObserver = undefined;
	window.removeEventListener('resize', updateLayout);
	if (usesParentScroller) parentScroller?.off?.(handleScroll);
	else if (scrollHost) scrollHost.removeEventListener('scroll', handleScroll);
	usesParentScroller = false;
	scrollHost = undefined;
};

/** 为当前 Markdown DOM 建立内容观察与滚动同步。 */
const setupTarget = async () => {
	const generation = ++targetGeneration;
	cleanupTarget();
	await nextTick();
	// target 切换或组件卸载后，旧 nextTick 任务不得重新注册 observer 和滚动监听。
	if (generation !== targetGeneration) return;
	if (!props.target) {
		markers.value = [];
		return;
	}
	// Scroller 的滚动事件不一定来自原生 DOM，必须优先使用其注入的订阅接口。
	usesParentScroller = Boolean(parentScroller?.on);
	if (usesParentScroller) {
		parentScroller?.on?.(handleScroll);
		scrollHost = parentScroller?.wrapper || window;
	} else {
		scrollHost = getScrollHost();
		scrollHost.addEventListener('scroll', handleScroll, { passive: true });
	}
	window.addEventListener('resize', updateLayout, { passive: true });
	observer = new MutationObserver(scheduleRefresh);
	observer.observe(props.target, {
		childList: true,
		characterData: true,
		subtree: true
	});
	refreshMarkers();
	observeHostSize();
};

/**
 * 把轨道上的指针位置映射到最近的刻度，只用于悬停预览。
 * @param ratio 轨道 0–1 比例。
 * @returns 最近刻度序号。
 */
const getIndexByRatio = (ratio: number) => {
	if (!markers.value.length) return 0;
	let closestIndex = 0;
	let closestDistance = Number.POSITIVE_INFINITY;
	markers.value.forEach((marker, index) => {
		const distance = Math.abs(marker.ratio - ratio);
		if (distance < closestDistance) {
			closestIndex = index;
			closestDistance = distance;
		}
	});
	return closestIndex;
};

/**
 * 读取指针相对轨道的比例。
 * @param event 当前指针事件。
 * @returns 0–1 比例。
 */
const getPointerRatio = (event: PointerEvent) => {
	const bounds = rail.value?.getBoundingClientRect();
	if (!bounds) return 0;
	return getMinimapPointerRatio(event.clientY, bounds.top, bounds.height);
};

/**
 * 让摘要跟随指针，同时限制在指示器可视高度内。
 * @param clientY 指针的视口纵坐标。
 */
const updatePreviewPosition = (clientY: number) => {
	const rootBounds = indicatorRoot.value?.getBoundingClientRect();
	const viewportBounds = viewport.value?.getBoundingClientRect();
	if (!rootBounds || !viewportBounds) return;
	previewTop.value = Math.min(
		viewportBounds.height - 48,
		Math.max(48, clientY - rootBounds.top)
	);
};

/**
 * 按轨道比例滚动正文，不改 hash。
 * @param ratio 轨道 0–1 比例。
 * @param behavior 滚动行为。
 */
const scrollToRatio = (ratio: number, behavior: IndicatorScrollBehavior) => {
	const metrics = getScrollMetrics();
	const maxScroll = Math.max(0, metrics.scrollHeight - metrics.clientHeight);
	const nextTop = ratio * maxScroll;
	if (usesParentScroller && parentScroller?.setScrollTop) {
		parentScroller.setScrollTop(nextTop);
		return;
	}
	if (scrollHost instanceof HTMLElement) {
		scrollHost.scrollTo({ behavior, top: nextTop });
		return;
	}
	window.scrollTo({ behavior, top: nextTop });
};

/**
 * 指针移动时展示摘要；按下拖动时按比例 scrub 正文。
 * @param event 当前指针事件。
 */
const handlePointerMove = (event: PointerEvent) => {
	const ratio = getPointerRatio(event);
	hoverIndex.value = getIndexByRatio(ratio);
	updatePreviewPosition(event.clientY);
	if (dragging.value) scrollToRatio(ratio, 'auto');
};

/**
 * 开始 scrub：点击即按比例定位，可拖动时再捕获指针。
 * @param event 当前指针事件。
 */
const handlePointerDown = (event: PointerEvent) => {
	if (event.button !== 0) return;
	const ratio = getPointerRatio(event);
	hoverIndex.value = getIndexByRatio(ratio);
	updatePreviewPosition(event.clientY);
	scrollToRatio(ratio, 'auto');
	dragging.value = props.options.draggable !== false;
	if (dragging.value) {
		captureTarget = event.currentTarget as HTMLElement;
		captureTarget.setPointerCapture?.(event.pointerId);
		event.preventDefault();
	}
};

/**
 * 结束拖动并释放指针捕获。
 * @param event 当前指针事件。
 */
const handlePointerUp = (event: PointerEvent) => {
	dragging.value = false;
	if (captureTarget?.hasPointerCapture?.(event.pointerId)) {
		captureTarget.releasePointerCapture(event.pointerId);
	}
	captureTarget = undefined;
};

/** 离开指示器时隐藏摘要；拖动期间由指针捕获继续处理。 */
const handlePointerLeave = () => {
	if (!dragging.value) hoverIndex.value = undefined;
};

/**
 * 计算刻度在轨道上的位置、标题/正文宽度，以及靠近指针时的鱼眼展开。
 * @param index 当前刻度序号。
 * @returns 刻度的定位和宽度样式。
 */
const getMarkerStyle = (index: number) => {
	const marker = markers.value[index];
	const distance = typeof hoverIndex.value === 'number'
		? Math.abs(index - hoverIndex.value)
		: Number.POSITIVE_INFINITY;
	const base = marker?.isHeading ? 10 : 6;
	const expandedWidths = [base + 6, base + 4, base + 2, base + 1];
	const hoverWidth = distance <= 3 ? expandedWidths[distance] : base;
	const activeWidth = index === activeIndex.value ? base + 8 : base;
	return {
		top: `${(marker?.ratio || 0) * 100}%`,
		width: `${Math.max(hoverWidth, activeWidth)}px`
	};
};

watch([() => props.target, localeName], setupTarget, { immediate: true, flush: 'post' });
watch(indicatorRoot, (root) => {
	if (root) observeHostSize();
}, { flush: 'post' });
watch([() => props.options.height, () => props.options.position, viewport], () => {
	if (viewport.value && hostResizeObserver) hostResizeObserver.observe(viewport.value);
	updateLayout();
});

onBeforeUnmount(() => {
	targetGeneration++;
	cleanupTarget();
	if (refreshFrame) cancelAnimationFrame(refreshFrame);
	if (windowFrame) cancelAnimationFrame(windowFrame);
});
</script>

<style lang="scss">
@use '@deot/style/src/mixins/bem' as *;

@include block(docs-markdown-indicator) {
	position: sticky;
	top: var(--docs-markdown-indicator-top, 0);
	z-index: 4;
	height: 0;
	pointer-events: none;

	@include element(rail) {
		position: relative;
		width: 100%;
		height: 100%;
	}

	@include element(viewport) {
		position: absolute;
		top: 0;
		width: 40px;
		height: var(--docs-markdown-indicator-height);
		overflow: hidden;
		pointer-events: auto;
		cursor: ns-resize;
		box-sizing: border-box;
		padding-block: 40px 96px;
		touch-action: none;

		&:hover .docs-markdown-indicator__window,
		&.is-dragging .docs-markdown-indicator__window {
			opacity: 0.16;
		}
	}

	@include element(window) {
		position: absolute;
		left: 0;
		width: 20px;
		min-height: 12px;
		pointer-events: none;
		background: var(--docs-foreground-color-light, var(--vc-color-dark-lighter, #515a6e));
		border-radius: 6px;
		opacity: 0;
		transition: opacity 120ms ease;
	}

	@include element(marker) {
		position: absolute;
		height: 2px;
		pointer-events: none;
		background: var(--docs-border-color, var(--vc-color-light-deepest, #c5c8ce));
		border-radius: 2px;
		opacity: 0.72;
		transform: translateY(-50%);
		transition: width 120ms ease, background-color 120ms ease, opacity 120ms ease;

		&.is-heading {
			height: 3px;
			opacity: 0.9;
		}

		&.is-in-view {
			background: var(--docs-foreground-color-mute, var(--vc-color-dark-extralight, #808695));
			opacity: 0.92;
		}

		&.is-active,
		&.is-hovered {
			background: var(--docs-foreground-color-light, var(--vc-color-dark-lighter, #515a6e));
			opacity: 1;
		}
	}

	@include element(preview) {
		position: absolute;
		width: 220px;
		max-width: min(36vw, 260px);
		padding: 8px 10px;
		font-size: 12px;
		line-height: 1.5;
		color: var(--docs-foreground-color, var(--vc-foreground-color, #17233d));
		pointer-events: none;
		background: var(--docs-background-color, var(--vc-background-color-light, #fff));
		border: 1px solid var(--docs-border-color, var(--vc-color-light-deeper, #dcdee2));
		border-radius: 8px;
		transform: translateY(-50%);
		box-shadow: 0 2px 8px var(--docs-shadow-color, rgb(0 0 0 / 10%));
		overflow-wrap: anywhere;
	}

	@include element(preview-title) {
		overflow: hidden;
		font-weight: 600;
		color: var(--docs-foreground-color, var(--vc-foreground-color, #17233d));
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	@include element(preview-content) {
		display: -webkit-box;
		margin-top: 4px;
		overflow: hidden;
		color: var(--docs-foreground-color-mute, var(--vc-color-dark-extralight, #808695));
		white-space: pre-line;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 4;
	}

	&.is-left {
		.docs-markdown-indicator__viewport {
			right: calc(100% - 20px);
		}

		.docs-markdown-indicator__marker {
			margin-inline: 0 auto;
		}

		.docs-markdown-indicator__preview {
			left: 24px;
		}
	}

	&.is-right {
		.docs-markdown-indicator__viewport {
			left: calc(100% - 20px);
		}

		.docs-markdown-indicator__window {
			right: 0;
			left: auto;
		}

		.docs-markdown-indicator__marker {
			margin-inline: auto 0;
		}

		.docs-markdown-indicator__preview {
			right: 24px;
		}
	}
}

@media (prefers-reduced-motion: reduce) {
	.docs-markdown-indicator__marker,
	.docs-markdown-indicator__window {
		transition: none;
	}
}
</style>
