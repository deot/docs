<template>
	<div
		class="docs-renderer-field"
		:class="{ 'is-wide': wide, 'is-inline': inline }"
	>
		<label v-if="label">{{ label }}</label>
		<slot />
	</div>
</template>
<script setup lang="ts">
defineProps<{
	label?: string;
	wide?: boolean;
	inline?: boolean;
}>();
</script>
<style lang="scss">
@use '../../../../node_modules/@deot/docs-theme/src/functions' as *;

.docs-renderer-field {
	display: grid;
	gap: 4px;
	min-width: 0;

	&.is-wide {
		grid-column: 1 / -1;
	}

	&.is-inline {
		display: flex;
		min-height: 26px;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	}

	> label {
		padding: 0;
		font-size: 11px;
		line-height: 1.3;
		color: varfix(foreground-color-mute);
		text-align: left;
	}

	> * {
		min-width: 0;
	}
}
</style>
