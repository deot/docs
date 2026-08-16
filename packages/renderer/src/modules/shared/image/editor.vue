<template>
	<div class="docs-renderer-module-editor">
		<Field wide :label="t('renderer.editor.source')">
			<ImageSource
				:model-value="String(modelValue.src || '')"
				:placeholder="t('renderer.editor.sourceHint')"
				@update:model-value="value => update({ src: value })"
			/>
		</Field>
		<Field wide :label="t('renderer.editor.darkSource')">
			<ImageSource
				:model-value="String(modelValue.dark || '')"
				:placeholder="t('renderer.editor.sourceHint')"
				@update:model-value="value => update({ dark: value })"
			/>
		</Field>
		<Field wide :label="t('renderer.editor.alt')">
			<Input :model-value="String(modelValue.alt || '')" @update:model-value="value => update({ alt: value })" />
		</Field>
		<Field :label="t('renderer.editor.fit')">
			<Select :model-value="String(modelValue.fit || 'contain')" :data="fits" @update:model-value="value => update({ fit: value })" />
		</Field>
		<Field :label="t('renderer.editor.borderRadius')">
			<NumberEditor
				:model-value="Number(modelValue.borderRadius || 0)"
				:min="0"
				:max="240"
				@update:model-value="value => update({ borderRadius: value })"
			/>
		</Field>
		<Field wide :label="t('renderer.editor.eager')" inline>
			<Switch :model-value="Boolean(modelValue.eager)" @update:model-value="value => update({ eager: value })" />
		</Field>
	</div>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import { Input, Select, Switch } from '@deot/vc';
import { useLocale } from '@deot/docs-locale';
import type { RendererModuleEditorProps } from '../../../types';
import Field from '../../../editor/common/field/index.vue';
import ImageSource from '../../../editor/common/image/index.vue';
import NumberEditor from '../../../editor/common/number/index.vue';

const props = defineProps<RendererModuleEditorProps>();
const emit = defineEmits<{ 'update:modelValue': [value: Record<string, unknown>] }>();
const { t } = useLocale(computed(() => props.context?.locale));
const fits = ['contain', 'cover', 'fill'].map(value => ({ label: value, value }));
const update = (patch: Record<string, unknown>) => emit('update:modelValue', { ...props.modelValue, ...patch });
</script>
