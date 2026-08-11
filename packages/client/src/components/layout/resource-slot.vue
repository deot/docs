<template>
	<div
		ref="root"
		class="docs-resource-slot"
		:data-slot="name"
		:data-resource-type="resourceType || undefined"
		:style="{ minHeight: transitionMinHeight }"
	>
		<DefaultHeader v-if="builtin === 'header'" />
		<DefaultFooter v-else-if="builtin === 'footer'" />
		<DefaultSidebar v-else-if="sidebarItems" :items="sidebarItems" />
		<RemoteSfc v-else-if="resourceType === 'sfc' && source" :source="source" :lang="lang" />
		<div v-else-if="error" class="docs-resource-slot__error">{{ error }}</div>
		<div v-else-if="loading" class="docs-resource-slot__loading">Loading…</div>
		<Markdown
			v-else-if="resourceType === 'markdown'"
			:value="content"
			@click="handleMarkdownClick"
		/>
		<div v-else-if="builtin" class="docs-resource-slot__builtin" :data-builtin="builtin"></div>
	</div>
</template>
<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Markdown } from '@deot/docs-markdown';
import DefaultFooter from './default-footer.vue';
import DefaultHeader from './default-header.vue';
import DefaultSidebar from './default-sidebar.vue';
import RemoteSfc from '../remote-sfc';
import { Gateway } from '../../modules';
import { isExternalLink, isPlainNavigationClick } from '../../utils/link';
import { createResourceIdentity, resolveResource } from '../../utils/resolver';
import { getRouteValue } from '../../utils/route';
import { getDocsConfig } from '../../utils/runtime';
import type { DocsResourceType, DocsRoute, SidebarItem } from '../../types';

const props = defineProps<{ name: 'header' | 'sidebar' | 'content' | 'footer' | 'extra' }>();
const route = useRoute();
const router = useRouter();
const docs = getDocsConfig();
const content = ref('');
const error = ref('');
const loading = ref(false);
const source = ref('');
const resourceType = ref<DocsResourceType | ''>('');
const builtin = ref('');
const sidebarItems = ref<SidebarItem[] | null>(null);
const root = ref<HTMLElement>();
const transitionMinHeight = ref('');
let unsubscribe: (() => void) | undefined;
let controller: AbortController | undefined;
let generation = 0;
let activeStableSlotKey = '';
let pendingStableSlotKey = '';
const normalizedLinks = new WeakMap<HTMLAnchorElement, number>();

const lang = computed(() => String(route.params.lang || Object.keys(docs.locales)[0] || 'zh-CN'));
const routeConfig = computed(() => route.meta.docsRoute as DocsRoute | undefined);
const clear = () => {
	unsubscribe?.();
	unsubscribe = undefined;
	controller?.abort();
	controller = undefined;
};

/**
 * 路由切换会先清空旧内容再展示新内容。加载期间保留上一正文的实际高度，
 * 避免 Footer 和滚动范围先收缩、再随新 Markdown 二次扩张。
 */
const captureTransitionHeight = () => {
	if (props.name !== 'content' || !root.value) return;
	const height = Math.ceil(root.value.getBoundingClientRect().height);
	transitionMinHeight.value = height > 0 ? `${height}px` : '';
};

/**
 * 新状态完成 DOM 提交后释放临时高度；代次检查防止旧请求解除新页面的锁定。
 * @param current 当前加载流程所属的资源代次。
 */
const releaseTransitionHeight = async (current: number) => {
	await nextTick();
	if (current === generation) transitionMinHeight.value = '';
};

