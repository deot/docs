<template>
	<div class="docs-renderer-space" :style="style" />
</template>
<script setup lang="ts">
import { computed } from 'vue';
import type { RendererModuleViewerProps } from '../../../types';
import { toLength } from '../../shared/utils';

const props = defineProps<RendererModuleViewerProps>();
const style = computed(() => ({
	height: `${Math.max(1, toLength(props.node.module.props.height, 24))}px`,
	background: String(props.node.module.props.background || 'transparent')
}));
</script>
