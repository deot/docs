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
<style lang="scss">
@use '../../../node_modules/@deot/docs-theme/src/functions' as *;

.docs-renderer-grid-lines {
	position: absolute;
	top: 0;
	left: 0;
	z-index: 0;
	width: 100%;
	height: 100%;
	overflow: hidden;
	pointer-events: none;

	&__x {
		position: absolute;
		top: 0;
		width: 1px;
		height: 100%;
		border-left: 1px dotted varfix(border-color);
		box-sizing: border-box;
	}

	&__y {
		position: absolute;
		left: 0;
		width: 100%;
		height: 1px;
		border-top: 1px dotted varfix(border-color);
		box-sizing: border-box;
	}
}
</style>
