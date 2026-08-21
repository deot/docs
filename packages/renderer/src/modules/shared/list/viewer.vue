<template>
	<component :is="node.module.props.ordered ? 'ol' : 'ul'" class="docs-renderer-list">
		<li v-for="(item, index) in items" :key="index">{{ item }}</li>
	</component>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import type { RendererModuleViewerProps } from '../../../types';

const props = defineProps<RendererModuleViewerProps>();
const items = computed(() => Array.isArray(props.node.module.props.items) ? props.node.module.props.items : []);
</script>
<style lang="scss">
@use '../../../../node_modules/@deot/docs-theme/src/functions' as *;

.docs-renderer-list {
	margin: 0;
	color: varfix(foreground-color);
}
</style>
