<template>
	<header class="docs-page-header">
		<div v-if="section" class="docs-page-header__start">
			<p class="docs-page-header__eyebrow">{{ section.label }}</p>
		</div>
		<div class="docs-page-header__end">
			<ContentWidthToggle />
		</div>
	</header>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { sidebarItems } from '../../modules/sidebar';
import { findSidebarSection } from '../../utils/sidebar';
import ContentWidthToggle from './content-width-toggle.vue';

defineOptions({ name: 'DocsPageHeader' });

const route = useRoute();
const lang = computed(() => String(route.params.lang || 'zh-CN'));
const section = computed(() => {
	if (!sidebarItems.value?.length) return;
	return findSidebarSection(sidebarItems.value, route.path, lang.value);
});
</script>
<style lang="scss">
@use '../../styles/bem' as *;

@include block(docs-page-header) {
	display: flex;
	flex-direction: row;
	align-items: center;
	justify-content: space-between;
	gap: 32px;
	width: 100%;
	min-width: 0;

	@include element(start) {
		display: flex;
		min-width: 0;
		align-items: center;
		gap: 8px;
	}

	@include element(end) {
		display: flex;
		flex: none;
		margin-left: auto;
		align-items: center;
		gap: 8px;
	}

	@include element(eyebrow) {
		display: flex;
		margin: 0;
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
		font-size: 12px;
		font-weight: 500;
		line-height: 24px;
		letter-spacing: 0.1em;
		color: #4a5565;
		text-transform: uppercase;
		align-items: center;
		gap: 8px;
	}
}

[data-doc-theme='dark'] .docs-page-header__eyebrow,
[data-vc-theme='dark'] .docs-page-header__eyebrow {
	color: #9ca3af;
}
</style>