const getHashTarget = (hash: string) => {
	const raw = hash.replace(/^#/, '');
	if (!raw || !root.value) return;
	let decoded = raw;
	try {
		decoded = decodeURIComponent(raw);
	} catch {
		// 格式异常的锚点仍可能与第三方元素的原始 ID 匹配。
	}
	const candidates = new Set([raw, decoded, encodeURIComponent(decoded)]);
	return [...root.value.querySelectorAll<HTMLElement>('[id], [name]')]
		.find(element => candidates.has(element.id) || candidates.has(element.getAttribute('name') || ''));
};

/**
 * 将 Resolver 返回的站内目标写回真实 href，使复制链接和新标签打开同样
 * 使用正确的 deployment base；Router 目标单独保存在 data 属性中。
 * @param current 当前 Markdown 所属的资源代次。
 */
const normalizeMarkdownLinks = async (current = generation) => {
	if (props.name !== 'content' || resourceType.value !== 'markdown' || !docs.resolve?.link) {
		return;
	}
	await nextTick();
	if (current !== generation || !root.value) return;
	let anchors = root.value.querySelectorAll<HTMLAnchorElement>('a[href]');
	// applyContent 可能早于 loading 分支切换，第二个 tick 才会挂载 Markdown。
	if (!anchors.length) {
		await nextTick();
		if (current !== generation || !root.value) return;
		anchors = root.value.querySelectorAll<HTMLAnchorElement>('a[href]');
	}
	for (const anchor of anchors) {
		if (normalizedLinks.get(anchor) === current) continue;
		normalizedLinks.set(anchor, current);
		const href = anchor.dataset.docsOriginalHref || anchor.getAttribute('href');
		if (!href || href.startsWith('#')) continue;
		anchor.dataset.docsOriginalHref = href;
		anchor.setAttribute('href', href);
		delete anchor.dataset.docsRoute;
		let target: string | null | undefined;
		try {
			target = docs.resolve.link({
				href,
				lang: lang.value,
				source: source.value,
				route
			});
		} catch {
			// 单个链接配置错误时保留 Markdown 原地址，不影响其余正文渲染。
			continue;
		}
		if (current !== generation) return;
		if (!target) continue;
		if (isExternalLink(target)) {
			anchor.setAttribute('href', target);
			delete anchor.dataset.docsRoute;
			continue;
		}
		try {
			const resolved = router.resolve(target);
			anchor.setAttribute('href', resolved.href);
			anchor.dataset.docsRoute = resolved.fullPath;
		} catch {
			// 非法 Router 目标保持原地址，避免一个链接中断整篇 Markdown。
		}
	}
};

/**
 * 在 VcScroller 内定位 Markdown 锚点，而不是滚动 window。
 * markdown-it 生成的 ID 可能经过编码，而 Vue Router 暴露的 hash 可能
 * 已解码，因此需要同时兼容两种形式。
 * @param hash 需要定位的锚点，包含开头的井号。
 * @param current 当前已渲染 Markdown 所属的资源代次。
 */
const scrollToMarkdownHash = async (hash: string, current = generation) => {
	if (!hash) return;
	await nextTick();
	if (current !== generation) return;
	let target = getHashTarget(hash);
	// 第一次 tick 可能早于 loading 到 Markdown 分支的切换。
	if (!target) {
		await nextTick();
		if (current !== generation) return;
		target = getHashTarget(hash);
	}
	const scroller = target?.closest<HTMLElement>('.vc-scroller__wrapper');
	if (target && scroller) {
		scroller.scrollTop += target.getBoundingClientRect().top
			- scroller.getBoundingClientRect().top;
		return;
	}
	target?.scrollIntoView?.({ block: 'start' });
};

const applyContent = (value: string, current = generation) => {
	if (props.name === 'sidebar' && resourceType.value === 'sidebar') {
		try {
			const parsed = JSON.parse(value);
			if (!Array.isArray(parsed)) throw new TypeError('Sidebar root must be an array');
			sidebarItems.value = parsed as SidebarItem[];
			error.value = '';
		} catch (reason) {
			sidebarItems.value = null;
			error.value = reason instanceof Error ? reason.message : 'Invalid sidebar resource';
		}
	} else {
		error.value = '';
	}
	content.value = value;
	if (props.name === 'content' && resourceType.value === 'markdown') {
		void normalizeMarkdownLinks(current);
	}
	if (props.name === 'content' && resourceType.value === 'markdown' && route.hash) {
		void scrollToMarkdownHash(route.hash, current);
	}
};

const classify = (value: string): DocsResourceType => {
	if (/\.json(?:$|[?#])/i.test(value)) return 'sidebar';
	if (/\.vue(?:$|[?#])/i.test(value)) return 'sfc';
	if (/\.css(?:$|[?#])/i.test(value)) return 'style';
	if (/\.[jt]s(?:$|[?#])/i.test(value)) return 'module';
	return 'markdown';
};

/* 锚点留在当前 Scroller，Resolver 标记的站内链接交给 Vue Router。 */
const handleMarkdownClick = async (event: MouseEvent) => {
	if (!(event.target instanceof Element)) return;
	const anchor = event.target.closest<HTMLAnchorElement>('a[href]');
	if (!anchor || !isPlainNavigationClick(event, anchor)) return;
	const href = anchor.getAttribute('href');
	if (!href) return;
	const docsRoute = anchor.dataset.docsRoute;
	if (!href.startsWith('#')) {
		if (!docsRoute) return;
		event.preventDefault();
		await router.push(docsRoute);
		return;
	}
	if (href === '#') return;
	event.preventDefault();
	let routeHash = href;
	try {
		routeHash = decodeURIComponent(href);
	} catch {
		// 第三方锚点格式异常时保留原值，不阻断导航。
	}
	await router.push({
		path: route.path,
		query: route.query,
		hash: routeHash
	});
	await scrollToMarkdownHash(href);
};

const load = async () => {
	const config = routeConfig.value;
	let slot = config?.[props.name];
	if (typeof slot === 'undefined') slot = props.name === 'content' ? 'default' : null;
	if (slot === 'default' && props.name === 'sidebar') slot = './sidebar.json';
	const isBuiltin = slot === 'default' && props.name !== 'content';
	const isFixedSlot = ['header', 'sidebar', 'footer'].includes(props.name);
	const stableSlotKey = isFixedSlot
		? JSON.stringify([
				isBuiltin || slot === null ? '' : lang.value,
				props.name,
				isBuiltin ? `builtin:${props.name}` : slot
			])
		: '';
	// Sidebar/Header/Footer 等固定插槽保持原组件、订阅和请求；失败流程不会
	// 写入 active key，因此下次进入同一页面仍会重新尝试。
	if (stableSlotKey && (
		activeStableSlotKey === stableSlotKey
		|| pendingStableSlotKey === stableSlotKey
	)) return;
	// 快速切换路由时，异步 resolver 和资源请求可能乱序完成。
	const current = ++generation;
	activeStableSlotKey = '';
	pendingStableSlotKey = stableSlotKey;
	captureTransitionHeight();
	clear();
	content.value = '';
	error.value = '';
	loading.value = false;
	source.value = '';
	resourceType.value = '';
	builtin.value = '';
	sidebarItems.value = null;
	if (!config) {
		activeStableSlotKey = stableSlotKey;
		pendingStableSlotKey = '';
		await releaseTransitionHeight(current);
		return;
	}
	loading.value = true;
	let activeController: AbortController | undefined;
	const markStableSlot = () => {
		if (current === generation && stableSlotKey) activeStableSlotKey = stableSlotKey;
	};
	try {
		if (slot === null) {
			markStableSlot();
			return;
		}
		if (isBuiltin) {
			builtin.value = props.name;
			markStableSlot();
			return;
		}
		if (slot === 'default') {
			slot = await docs.resolve?.markdown?.({
				lang: lang.value,
				value: getRouteValue(route, config),
				route
			}) || `./${getRouteValue(route, config)}.md`;
		}
		if (current !== generation || typeof slot !== 'string') return;
		source.value = slot;
		resourceType.value = classify(slot);
		if (resourceType.value === 'sfc') {
			markStableSlot();
			return;
		}
		activeController = new AbortController();
		controller = activeController;
		const identity = createResourceIdentity(docs, lang.value, resourceType.value, slot);
		const url = await resolveResource(docs, {
			source: slot,
			type: resourceType.value,
			lang: lang.value
		});
		if (current !== generation || activeController.signal.aborted) return;
		unsubscribe = Gateway.subscribe(identity, (record) => {
			if (current === generation) applyContent(record.content, current);
		});
		const record = await Gateway.load(identity, {
			url,
			priority: 100,
			signal: activeController.signal
		});
		if (current === generation) {
			applyContent(record.content, current);
			markStableSlot();
		}
	} catch (reason) {
		if (current === generation && !activeController?.signal.aborted) {
			error.value = reason instanceof Error ? reason.message : 'Resource request failed';
		}
	} finally {
		// 保持 signal 有效：缓存读取可能早于静默刷新完成。
		if (current === generation) {
			pendingStableSlotKey = '';
			loading.value = false;
			await releaseTransitionHeight(current);
		}
	}
};

// hash 变化只移动当前文档，不应重新加载资源。
watch(
	[() => route.path, () => JSON.stringify(route.query), () => props.name],
	load,
	{ immediate: true }
);
watch(
	() => route.hash,
	(hash) => {
		if (props.name === 'content' && resourceType.value === 'markdown') {
			void scrollToMarkdownHash(hash);
		}
	},
	{ flush: 'post' }
);
onBeforeUnmount(() => {
	generation += 1;
	clear();
});
</script>
<style lang="scss">
@use '../../styles/bem' as *;

@include block(docs-resource-slot) {
	@include element(loading) {
		padding: 16px;
		color: #6e7781;
	}

	@include element(error) {
		padding: 16px;
		color: #cf222e;
	}
}
</style>
