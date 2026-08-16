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
