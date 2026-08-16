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
				:model-value="Number(modelValue.columns || 3)"
				:min="1"
				:max="6"
				@update:model-value="value => update({ columns: value })"
			/>
		</Field>
		<Field :label="t('renderer.editor.gap')">
			<NumberEditor :model-value="Number(modelValue.gap ?? 20)" :min="0" :max="120" @update:model-value="value => update({ gap: value })" />
		</Field>
		<Field wide :label="t('renderer.editor.accent')">
			<ColorPicker
				:model-value="String(modelValue.accent || '')"
				alpha
				@update:model-value="value => update({ accent: value })"
			/>
		</Field>
		<Field wide :label="t('renderer.editor.cards')">
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
							<Select
								searchable
								clearable
								:data="iconOptions"
								:model-value="typeValue(item)"
								:placeholder="t('renderer.editor.icon')"
								@update:model-value="value => updateItem(patchItem(item, { icon: value || '' }))"
							/>
							<ImageSource
								:model-value="field(item, 'icon')"
								:placeholder="t('renderer.editor.iconHint')"
								@update:model-value="value => updateItem(patchItem(item, { icon: value }))"
							/>
						</div>
						<div class="docs-renderer-module-editor__row docs-renderer-module-editor__row--split">
							<ColorPicker
								:model-value="field(item, 'accent')"
								alpha
								@update:model-value="value => updateItem(patchItem(item, { accent: value }))"
							/>
							<Input
								:model-value="field(item, 'badge')"
								:placeholder="t('renderer.editor.badge')"
								@update:model-value="value => updateItem(patchItem(item, { badge: value }))"
							/>
						</div>
					</div>
				</template>
			</ArrayEditor>
		</Field>
	</div>
</template>
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { ColorPicker, IconManager, Input, Select, Textarea } from '@deot/vc';
import { useLocale } from '@deot/docs-locale';
import type { RendererModuleEditorProps } from '../../../types';
import ArrayEditor from '../../../editor/array/index.vue';
import Field from '../../../editor/common/field/index.vue';
import ImageSource from '../../../editor/common/image/index.vue';
import NumberEditor from '../../../editor/common/number/index.vue';
import { SECTION_ALIGNMENTS, toRecord } from '../../shared/utils';
import { featureIconKind, listBuiltinIconTypes } from './icon';
import { FEATURE_ACCENTS } from './palette';

const props = defineProps<RendererModuleEditorProps>();
const emit = defineEmits<{ 'update:modelValue': [value: Record<string, unknown>] }>();
const { t } = useLocale(computed(() => props.context?.locale));
const alignments = SECTION_ALIGNMENTS.map(value => ({ label: t(`renderer.editor.${value}`), value }));
const iconTypes = ref(listBuiltinIconTypes());
const items = computed(() => (Array.isArray(props.modelValue.items) ? props.modelValue.items : []).map(toRecord));
const iconOptions = computed(() => {
	const types = new Set(iconTypes.value);
	for (const item of items.value) {
		const icon = String(item.icon || '').trim();
		if (featureIconKind(icon) === 'type') types.add(icon);
	}
	return [...types].sort((left, right) => left.localeCompare(right)).map(value => ({ label: value, value }));
});
const createItem = () => {
	const index = items.value.length;
	return {
		title: 'Feature',
		description: 'Describe this capability.',
		badge: '',
		icon: 'star',
		accent: FEATURE_ACCENTS[index % FEATURE_ACCENTS.length]
	};
};
const field = (item: unknown, key: string) => String(toRecord(item)[key] || '');
const typeValue = (item: unknown) => (featureIconKind(field(item, 'icon')) === 'type' ? field(item, 'icon') : '');
const patchItem = (item: unknown, patch: Record<string, unknown>) => ({ ...toRecord(item), ...patch });
const update = (patch: Record<string, unknown>) => emit('update:modelValue', { ...props.modelValue, ...patch });
const refreshIconTypes = () => {
	iconTypes.value = listBuiltinIconTypes();
};
onMounted(() => {
	refreshIconTypes();
	window.setTimeout(() => {
		void IconManager.basicStatus?.then(refreshIconTypes).catch(refreshIconTypes);
	}, 0);
});
</script>
