<template>
	<aside
		v-if="headings.length"
		ref="outlineRoot"
		class="docs-page-outline"
		:style="rootStyle"
		:aria-label="t('client.page.outline')"
	>
		<p class="docs-page-outline__title">{{ t('client.page.outline') }}</p>
		<Scroller
			ref="outlineScroller"
			class="docs-page-outline__scroller"
			:auto-resize="true"
			:native="false"
			:show-bar="outlineOverflows"
			:height="scrollerHeight"
			wrapper-style="overflow-x: hidden;"
		>
			<OutlineLinks
				:items="tree"
				:active-id="activeId"
				@select="handleSelect"
			/>
		</Scroller>
	</aside>
</template>
<script setup lang="ts">
import {
	computed,
	defineComponent,
	h,
	inject,
	nextTick,
	onBeforeUnmount,
	ref,
	shallowRef,
	watch,
	type CSSProperties,
	type PropType
} from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { getScroller } from '@deot/helper-dom';
import { Scroller } from '@deot/vc';
import { useLocale } from '@deot/docs-locale';
import type { ScrollerExposed } from '@deot/vc';
import {
	buildOutlineTree,
	capOutlineMaxHeight,
	collectOutlineHeadings,
	findActiveOutlineId,
	matchOutlineHeadingId,
	markdownArticleKey,
	OUTLINE_CHROME,
	resolveOutlineScrollerHeight,
	type OutlineHeading,
	type OutlineItem
} from '../../utils/outline';

defineOptions({ name: 'DocsPageOutline' });

interface ParentScrollerContext extends ScrollerExposed {
	clientHeight?: number;
	off?: (listener: () => void) => void;
	on?: (listener: () => void) => void;
	scrollHeight?: number;
	scrollTop?: number;
	wrapper?: HTMLElement;
}

type ScrollHost = HTMLElement | Window;

const SCROLL_THRESHOLD = 80;

const OutlineLinks = defineComponent({
	name: 'DocsPageOutlineLinks',
	props: {
		activeId: { type: String, default: '' },
		depth: { type: Number, default: 0 },
		items: { type: Array as PropType<OutlineItem[]>, required: true },
		nested: Boolean
	},
	emits: ['select'],
	setup(props, { emit }) {
		return () => h(
			'ul',
			{
				class: [
					'docs-page-outline__list',
					props.nested ? 'docs-page-outline__list--nested' : ''
				]
			},
			props.items.map(item => h('li', {
				key: item.id,
				class: 'docs-page-outline__item'
			}, [
				h('a', {
					'aria-current': props.activeId === item.id ? 'location' : undefined,
					'class': [
						'docs-page-outline__link',
						props.nested ? 'docs-page-outline__link--nested' : ''
					],
					'href': `#${item.id}`,
					'onClick': (event: MouseEvent) => emit('select', event, item.id),
					'style': { paddingLeft: `${16 + props.depth * 14}px` }
				}, item.text),
				item.children.length
					? h(OutlineLinks, {
							activeId: props.activeId,
							depth: props.depth + 1,
							items: item.children,
							nested: true,
							onSelect: (event: MouseEvent, id: string) => emit('select', event, id)
						})
					: null
			]))
		);
	}
});

const props = defineProps<{ target?: HTMLElement }>();
const route = useRoute();
const router = useRouter();
const { t } = useLocale();
const parentScroller = inject<ParentScrollerContext | null>('vc-scroller', null);
const injectedArticle = inject(markdownArticleKey, ref<HTMLElement>());
const outlineRoot = ref<HTMLElement>();
const outlineScroller = ref<ScrollerExposed>();
const headings = shallowRef<OutlineHeading[]>([]);
const activeId = ref('');
const maxHeight = ref(0);
const listSize = ref(0);
let observer: MutationObserver | undefined;
let sizeObserver: ResizeObserver | undefined;
let scrollHost: ScrollHost | undefined;
let usesParentScroller = false;
let refreshFrame = 0;
let activeFrame = 0;
let targetGeneration = 0;

