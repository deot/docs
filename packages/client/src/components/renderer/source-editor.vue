<template>
	<div class="docs-renderer-module-editor">
		<label>{{ t('renderer.editor.source') }}</label>
		<Input :model-value="String(modelValue.source || '')" @update:model-value="handleUpdate" />
	</div>
</template>
<script setup lang="ts">
import { Input } from '@deot/vc';
import { useLocale } from '@deot/docs-locale';
import type { RendererModuleEditorProps } from '@deot/docs-renderer';

const props = defineProps<RendererModuleEditorProps>();
const emit = defineEmits<{ 'update:modelValue': [value: Record<string, unknown>] }>();
const { t } = useLocale();
const handleUpdate = (source: string) => emit('update:modelValue', { ...props.modelValue, source });
</script>
