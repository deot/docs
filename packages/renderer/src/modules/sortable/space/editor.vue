<template>
	<div class="docs-renderer-module-editor">
		<Field :label="t('renderer.editor.height')">
			<NumberEditor :model-value="Number(modelValue.height || 24)" :min="1" :max="480" @update:model-value="handleHeight" />
		</Field>
		<Field :label="t('renderer.editor.background')">
			<ColorPicker
				:model-value="String(modelValue.background || '')"
				alpha
				@update:model-value="handleBackground"
			/>
		</Field>
	</div>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import { ColorPicker } from '@deot/vc';
import { useLocale } from '@deot/docs-locale';
import type { RendererModuleEditorProps } from '../../../types';
import Field from '../../../editor/common/field/index.vue';
import NumberEditor from '../../../editor/common/number/index.vue';

const props = defineProps<RendererModuleEditorProps>();
const emit = defineEmits<{ 'update:modelValue': [value: Record<string, unknown>] }>();
const { t } = useLocale(computed(() => props.context?.locale));
const update = (patch: Record<string, unknown>) => emit('update:modelValue', { ...props.modelValue, ...patch });
const handleHeight = (value: number) => update({ height: value });
const handleBackground = (value: string) => update({ background: value });
</script>
