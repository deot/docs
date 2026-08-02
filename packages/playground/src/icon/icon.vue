<template>
	<svg
		class="docs-playground-icon"
		viewBox="0 0 24 24"
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
import { PLAYGROUND_ICON_PATHS } from './icons';
import type { PlaygroundIconName } from './icons';

defineProps<{
	name: PlaygroundIconName;
}>();
</script>
<style>
.docs-playground-icon {
	display: block;
	width: 18px;
	height: 18px;
}
</style>
