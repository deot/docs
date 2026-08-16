<template>
	<RemoteSfc v-if="source" :source="source" :lang="context.lang || ''" />
</template>
<script setup lang="ts">
import { computed } from 'vue';
import type { RendererModuleViewerProps } from '@deot/docs-renderer';
import RemoteSfc from '../remote-sfc';

const props = defineProps<RendererModuleViewerProps>();
const source = computed(() => String(props.node.module.props.source || ''));
</script>
