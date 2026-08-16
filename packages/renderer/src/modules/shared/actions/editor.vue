<template>
	<div class="docs-renderer-module-editor">
		<Field wide :label="t('renderer.editor.actions')">
			<ArrayEditor :model-value="items" :create-item="createItem" :max="10" @update:model-value="value => update({ items: value })">
				<template #default="{ item, update: updateItem }">
					<div class="docs-renderer-module-editor__row">
						<Input
							:model-value="field(item, 'label')"
							:placeholder="t('renderer.editor.label')"
							@update:model-value="value => updateItem(patchItem(item, { label: value }))"
						/>
						<Input
							:model-value="field(item, 'to')"
							:placeholder="t('renderer.editor.target')"
							@update:model-value="value => updateItem(patchItem(item, { to: value }))"
						/>
						<div class="docs-renderer-module-editor__row docs-renderer-module-editor__row--split">
							<Field :label="t('renderer.editor.variant')">
								<Select
									:model-value="variantOf(item)"
									:data="variants"
									@update:model-value="value => updateItem(patchItem(item, { variant: value }))"
								/>
							</Field>
							<Field :label="t('renderer.editor.size')">
								<Select
									:model-value="sizeOf(item)"
									:data="sizes"
									@update:model-value="value => updateItem(patchItem(item, { size: value }))"
								/>
							</Field>
						</div>
						<div class="docs-renderer-module-editor__row docs-renderer-module-editor__row--split">
							<Field :label="t('renderer.editor.color')">
								<ColorPicker
									:model-value="field(item, 'color')"
									alpha
									@update:model-value="value => updateItem(patchItem(item, { color: value }))"
								/>
							</Field>
							<Field :label="t('renderer.editor.textColor')">
								<ColorPicker
									:model-value="field(item, 'textColor')"
									alpha
									@update:model-value="value => updateItem(patchItem(item, { textColor: value }))"
								/>
							</Field>
						</div>
					</div>
				</template>
			</ArrayEditor>
		</Field>
	</div>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import { ColorPicker, Input, Select } from '@deot/vc';
import { useLocale } from '@deot/docs-locale';
import type { RendererModuleEditorProps } from '../../../types';
import ArrayEditor from '../../../editor/array/index.vue';
import Field from '../../../editor/common/field/index.vue';
import {
	ACTION_SIZES,
	ACTION_VARIANTS,
	normalizeActionVariant,
	toEnumValue,
	toRecord
} from '../utils';

const props = defineProps<RendererModuleEditorProps>();
const emit = defineEmits<{ 'update:modelValue': [value: Record<string, unknown>] }>();
const { t } = useLocale(computed(() => props.context?.locale));
const items = computed(() => (Array.isArray(props.modelValue.items) ? props.modelValue.items : []).map(toRecord));
const variants = ACTION_VARIANTS.map(value => ({
	label: t(`renderer.editor.${value}`),
	value
}));
const sizes = ACTION_SIZES.map(value => ({
	label: t(`renderer.editor.${value}`),
	value
}));
const createItem = () => ({
	label: 'Action',
	to: '/',
	variant: 'solid',
	size: 'medium',
	color: '',
	textColor: ''
});
const field = (item: unknown, key: string, fallback = '') => String(toRecord(item)[key] || fallback);
const variantOf = (item: unknown) => normalizeActionVariant(toRecord(item).variant);
const sizeOf = (item: unknown) => toEnumValue(toRecord(item).size, ACTION_SIZES, 'medium');
const patchItem = (item: unknown, patch: Record<string, unknown>) => ({ ...toRecord(item), ...patch });
const update = (patch: Record<string, unknown>) => emit('update:modelValue', { ...props.modelValue, ...patch });
</script>
