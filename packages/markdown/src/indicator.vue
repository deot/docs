<template>
	<aside
		v-if="markers.length > 1"
		ref="indicatorRoot"
		class="docs-markdown-indicator"
		:class="`is-${options.position || 'right'}`"
		:style="rootStyle"
		:aria-label="t('markdown.indicator.label')"
	>
		<div
			ref="viewport"
			class="docs-markdown-indicator__viewport"
			@pointermove="handlePointerMove"
			@pointerleave="handlePointerLeave"
			@pointerdown="handlePointerDown"
			@pointerup="handlePointerUp"
			@pointercancel="handlePointerUp"
		>
			<Scroller
				ref="indicatorScroller"
				class="docs-markdown-indicator__scroller"
				:auto-resize="true"
				:native="false"
				:show-bar="true"
				height="100%"
				wrapper-style="overflow-x: hidden;"
			>
				<div ref="rail" class="docs-markdown-indicator__rail">
					<div class="docs-markdown-indicator__list">
						<button
							v-for="(marker, index) in markers"
							:key="marker.id"
							type="button"
							class="docs-markdown-indicator__marker"
							:class="{
								'is-active': index === activeIndex,
								'is-hovered': index === hoverIndex
							}"
							:style="getMarkerStyle(index)"
							:aria-label="marker.ariaLabel"
							@click="handleClick(index)"
						></button>
					</div>
				</div>
			</Scroller>
		</div>

		<div
			v-if="options.preview !== false && hoveredMarker"
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
import { Scroller } from '@deot/vc';
import { useLocale } from '@deot/docs-locale';
import type { ScrollerExposed } from '@deot/vc';
import type { CSSProperties } from 'vue';
import type { MarkdownIndicatorOptions } from './types';

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
	ariaLabel: string;
	content: string;
	element: HTMLElement;
	id: string;
	title: string;
}

const BLOCK_SELECTOR = [
	'h1',
	'h2',
	'h3',
	'h4',
	'h5',
	'h6',
	'p',
	'li',
	'pre',
	'blockquote',
	'table',
	'.tip',
	'.warning',
	'.docs-markdown-code-preview',
	'[data-playground]'
].join(',');
const CONTAINER_SELECTOR = [
	'li',
	'blockquote',
	'table',
	'.tip',
	'.warning',
	'.docs-markdown-code-preview',
	'[data-playground]'
].join(',');
const MAX_ARIA_LABEL_LENGTH = 180;

const props = defineProps<{
	options: MarkdownIndicatorOptions;
	target?: HTMLElement;
}>();
const { lang: localeName, t } = useLocale();

const parentScroller = inject<ParentScrollerContext | null>('vc-scroller', null);
const indicatorRoot = ref<HTMLElement>();
const viewport = ref<HTMLElement>();
const rail = ref<HTMLElement>();
const indicatorScroller = ref<ScrollerExposed>();
const markers = shallowRef<IndicatorMarker[]>([]);
const activeIndex = ref(0);
const hoverIndex = ref<number>();
const previewTop = ref(0);
const dragging = ref(false);
let observer: MutationObserver | undefined;
let scrollHost: ScrollHost | undefined;
let usesParentScroller = false;
let captureTarget: HTMLElement | undefined;
let refreshFrame = 0;
let activeFrame = 0;
let targetGeneration = 0;

const toCssLength = (value: number | string | undefined, fallback: string) => (
	typeof value === 'number' ? `${value}px` : value || fallback
);

const rootStyle = computed<CSSProperties>(() => ({
	'--docs-markdown-indicator-height': toCssLength(props.options.height, 'min(72vh, 600px)'),
	'--docs-markdown-indicator-top': toCssLength(props.options.top, '16px')
}));

const hoveredMarker = computed(() => typeof hoverIndex.value === 'number'
	? markers.value[hoverIndex.value]
	: undefined);

const previewStyle = computed(() => ({ top: `${previewTop.value}px` }));

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
 * 清理标题锚点产生的井号，并提供无标题内容的兜底文本。
 * @param element 当前标题节点。
 * @returns 单行章节标题。
 */
