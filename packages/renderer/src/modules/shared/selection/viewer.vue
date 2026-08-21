<template>
	<div class="docs-renderer-selection-group" />
</template>
<script setup lang="ts">
import type { RendererModuleViewerProps } from '../../../types';

defineProps<RendererModuleViewerProps>();
</script>
<style lang="scss">
.docs-renderer-selection-group {
	width: 100%;
	height: 100%;
}
</style>
