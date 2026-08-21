<template>
	<div class="docs-renderer-text" :style="style">{{ node.module.props.text }}</div>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import type { CSSProperties } from 'vue';
import type { RendererModuleViewerProps } from '../../../types';
import { toLength } from '../utils';

const props = defineProps<RendererModuleViewerProps>();
const style = computed(() => {
	const background = String(props.node.module.props.background || '');
	return {
		fontSize: `${Math.max(1, toLength(props.node.module.props.fontSize, 16))}px`,
		fontWeight: String(props.node.module.props.fontWeight || 400),
		lineHeight: String(props.node.module.props.lineHeight || 1.7),
		letterSpacing: `${toLength(props.node.module.props.letterSpacing, 0)}px`,
		color: String(props.node.module.props.color || 'inherit'),
		textAlign: String(props.node.module.props.align || 'left') as 'left' | 'center' | 'right',
		...(background ? { background } : {})
	} as CSSProperties;
});
</script>
<style lang="scss">
@use '../../../../node_modules/@deot/docs-theme/src/functions' as *;

.docs-renderer-text {
	margin: 0;
	color: varfix(foreground-color);
}
</style>