const tree = computed(() => buildOutlineTree(headings.value));
const outlineTrackHeight = computed(() => Math.max(0, maxHeight.value - OUTLINE_CHROME));
const outlineOverflows = computed(() => listSize.value > outlineTrackHeight.value);
const scrollerHeight = computed(() => (
	`${resolveOutlineScrollerHeight(maxHeight.value, listSize.value)}px`
));
const rootStyle = computed<CSSProperties>(() => ({
	'--docs-page-outline-max-height': maxHeight.value
		? `${maxHeight.value}px`
		: 'calc(100svh - 60px)'
}));

const source = computed(() => props.target || injectedArticle.value);

const getScrollHost = (): ScrollHost => getScroller(source.value) || window;

const getScrollHostTop = () => {
	if (usesParentScroller) {
		return parentScroller?.wrapper?.getBoundingClientRect().top || 0;
	}
	return scrollHost instanceof HTMLElement
		? scrollHost.getBoundingClientRect().top
		: 0;
};

const getScrollHostClientHeight = () => {
	if (usesParentScroller) {
		return parentScroller?.wrapper?.clientHeight
			|| parentScroller?.clientHeight
			|| 0;
	}
	if (scrollHost instanceof HTMLElement) return scrollHost.clientHeight;
	return window.innerHeight;
};

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

const updateMaxHeight = () => {
	maxHeight.value = capOutlineMaxHeight(
		source.value?.offsetHeight || 0,
		getScrollHostClientHeight()
	);
};

const followActiveLink = async () => {
	await nextTick();
	const current = outlineRoot.value?.querySelector<HTMLElement>('a[aria-current="location"]');
	const wrapper = outlineRoot.value?.querySelector<HTMLElement>('.vc-scroller__wrapper');
	if (!current || !wrapper) return;
	const currentRect = current.getBoundingClientRect();
	const wrapperRect = wrapper.getBoundingClientRect();
	if (
		currentRect.top >= wrapperRect.top
		&& currentRect.bottom <= wrapperRect.bottom
	) return;
	outlineScroller.value?.setScrollTop?.(
		Math.max(0, wrapper.scrollTop + currentRect.top - wrapperRect.top)
	);
};

const updateActiveId = () => {
	activeFrame = 0;
	if (!headings.value.length) {
		activeId.value = '';
		return;
	}
	const nextId = findActiveOutlineId(headings.value, {
		isScrollEnd: isScrollEnd(),
		threshold: getScrollHostTop() + SCROLL_THRESHOLD
	});
	activeId.value = nextId || headings.value[0]!.id;
	void followActiveLink();
};

const handleScroll = () => {
	if (!activeFrame) activeFrame = requestAnimationFrame(updateActiveId);
};

const refreshHeadings = () => {
	refreshFrame = 0;
	headings.value = collectOutlineHeadings(source.value);
	updateMaxHeight();
	updateActiveId();
	void nextTick(() => {
		const list = outlineRoot.value?.querySelector('.docs-page-outline__list');
		listSize.value = list?.scrollHeight || 0;
	});
};

const scheduleRefresh = () => {
	if (!refreshFrame) refreshFrame = requestAnimationFrame(refreshHeadings);
};

const cleanupTarget = () => {
	observer?.disconnect();
	observer = undefined;
	sizeObserver?.disconnect();
	sizeObserver = undefined;
	window.removeEventListener('resize', updateMaxHeight);
	if (usesParentScroller) parentScroller?.off?.(handleScroll);
	else if (scrollHost) scrollHost.removeEventListener('scroll', handleScroll);
	usesParentScroller = false;
	scrollHost = undefined;
};

const setupTarget = async () => {
	const generation = ++targetGeneration;
	cleanupTarget();
	await nextTick();
	if (generation !== targetGeneration) return;
	if (!source.value) {
		headings.value = [];
		activeId.value = '';
		return;
	}
	refreshHeadings();
	try {
		usesParentScroller = Boolean(parentScroller?.on);
		if (usesParentScroller) {
			parentScroller?.on?.(handleScroll);
			scrollHost = parentScroller?.wrapper || window;
		} else {
			scrollHost = getScrollHost();
			scrollHost.addEventListener('scroll', handleScroll, { passive: true });
		}
	} catch {
		usesParentScroller = false;
		scrollHost = window;
		window.addEventListener('scroll', handleScroll, { passive: true });
	}
	window.addEventListener('resize', updateMaxHeight, { passive: true });
	observer = new MutationObserver(scheduleRefresh);
	observer.observe(source.value, {
		childList: true,
		characterData: true,
		subtree: true
	});
	if (typeof ResizeObserver !== 'undefined') {
		sizeObserver = new ResizeObserver(updateMaxHeight);
		sizeObserver.observe(source.value);
		if (usesParentScroller && parentScroller?.wrapper) {
			sizeObserver.observe(parentScroller.wrapper);
		} else if (scrollHost instanceof HTMLElement) {
			sizeObserver.observe(scrollHost);
		}
	}
	refreshHeadings();
};

