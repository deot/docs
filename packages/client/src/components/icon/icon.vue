<template>
	<svg
		class="docs-client-icon"
		:data-icon="name"
		viewBox="0 0 24 24"
		:style="sizeStyle"
		:fill="definition.filled ? 'currentColor' : 'none'"
		:stroke="definition.filled ? 'none' : 'currentColor'"
		stroke-width="1.8"
		stroke-linecap="round"
		stroke-linejoin="round"
		aria-hidden="true"
	>
		<path :d="definition.path" />
	</svg>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import { CLIENT_ICON_DEFINITIONS } from './icons';
import type { ClientIconName } from './icons';

const props = defineProps<{
	name: ClientIconName;
	size?: number | string;
}>();
const definition = computed(() => CLIENT_ICON_DEFINITIONS[props.name]);
const sizeStyle = computed(() => {
	if (props.size == null) return;
	const value = typeof props.size === 'number' ? `${props.size}px` : props.size;
	return { width: value, height: value };
});
</script>
<style lang="scss">
@use '../../styles/bem' as *;

@include block(docs-client-icon) {
	display: block;
	width: 18px;
	height: 18px;
	flex-shrink: 0;
}
</style>
