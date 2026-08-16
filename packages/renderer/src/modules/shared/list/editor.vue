<template>
	<div class="docs-renderer-module-editor">
		<Field wide :label="t('renderer.editor.ordered')" inline>
			<Switch :model-value="Boolean(modelValue.ordered)" @update:model-value="value => update({ ordered: value })" />
		</Field>
		<Field wide :label="t('renderer.editor.items')">
			<ArrayEditor :model-value="items" :create-item="() => ''" :min="1" @update:model-value="value => update({ items: value })">
				<template #default="{ item, update: updateItem }">
					<Input :model-value="String(item)" @update:model-value="updateItem" />
				</template>
			</ArrayEditor>
		</Field>
	</div>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import { Input, Switch } from '@deot/vc';
import { useLocale } from '@deot/docs-locale';
import type { RendererModuleEditorProps } from '../../../types';
import ArrayEditor from '../../../editor/array/index.vue';
import Field from '../../../editor/common/field/index.vue';

const props = defineProps<RendererModuleEditorProps>();
const emit = defineEmits<{ 'update:modelValue': [value: Record<string, unknown>] }>();
const { t } = useLocale(computed(() => props.context?.locale));
const items = computed(() => Array.isArray(props.modelValue.items) ? props.modelValue.items : []);
const update = (patch: Record<string, unknown>) => emit('update:modelValue', { ...props.modelValue, ...patch });
</script>