const scrollHeadingIntoView = (id: string) => {
	const target = headings.value.find(item => item.id === id)?.element;
	if (!target) return;
	const main = target.closest<HTMLElement>('.docs-layout__main-scroller');
	const scroller = main?.querySelector<HTMLElement>('.vc-scroller__wrapper')
		|| target.closest<HTMLElement>('.vc-scroller__wrapper');
	if (scroller) {
		scroller.scrollTop += target.getBoundingClientRect().top
			- scroller.getBoundingClientRect().top;
		return;
	}
	target.scrollIntoView?.({ block: 'start' });
};

const handleSelect = async (event: MouseEvent, id: string) => {
	event.preventDefault();
	activeId.value = id;
	let routeHash = `#${id}`;
	try {
		routeHash = decodeURIComponent(routeHash);
	} catch {
		// 非法百分号序列保持原 hash。
	}
	await router.push({
		path: route.path,
		query: route.query,
		hash: routeHash
	});
	scrollHeadingIntoView(id);
};

watch(source, setupTarget, { immediate: true, flush: 'post' });
watch(() => route.hash, () => {
	if (!headings.value.length) return;
	const fromHash = matchOutlineHeadingId(
		route.hash,
		headings.value.map(item => item.id)
	);
	if (fromHash) activeId.value = fromHash;
});
onBeforeUnmount(() => {
	targetGeneration += 1;
	cleanupTarget();
	if (refreshFrame) cancelAnimationFrame(refreshFrame);
	if (activeFrame) cancelAnimationFrame(activeFrame);
});
</script>
<style lang="scss">
@use '../../styles/bem' as *;

@include block(docs-page-outline) {
	position: sticky;
	top: 0;
	z-index: 1;
	display: flex;
	flex-direction: column;
	gap: 12px;
	width: 288px;
	max-width: 288px;
	max-height: var(--docs-page-outline-max-height, calc(100svh - 60px));
	padding: 40px 24px 96px;
	overflow: hidden;
	align-self: start;
	box-sizing: border-box;

	@include element(title) {
		margin: 0;
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
		font-size: 12px;
		font-weight: 500;
		line-height: 24px;
		letter-spacing: 0.1em;
		color: #4a5565;
		text-transform: uppercase;
	}

	@include element(scroller) {
		min-width: 0;
		min-height: 0;
		flex: 1 1 auto;
	}

	@include element(list) {
		display: flex;
		flex-direction: column;
		gap: 8px;
		width: 100%;
		padding: 0;
		margin: 0;
		list-style: none;
		border-left: 1px solid color-mix(in srgb, varfix(foreground-color) 10%, transparent);

		@include modifier(nested) {
			border-left-color: transparent;
		}
	}

	@include element(item) {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 0;
		margin: 0 0 0 -1px;
		list-style: none;
		align-items: flex-start;
	}

	@include element(link) {
		display: inline-block;
		max-width: 100%;
		padding: 0 0 0 16px;
		font-size: 14px;
		font-weight: 400;
		line-height: 24px;
		color: varfix(foreground-color-light);
		overflow-wrap: anywhere;
		border-left: 1px solid transparent;

		&:hover {
			color: varfix(foreground-color);
			border-left-color: color-mix(in srgb, varfix(foreground-color) 25%, transparent);
		}

		&[aria-current='location'] {
			font-weight: 600;
			color: varfix(foreground-color);
			border-left-color: varfix(foreground-color);
		}
	}
}

@media screen and (width <= 1024px) {
	@include block(docs-page-outline) {
		display: none;
	}
}

[data-doc-theme='dark'] .docs-page-outline__title,
[data-vc-theme='dark'] .docs-page-outline__title {
	color: #9ca3af;
}
</style>
