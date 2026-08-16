<template>
	<div class="docs-renderer-grid-lines">
		<div
			v-for="value in yArr"
			:key="`y_${value}`"
			class="docs-renderer-grid-lines__y"
			:style="{ top: `${value}px` }"
		/>
		<div
			v-for="value in xArr"
			:key="`x_${value}`"
			class="docs-renderer-grid-lines__x"
			:style="{ left: `${value}px` }"
		/>
	</div>
</template>
<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(defineProps<{
	width: number;
	height: number;
	grid?: readonly [number, number];
}>(), {
	grid: () => [10, 10]
});

const xArr = computed(() => {
	const step = props.grid[0] || 10;
	const length = Math.floor(props.width / step);
	return Array.from({ length }, (_, index) => index * step);
});
const yArr = computed(() => {
	const step = props.grid[1] || 10;
	const length = Math.floor(props.height / step);
	return Array.from({ length }, (_, index) => index * step);
});
</script>
