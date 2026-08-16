<template>
	<component :is="tag" class="docs-renderer-title" :style="style">{{ text }}</component>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import type { RendererModuleViewerProps } from '../../../types';
import { toLength } from '../utils';

const props = defineProps<RendererModuleViewerProps>();
const tag = computed(() => `h${Math.min(6, Math.max(1, toLength(props.node.module.props.level, 2)))}`);
const text = computed(() => String(props.node.module.props.text || ''));
const style = computed(() => ({
	fontSize: `${Math.max(1, toLength(props.node.module.props.fontSize, 32))}px`,
	fontWeight: String(props.node.module.props.fontWeight || 700),
	lineHeight: String(props.node.module.props.lineHeight || 1.3),
	letterSpacing: `${toLength(props.node.module.props.letterSpacing, 0)}px`,
	color: String(props.node.module.props.color || 'inherit'),
	textAlign: String(props.node.module.props.align || 'left') as 'left' | 'center' | 'right'
}));
</script>