const getHeadingTitle = (element: HTMLElement) => (
	getBlockText(element).replace(/^#\s*/, '').replace(/\s+/g, ' ').trim() || t('markdown.indicator.untitled')
);

/**
 * 为无障碍名称限制长度，避免长代码块生成过大的属性值。
 * @param title 当前章节标题。
 * @param content 当前文档块内容。
 * @returns 标题和内容组成的简短名称。
 */
const getAriaLabel = (title: string, content: string) => {
	const value = content ? `${title}: ${content.replace(/\s+/g, ' ')}` : title;
	if (value.length <= MAX_ARIA_LABEL_LENGTH) return value;
	return `${value.slice(0, MAX_ARIA_LABEL_LENGTH).trim()}…`;
};

/**
 * 判断候选节点是否已经包含在另一个可独立定位的文档块内。
 * @param element 当前候选节点。
 * @returns 是否应由外层文档块统一表示。
 */
const isNestedBlock = (element: HTMLElement) => {
	const container = element.closest<HTMLElement>(CONTAINER_SELECTOR);
	return Boolean(container && container !== element);
};

/**
 * 获取 Markdown 使用的原生滚动宿主。
 * Scroller 组件由注入上下文优先处理；仅在没有 Scroller 时才向上查找普通滚动层。
 * @returns 当前文档使用的滚动容器。
 */
const getScrollHost = (): ScrollHost => getScroller(props.target) || window;

/**
 * 获取当前滚动宿主的可视区域顶部。
 * @returns 相对于视口的顶部坐标。
 */
const getScrollHostTop = () => {
	if (usesParentScroller) {
		return parentScroller?.wrapper?.getBoundingClientRect().top || 0;
	}
	return scrollHost instanceof HTMLElement
		? scrollHost.getBoundingClientRect().top
		: 0;
};

/**
 * 判断文档是否已经到达滚动末尾。
 * 末屏通常无法把最后一个内容块推到顶部阈值，因此需要显式选中最后一条刻度。
 * @returns 是否位于可滚动内容末尾。
 */
const isScrollEnd = () => {
	let clientHeight: number;
	let scrollHeight: number;
	let scrollTop: number;
	if (usesParentScroller) {
		clientHeight = parentScroller?.clientHeight || 0;
		scrollHeight = parentScroller?.scrollHeight || 0;
		scrollTop = parentScroller?.scrollTop || 0;
	} else if (scrollHost instanceof HTMLElement) {
		clientHeight = scrollHost.clientHeight;
		scrollHeight = scrollHost.scrollHeight;
		scrollTop = scrollHost.scrollTop;
	} else {
		clientHeight = window.innerHeight;
		scrollHeight = document.documentElement.scrollHeight;
		scrollTop = window.scrollY;
	}
	return scrollHeight > clientHeight
		&& scrollTop + clientHeight >= scrollHeight - 1;
};

/**
 * 保证当前阅读刻度处于内部 Scroller 的可视范围内。
 * @param index 当前阅读刻度序号。
 */
const followActiveMarker = async (index: number) => {
	await nextTick();
	const marker = rail.value?.querySelectorAll<HTMLElement>('.docs-markdown-indicator__marker')[index];
	const wrapper = viewport.value?.querySelector<HTMLElement>('.vc-scroller__wrapper');
	if (!marker || !wrapper) return;
	const markerRect = marker.getBoundingClientRect();
	const wrapperRect = wrapper.getBoundingClientRect();
	const padding = 16;
	if (markerRect.top >= wrapperRect.top + padding
		&& markerRect.bottom <= wrapperRect.bottom - padding) return;
	const markerCenter = markerRect.top + markerRect.height / 2;
	const wrapperCenter = wrapperRect.top + wrapperRect.height / 2;
	indicatorScroller.value?.setScrollTop(
		Math.max(0, wrapper.scrollTop + markerCenter - wrapperCenter)
	);
};

/** 根据滚动位置更新当前阅读块，不触发 Markdown 内容重渲染。 */
const updateActiveIndex = () => {
	activeFrame = 0;
	if (!markers.value.length) return;
	const threshold = getScrollHostTop() + 80;
	let nextIndex = markers.value.length - 1;
	if (!isScrollEnd()) {
		nextIndex = 0;
		for (let index = 0; index < markers.value.length; index++) {
			if (markers.value[index].element.getBoundingClientRect().top > threshold) break;
			nextIndex = index;
		}
	}
	if (activeIndex.value !== nextIndex) {
		activeIndex.value = nextIndex;
		void followActiveMarker(nextIndex);
	}
};

/** 将连续滚动事件合并到浏览器的下一绘制帧。 */
const handleScroll = () => {
	if (!activeFrame) activeFrame = requestAnimationFrame(updateActiveIndex);
};

/** 从最新渲染的 Markdown DOM 重建文档刻度。 */
const refreshMarkers = () => {
	refreshFrame = 0;
	const target = props.target;
	if (!target) {
		markers.value = [];
		return;
	}
	const elements = [...target.querySelectorAll<HTMLElement>(BLOCK_SELECTOR)]
		.filter(element => !isNestedBlock(element));
	let sectionTitle = t('markdown.indicator.document');
	markers.value = elements.map((element, index) => {
		const isHeading = /^H[1-6]$/.test(element.tagName);
		if (isHeading) sectionTitle = getHeadingTitle(element);
		const nextElement = elements[index + 1];
		const content = isHeading
			&& nextElement
			&& !/^H[1-6]$/.test(nextElement.tagName)
			? getBlockText(nextElement)
			: (isHeading ? '' : getBlockText(element));
		return {
			ariaLabel: getAriaLabel(sectionTitle, content),
			content,
			element,
			id: `${index}-${element.id || element.tagName}`,
			title: sectionTitle
		};
	});
	hoverIndex.value = undefined;
	updateActiveIndex();
	void followActiveMarker(activeIndex.value);
};

/** 合并 MutationObserver 的密集通知，避免 Playground 挂载时重复扫描。 */
const scheduleRefresh = () => {
	if (!refreshFrame) refreshFrame = requestAnimationFrame(refreshMarkers);
};

/** 解除旧文档的观察和滚动监听。 */
const cleanupTarget = () => {
	observer?.disconnect();
	observer = undefined;
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
	observer = new MutationObserver(scheduleRefresh);
	observer.observe(props.target, {
		childList: true,
		characterData: true,
		subtree: true
	});
	refreshMarkers();
};

/**
 * 将指示器内的纵坐标转换为最近的文档块序号。
 * @param event 当前指针事件。
 * @returns 距离指针最近的文档块序号。
 */
const getIndexByPointer = (event: PointerEvent) => {
	if (!rail.value || !markers.value.length) return 0;
	const elements = [...rail.value.querySelectorAll<HTMLElement>('.docs-markdown-indicator__marker')];
	let closestIndex = 0;
	let closestDistance = Number.POSITIVE_INFINITY;
	elements.forEach((element, index) => {
		const bounds = element.getBoundingClientRect();
		const distance = Math.abs(event.clientY - (bounds.top + bounds.height / 2));
		if (distance < closestDistance) {
			closestIndex = index;
			closestDistance = distance;
		}
	});
	return closestIndex;
};

/**
 * 让摘要跟随当前刻度，同时限制在指示器可视高度内。
 * @param index 当前刻度序号。
 * @param clientY 指针的视口纵坐标。
 */
const updatePreviewPosition = (index: number, clientY?: number) => {
	const rootBounds = indicatorRoot.value?.getBoundingClientRect();
	const viewportBounds = viewport.value?.getBoundingClientRect();
	const marker = rail.value?.querySelectorAll<HTMLElement>('.docs-markdown-indicator__marker')[index];
	if (!rootBounds || !viewportBounds || !marker) return;
	const markerBounds = marker.getBoundingClientRect();
	const targetY = clientY ?? markerBounds.top + markerBounds.height / 2;
	const relativeY = targetY - rootBounds.top;
	previewTop.value = Math.min(
		viewportBounds.height - 48,
		Math.max(48, relativeY)
	);
};

/**
 * 滚动到指定文档块；拖动使用即时定位，点击使用平滑定位。
 * @param index 目标文档块序号。
 * @param behavior 滚动行为。
 */
const scrollToMarker = (index: number, behavior: IndicatorScrollBehavior) => {
	const marker = markers.value[index];
	if (!marker || !scrollHost) return;
	const markerTop = marker.element.getBoundingClientRect().top;
	if (usesParentScroller && parentScroller?.setScrollTop) {
		parentScroller.setScrollTop(
			(parentScroller.scrollTop || 0) + markerTop - getScrollHostTop() - 24
		);
	} else if (scrollHost instanceof HTMLElement) {
		const hostTop = scrollHost.getBoundingClientRect().top;
		scrollHost.scrollTo({
			top: scrollHost.scrollTop + markerTop - hostTop - 24,
			behavior
		});
	} else {
		window.scrollTo({
			top: window.scrollY + markerTop - 24,
			behavior
		});
	}
	activeIndex.value = index;
	void followActiveMarker(index);
};

/**
 * 指针移动时展示摘要；按下拖动时同步快速浏览文档。
 * @param event 当前指针事件。
 */
const handlePointerMove = (event: PointerEvent) => {
	const index = getIndexByPointer(event);
	hoverIndex.value = index;
	updatePreviewPosition(index, event.clientY);
	if (dragging.value) scrollToMarker(index, 'auto');
};

/**
 * 开始拖动指示器并定位到按下位置。
 * @param event 当前指针事件。
 */
const handlePointerDown = (event: PointerEvent) => {
	if (event.button !== 0) return;
	dragging.value = props.options.draggable !== false;
	const index = getIndexByPointer(event);
	hoverIndex.value = index;
	updatePreviewPosition(index, event.clientY);
	if (dragging.value) {
		captureTarget = event.currentTarget as HTMLElement;
		captureTarget.setPointerCapture?.(event.pointerId);
		scrollToMarker(index, 'auto');
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
 * 点击单条刻度时平滑定位到对应文档块。
 * @param index 目标文档块序号。
 */
const handleClick = (index: number) => {
	hoverIndex.value = index;
	updatePreviewPosition(index);
	scrollToMarker(index, 'smooth');
};

/**
 * 计算刻度位置、基础宽度和靠近指针时的鱼眼展开宽度。
 * @param index 当前刻度序号。
 * @returns 刻度的定位和宽度样式。
 */
const getMarkerStyle = (index: number) => {
	const distance = typeof hoverIndex.value === 'number'
		? Math.abs(index - hoverIndex.value)
		: Number.POSITIVE_INFINITY;
	const expandedWidths = [28, 22, 16, 10];
	return {
		width: `${distance <= 3 ? expandedWidths[distance] : 8}px`
	};
};

watch([() => props.target, localeName], setupTarget, { immediate: true });

onBeforeUnmount(() => {
	targetGeneration++;
	cleanupTarget();
	if (refreshFrame) cancelAnimationFrame(refreshFrame);
	if (activeFrame) cancelAnimationFrame(activeFrame);
});
</script>

<style lang="scss">
@use '@deot/style/src/mixins/bem' as *;

@include block(docs-markdown-indicator) {
	position: sticky;
	top: var(--docs-markdown-indicator-top);
	z-index: 4;
	height: 0;
	pointer-events: none;

	@include element(rail) {
		display: flex;
		width: 100%;
		min-height: var(--docs-markdown-indicator-height);
	}

	@include element(viewport) {
		position: absolute;
		top: 0;
		width: 40px;
		height: var(--docs-markdown-indicator-height);
		pointer-events: auto;
		cursor: ns-resize;
		touch-action: none;
	}

	@include element(scroller) {
		width: 100%;
		height: 100%;
	}

	@include element(list) {
		display: flex;
		flex: 0 0 auto;
		flex-direction: column;
		gap: 6px;
		width: 100%;
		margin-block: auto;
	}

	@include element(marker) {
		flex: 0 0 2px;
		height: 2px;
		padding: 0;
		background: var(--docs-border-color, var(--vc-color-light-deepest, #c5c8ce));
		border: 0;
		border-radius: 2px;
		outline: 0;
		opacity: 0.72;
		transition: width 120ms ease, background-color 120ms ease, opacity 120ms ease;

		&.is-active,
		&.is-hovered {
			background: var(--docs-foreground-color-light, var(--vc-color-dark-lighter, #515a6e));
			opacity: 1;
		}
	}

	@include element(preview) {
		position: absolute;
		width: 280px;
		max-width: min(40vw, 320px);
		padding: 10px 12px;
		font-size: 12px;
		line-height: 1.6;
		color: var(--docs-foreground-color, var(--vc-foreground-color, #17233d));
		pointer-events: none;
		background: var(--docs-background-color, var(--vc-background-color-light, #fff));
		border: 1px solid var(--docs-border-color, var(--vc-color-light-deeper, #dcdee2));
		border-radius: 6px;
		transform: translateY(-50%);
		box-shadow: 0 4px 12px var(--docs-shadow-color, rgb(0 0 0 / 14%));
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
			align-self: flex-start;
		}

		.docs-markdown-indicator__preview {
			left: 24px;
		}
	}

	&.is-right {
		.docs-markdown-indicator__viewport {
			left: calc(100% - 20px);
		}

		.docs-markdown-indicator__marker {
			align-self: flex-end;
		}

		.docs-markdown-indicator__preview {
			right: 24px;
		}
	}
}

@media (prefers-reduced-motion: reduce) {
	.docs-markdown-indicator__marker {
		transition: none;
	}
}
</style>
