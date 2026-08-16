<template>
	<div class="docs-renderer-module-editor">
		<div class="docs-renderer-module-editor__row docs-renderer-module-editor__row--split">
			<Field :label="t('renderer.editor.layout')">
				<Select
					:model-value="String(modelValue.layout || 'tile')"
					:data="layouts"
					@update:model-value="value => update({ layout: value })"
				/>
			</Field>
			<Field :label="t('renderer.editor.variant')">
				<Select
					:model-value="String(modelValue.style || 'banner')"
					:data="styles"
					@update:model-value="value => update({ style: value })"
				/>
			</Field>
		</div>
		<div class="docs-renderer-module-editor__row docs-renderer-module-editor__row--split">
			<Field :label="t('renderer.editor.columns')">
				<NumberEditor
					:model-value="Number(modelValue.columns || 2)"
					:min="1"
					:max="4"
					@update:model-value="value => update({ columns: value })"
				/>
			</Field>
			<Field :label="t('renderer.editor.gap')">
				<NumberEditor
					:model-value="Number(modelValue.gap ?? 12)"
					:min="0"
					:max="80"
					@update:model-value="value => update({ gap: value })"
				/>
			</Field>
		</div>
		<div class="docs-renderer-module-editor__row docs-renderer-module-editor__row--split">
			<Field :label="t('renderer.editor.height')">
				<NumberEditor
					:model-value="Number(modelValue.height || 180)"
					:min="80"
					:max="640"
					@update:model-value="value => update({ height: value })"
				/>
			</Field>
			<Field :label="t('renderer.editor.speed')">
				<NumberEditor
					:model-value="Number(modelValue.speed || 4)"
					:min="2"
					:max="20"
					@update:model-value="value => update({ speed: value })"
				/>
			</Field>
		</div>
		<Field wide :label="t('renderer.editor.ads')">
			<ArrayEditor :model-value="items" :create-item="createItem" :min="1" :max="12" @update:model-value="value => update({ items: value })">
				<template #default="{ item, update: updateItem }">
					<div class="docs-renderer-module-editor__row">
						<ImageSource
							:model-value="field(item, 'src')"
							:placeholder="t('renderer.editor.sourceHint')"
							@update:model-value="value => updateItem(patchItem(item, { src: value }))"
						/>
						<Input
							:model-value="field(item, 'href')"
							:placeholder="t('renderer.editor.target')"
							@update:model-value="value => updateItem(patchItem(item, { href: value }))"
						/>
						<div class="docs-renderer-module-editor__row docs-renderer-module-editor__row--split">
							<Input
								:model-value="field(item, 'title')"
								:placeholder="t('renderer.editor.title')"
								@update:model-value="value => updateItem(patchItem(item, { title: value }))"
							/>
							<Input
								:model-value="field(item, 'alt')"
								:placeholder="t('renderer.editor.alt')"
								@update:model-value="value => updateItem(patchItem(item, { alt: value }))"
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
import { Input, Select } from '@deot/vc';
import { useLocale } from '@deot/docs-locale';
import type { RendererModuleEditorProps } from '../../../types';
import ArrayEditor from '../../../editor/array/index.vue';
import Field from '../../../editor/common/field/index.vue';
import ImageSource from '../../../editor/common/image/index.vue';
import NumberEditor from '../../../editor/common/number/index.vue';
import { toRecord } from '../../shared/utils';
import { ADS_LAYOUTS, ADS_STYLES } from './constants';

const props = defineProps<RendererModuleEditorProps>();
const emit = defineEmits<{ 'update:modelValue': [value: Record<string, unknown>] }>();
const { t } = useLocale(computed(() => props.context?.locale));
const items = computed(() => (Array.isArray(props.modelValue.items) ? props.modelValue.items : []).map(toRecord));
const layouts = ADS_LAYOUTS.map(value => ({
	label: t(`renderer.editor.${value}`),
	value
}));
const styles = ADS_STYLES.map(value => ({
	label: t(`renderer.editor.${value}`),
	value
}));
const createItem = () => ({
	src: '',
	href: 'https://example.com',
	title: 'Sponsor',
	alt: ''
});
const field = (item: unknown, key: string) => String(toRecord(item)[key] || '');
const patchItem = (item: unknown, patch: Record<string, unknown>) => ({ ...toRecord(item), ...patch });
const update = (patch: Record<string, unknown>) => emit('update:modelValue', { ...props.modelValue, ...patch });
</script>
