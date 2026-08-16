<template>
	<div class="docs-renderer-module-editor">
		<Field wide :label="t('renderer.editor.text')">
			<Textarea :model-value="String(modelValue.text || '')" :rows="4" @update:model-value="value => update({ text: value })" />
		</Field>
		<Field :label="t('renderer.editor.fontSize')">
			<NumberEditor
				:model-value="Number(modelValue.fontSize || 16)"
				:min="8"
				:max="160"
				@update:model-value="value => update({ fontSize: value })"
			/>
		</Field>
		<Field :label="t('renderer.editor.fontWeight')">
			<NumberEditor
				:model-value="Number(modelValue.fontWeight || 400)"
				:min="100"
				:max="900"
				:step="100"
				@update:model-value="value => update({ fontWeight: value })"
			/>
		</Field>
		<Field :label="t('renderer.editor.lineHeight')">
			<NumberEditor
				:model-value="Number(modelValue.lineHeight || 1.7)"
				:min="0.5"
				:max="3"
				:step="0.1"
				@update:model-value="value => update({ lineHeight: value })"
			/>
		</Field>
		<Field :label="t('renderer.editor.letterSpacing')">
			<NumberEditor
				:model-value="Number(modelValue.letterSpacing || 0)"
				:min="-10"
				:max="30"
				:step="0.5"
				@update:model-value="value => update({ letterSpacing: value })"
			/>
		</Field>
		<Field :label="t('renderer.editor.color')">
			<ColorPicker
				:model-value="String(modelValue.color || '')"
				alpha
				@update:model-value="value => update({ color: value })"
			/>
		</Field>
		<Field :label="t('renderer.editor.background')">
			<ColorPicker
				:model-value="String(modelValue.background || '')"
				alpha
				@update:model-value="value => update({ background: value })"
			/>
		</Field>
		<Field wide :label="t('renderer.editor.align')">
			<Select :model-value="String(modelValue.align || 'left')" :data="alignments" @update:model-value="value => update({ align: value })" />
		</Field>
	</div>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import { ColorPicker, Select, Textarea } from '@deot/vc';
import { useLocale } from '@deot/docs-locale';
import type { RendererModuleEditorProps } from '../../../types';
import Field from '../../../editor/common/field/index.vue';
import NumberEditor from '../../../editor/common/number/index.vue';

const props = defineProps<RendererModuleEditorProps>();
const emit = defineEmits<{ 'update:modelValue': [value: Record<string, unknown>] }>();
const { t } = useLocale(computed(() => props.context?.locale));
const alignments = ['left', 'center', 'right'].map(value => ({ label: value, value }));
const update = (patch: Record<string, unknown>) => emit('update:modelValue', { ...props.modelValue, ...patch });
</script>
