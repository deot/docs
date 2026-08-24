<template>
	<svg
		class="docs-playground-icon"
		viewBox="0 0 24 24"
		:style="sizeStyle"
		fill="none"
		stroke="currentColor"
		stroke-width="1.8"
		stroke-linecap="round"
		stroke-linejoin="round"
		aria-hidden="true"
	>
		<path :d="PLAYGROUND_ICON_PATHS[name]" />
	</svg>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import { PLAYGROUND_ICON_PATHS } from './icons';
import type { PlaygroundIconName } from './icons';

const props = defineProps<{
	name: PlaygroundIconName;
	size?: number | string;
}>();
const sizeStyle = computed(() => {
	if (props.size == null) return;
	const value = typeof props.size === 'number' ? `${props.size}px` : props.size;
	return { width: value, height: value };
});
</script>
<style lang="scss">
@use '../style' as *;

@include block(docs-playground-icon) {
	display: block;
	width: 18px;
	height: 18px;
	flex-shrink: 0;
}
</style>
