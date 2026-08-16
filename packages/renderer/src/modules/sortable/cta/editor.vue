<template>
	<div class="docs-renderer-module-editor">
		<Field wide :label="t('renderer.editor.eyebrow')">
			<Input :model-value="String(modelValue.eyebrow || '')" @update:model-value="value => update({ eyebrow: value })" />
		</Field>
		<Field wide :label="t('renderer.editor.title')">
			<Input :model-value="String(modelValue.title || '')" @update:model-value="value => update({ title: value })" />
		</Field>
		<Field wide :label="t('renderer.editor.description')">
			<Textarea :model-value="String(modelValue.description || '')" :rows="3" @update:model-value="value => update({ description: value })" />
		</Field>
		<Field :label="t('renderer.editor.align')">
			<Select :model-value="String(modelValue.align || 'center')" :data="alignments" @update:model-value="value => update({ align: value })" />
		</Field>
		<Field :label="t('renderer.editor.accent')">
			<ColorPicker
				:model-value="String(modelValue.accent || '')"
				alpha
				@update:model-value="value => update({ accent: value })"
			/>
		</Field>
		<Field :label="t('renderer.editor.accentSecondary')">
			<ColorPicker
				:model-value="String(modelValue.accentSecondary || '')"
				alpha
				@update:model-value="value => update({ accentSecondary: value })"
			/>
		</Field>
		<Field wide :label="t('renderer.editor.background')">
			<ColorPicker
				:model-value="String(modelValue.background || '')"
				alpha
				@update:model-value="value => update({ background: value })"
			/>
		</Field>
		<Field wide>
			<ActionsEditor
				:node="node"
				:model-value="actionsValue"
				:context="context"
				@update:model-value="value => update({ actions: value.items })"
			/>
		</Field>
	</div>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import { ColorPicker, Input, Select, Textarea } from '@deot/vc';
import { useLocale } from '@deot/docs-locale';
import type { RendererModuleEditorProps } from '../../../types';
import ActionsEditor from '../../shared/actions/editor.vue';
import Field from '../../../editor/common/field/index.vue';

const props = defineProps<RendererModuleEditorProps>();
const emit = defineEmits<{ 'update:modelValue': [value: Record<string, unknown>] }>();
const { t } = useLocale(computed(() => props.context?.locale));
const alignments = ['left', 'center'].map(value => ({ label: value, value }));
const actionsValue = computed(() => ({
	items: Array.isArray(props.modelValue.actions) ? props.modelValue.actions : []
}));
const update = (patch: Record<string, unknown>) => emit('update:modelValue', { ...props.modelValue, ...patch });
</script>
