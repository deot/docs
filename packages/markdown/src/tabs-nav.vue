<template>
	<div
		class="docs-markdown-tabs__list"
		role="tablist"
		:aria-label="label"
	>
		<button
			v-for="item in items"
			:key="item.id"
			type="button"
			class="docs-markdown-tabs__tab"
			role="tab"
			:id="tabButtonId(item.id)"
			:aria-selected="item.id === activeId"
			:aria-controls="tabPanelId(item.id)"
			:tabindex="item.id === activeId ? 0 : -1"
			:class="{ 'docs-markdown-tabs__tab--active': item.id === activeId }"
			@click="select(item.id)"
		>
			{{ item.title }}
		</button>
	</div>
</template>
<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { MarkdownTabQueryAdapter } from './tab-query';

export interface MarkdownTabsNavItem {
	id: string;
	title: string;
}

const props = defineProps<{
	items: MarkdownTabsNavItem[];
	label: string;
	adapter: MarkdownTabQueryAdapter;
	/**
	 * 当前 tabs 根节点（`[data-tabs]`），用于同步 panel 显隐。
	 */
	root: HTMLElement;
	/**
	 * 同一页多组 tabs 时区分 aria id。
	 */
	groupId: string;
}>();

const activeId = ref('');
let unsubscribe: (() => void) | undefined;

const tabButtonId = (id: string) => `${props.groupId}-tab-${id}`;
const tabPanelId = (id: string) => `${props.groupId}-panel-${id}`;

const resolveActive = () => {
	const fromQuery = props.adapter.get();
	const matched = props.items.find(item => item.id === fromQuery);
	activeId.value = matched?.id || props.items[0]?.id || '';
};

const syncPanels = () => {
	props.root.querySelectorAll<HTMLElement>('.docs-markdown-tabs__panel').forEach((panel) => {
		const id = panel.dataset.tab || '';
		const selected = id === activeId.value;
		panel.hidden = !selected;
		panel.setAttribute('aria-labelledby', tabButtonId(id));
		if (selected) {
			panel.removeAttribute('hidden');
			panel.id = tabPanelId(id);
		} else {
			panel.setAttribute('hidden', '');
			panel.id = tabPanelId(id);
		}
	});
};

const select = (id: string) => {
	if (!id) return;
	activeId.value = id;
	props.adapter.set(id);
	syncPanels();
};

onMounted(() => {
	resolveActive();
	syncPanels();
	unsubscribe = props.adapter.subscribe?.(() => {
		resolveActive();
		syncPanels();
	});
});

onBeforeUnmount(() => {
	unsubscribe?.();
	unsubscribe = undefined;
});

watch(() => props.items.map(item => item.id).join('\0'), () => {
	resolveActive();
	syncPanels();
});
</script>
