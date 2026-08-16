<template>
	<div class="docs-renderer-module-editor">
		<Field wide :label="t('renderer.editor.eyebrow')">
			<Input :model-value="String(modelValue.eyebrow || '')" @update:model-value="value => update({ eyebrow: value })" />
		</Field>
		<Field wide :label="t('renderer.editor.title')">
			<Input :model-value="String(modelValue.title || '')" @update:model-value="value => update({ title: value })" />
		</Field>
		<Field wide :label="t('renderer.editor.description')">
			<Textarea :model-value="String(modelValue.description || '')" :rows="2" @update:model-value="value => update({ description: value })" />
		</Field>
		<Field :label="t('renderer.editor.align')">
			<Select :model-value="String(modelValue.align || 'center')" :data="alignments" @update:model-value="value => update({ align: value })" />
		</Field>
		<Field :label="t('renderer.editor.columns')">
			<NumberEditor
				:model-value="Number(modelValue.columns || 1)"
				:min="1"
				:max="6"
				@update:model-value="value => update({ columns: value })"
			/>
		</Field>
		<Field :label="t('renderer.editor.accent')">
			<ColorPicker
				:model-value="String(modelValue.accent || '')"
				alpha
				@update:model-value="value => update({ accent: value })"
			/>
		</Field>
		<Field wide :label="t('renderer.editor.steps')">
			<ArrayEditor :model-value="items" :create-item="createItem" :min="1" @update:model-value="value => update({ items: value })">
				<template #default="{ item, update: updateItem }">
					<div class="docs-renderer-module-editor__row">
						<Input
							:model-value="field(item, 'title')"
							:placeholder="t('renderer.editor.title')"
							@update:model-value="value => updateItem(patchItem(item, { title: value }))"
						/>
						<Textarea
							:model-value="field(item, 'description')"
							:rows="2"
							:placeholder="t('renderer.editor.description')"
							@update:model-value="value => updateItem(patchItem(item, { description: value }))"
						/>
						<div class="docs-renderer-module-editor__row docs-renderer-module-editor__row--split">
							<Input
								:model-value="field(item, 'icon')"
								:placeholder="t('renderer.editor.icon')"
								@update:model-value="value => updateItem(patchItem(item, { icon: value }))"
							/>
							<ColorPicker
								:model-value="field(item, 'accent')"
								alpha
								@update:model-value="value => updateItem(patchItem(item, { accent: value }))"
							/>
						</div>
					</div>
				</template>
			</ArrayEditor>
		</Field>
	</div>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import { ColorPicker, Input, Select, Textarea } from '@deot/vc';
import { useLocale } from '@deot/docs-locale';
import type { RendererModuleEditorProps } from '../../../types';
import ArrayEditor from '../../../editor/array/index.vue';
import Field from '../../../editor/common/field/index.vue';
import NumberEditor from '../../../editor/common/number/index.vue';
import { SECTION_ALIGNMENTS, toRecord } from '../../shared/utils';
import { FEATURE_ACCENTS } from '../features/palette';

const props = defineProps<RendererModuleEditorProps>();
const emit = defineEmits<{ 'update:modelValue': [value: Record<string, unknown>] }>();
const { t } = useLocale(computed(() => props.context?.locale));
const alignments = SECTION_ALIGNMENTS.map(value => ({ label: t(`renderer.editor.${value}`), value }));
const items = computed(() => (Array.isArray(props.modelValue.items) ? props.modelValue.items : []).map(toRecord));
const createItem = () => {
	const index = items.value.length;
	return {
		title: 'Step',
		description: 'Describe this step.',
		icon: String(index + 1),
		accent: FEATURE_ACCENTS[index % FEATURE_ACCENTS.length]
	};
};
const field = (item: unknown, key: string) => String(toRecord(item)[key] || '');
const patchItem = (item: unknown, patch: Record<string, unknown>) => ({ ...toRecord(item), ...patch });
const update = (patch: Record<string, unknown>) => emit('update:modelValue', { ...props.modelValue, ...patch });
</script>
