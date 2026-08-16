<template>
	<PageEditor
		:node="node"
		:model-value="modelValue"
		:context="context"
		@update:model-value="emit('update:modelValue', $event)"
	/>
</template>
<script setup lang="ts">
import PageEditor from '../../modules/shared/page/editor.vue';
import type { RendererLayout, RendererModuleEditorProps } from '../../types';

defineProps<RendererModuleEditorProps>();
const emit = defineEmits<{ 'update:modelValue': [value: RendererLayout] }>();
</script>
