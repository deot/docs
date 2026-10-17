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
		<Field :label="t('renderer.editor.accent')">
			<ColorPicker :model-value="String(modelValue.accent || '')" alpha @update:model-value="value => update({ accent: value })" />
		</Field>
		<Field :label="t('renderer.editor.background')">
			<ColorPicker :model-value="String(modelValue.background || '')" alpha @update:model-value="value => update({ background: value })" />
		</Field>
		<Field :label="t('renderer.editor.textColor')">
			<ColorPicker :model-value="String(modelValue.textColor || '')" alpha @update:model-value="value => update({ textColor: value })" />
		</Field>
		<Field :label="t('renderer.editor.codeFilename')">
			<Input :model-value="String(modelValue.filename || '')" @update:model-value="value => update({ filename: value })" />
		</Field>
		<Field :label="t('renderer.editor.visualLanguage')">
			<Input :model-value="String(modelValue.language || '')" @update:model-value="value => update({ language: value })" />
		</Field>
		<Field wide :label="t('renderer.editor.codeContent')">
			<Textarea :model-value="String(modelValue.content || '')" :rows="12" @update:model-value="value => update({ content: value })" />
		</Field>
		<Field wide :label="t('renderer.editor.codeHighlightLines')">
			<Input :model-value="highlightLines" :placeholder="t('renderer.editor.codeHighlightHint')" @update:model-value="updateHighlights" />
		</Field>
		<Field wide :label="t('renderer.editor.codeFolds')">
			<ArrayEditor :model-value="folds" :create-item="createFold" :reorderable="false" @update:model-value="value => update({ folds: value })">
				<template #default="{ item, update: updateItem }">
					<div class="docs-renderer-module-editor__row">
						<Input
							:model-value="String(toRecord(item).label || '')"
							:placeholder="t('renderer.editor.label')"
							@update:model-value="value => updateItem({ ...toRecord(item), label: value })"
						/>
						<div class="docs-renderer-module-editor__row docs-renderer-module-editor__row--split">
							<Field :label="t('renderer.editor.codeStartLine')">
								<NumberEditor
									:model-value="Number(toRecord(item).start)"
									:min="1" :max="lineCount"
									@update:model-value="value => updateItem({ ...toRecord(item), start: value })"
								/>
							</Field>
							<Field :label="t('renderer.editor.codeEndLine')">
								<NumberEditor
									:model-value="Number(toRecord(item).end)"
									:min="1" :max="lineCount"
									@update:model-value="value => updateItem({ ...toRecord(item), end: value })"
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
import { ColorPicker, Input, Select, Textarea } from '@deot/vc';
import { useLocale } from '@deot/docs-locale';
import type { RendererModuleEditorProps } from '../../../types';
import Field from '../../../editor/common/field/index.vue';
import NumberEditor from '../../../editor/common/number/index.vue';
import ArrayEditor from '../../../editor/array/index.vue';
import { SECTION_ALIGNMENTS, toRecord } from '../../shared/utils';

const props = defineProps<RendererModuleEditorProps>();
const emit = defineEmits<{ 'update:modelValue': [value: Record<string, unknown>] }>();
const { t } = useLocale(computed(() => props.context?.locale));
const alignments = SECTION_ALIGNMENTS.map(value => ({ label: t(`renderer.editor.${value}`), value }));
const folds = computed(() => Array.isArray(props.modelValue.folds) ? props.modelValue.folds : []);
const highlightLines = computed(() => Array.isArray(props.modelValue.highlightLines) ? props.modelValue.highlightLines.join(', ') : '');
const lineCount = computed(() => String(props.modelValue.content || '').split('\n').length);
const createFold = () => ({ start: 1, end: lineCount.value, label: '' });
const update = (patch: Record<string, unknown>) => emit('update:modelValue', { ...props.modelValue, ...patch });
const updateHighlights = (value: string) => update({
	highlightLines: [...new Set(value.split(/[,，\s]+/u).map(Number).filter(line => Number.isInteger(line) && line > 0))]
});
</script>
