<template>
	<template v-for="(part, index) in parts" :key="`${index}:${part.text}`">
		<mark v-if="part.match" class="docs-search-highlight">{{ part.text }}</mark>
		<template v-else>{{ part.text }}</template>
	</template>
</template>
<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{ text: string; keyword: string }>();
const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
const parts = computed(() => {
	const tokens = props.keyword.trim().split(/\s+/u).filter(Boolean);
	if (!tokens.length) return [{ text: props.text, match: false }];
	const expression = new RegExp(`(${tokens.map(escapeRegExp).join('|')})`, 'giu');
	return props.text.split(expression).filter(Boolean).map(text => ({
		text,
		match: tokens.some(token => text.localeCompare(token, undefined, { sensitivity: 'accent' }) === 0)
	}));
});
</script>
<style lang="scss">
.docs-search-highlight {
	padding: 0;
	color: #2d8cf0;
	background: transparent;
}
</style>
