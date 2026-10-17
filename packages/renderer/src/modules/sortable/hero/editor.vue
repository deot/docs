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
			<Select :model-value="String(modelValue.align || 'left')" :data="alignments" @update:model-value="value => update({ align: value })" />
		</Field>
		<Field :label="t('renderer.editor.minHeight')">
			<NumberEditor
				:model-value="Number(modelValue.minHeight ?? 420)"
				:min="0"
				:max="960"
				@update:model-value="value => update({ minHeight: value })"
			/>
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
		<Field :label="t('renderer.editor.background')">
			<ColorPicker
				:model-value="String(modelValue.background || '')"
				alpha
				@update:model-value="value => update({ background: value })"
			/>
		</Field>
		<Field :label="t('renderer.editor.showVisual')">
			<Switch :model-value="modelValue.showVisual !== false" @update:model-value="value => update({ showVisual: value })" />
		</Field>
		<template v-if="modelValue.showVisual !== false">
			<Field :label="t('renderer.editor.visualType')">
				<Select :model-value="visual.type" :data="visualTypes" @update:model-value="value => updateVisual({ type: value })" />
			</Field>
			<Field :label="t('renderer.editor.visualTitle')">
				<Input :model-value="visual.title" @update:model-value="value => updateVisual({ title: value })" />
			</Field>
			<Field v-if="visual.type === 'code'" wide :label="t('renderer.editor.visualLanguage')">
				<Input
					:model-value="visual.language"
					placeholder="typescript / javascript / json / html / css / bash"
					@update:model-value="value => updateVisual({ language: value })"
				/>
			</Field>
			<Field wide :label="t('renderer.editor.visualContent')">
				<Textarea :model-value="visual.content" :rows="10" @update:model-value="value => updateVisual({ content: value })" />
			</Field>
		</template>
		<Field wide :label="t('renderer.editor.highlights')">
			<ArrayEditor
				:model-value="highlights"
				:create-item="createHighlight"
				:max="6"
				@update:model-value="value => update({ highlights: value })"
			>
				<template #default="{ item, update: updateItem }">
					<div class="docs-renderer-module-editor__row docs-renderer-module-editor__row--split">
						<Input
							:model-value="field(item, 'value')"
							:placeholder="t('renderer.editor.value')"
							@update:model-value="value => updateItem(patchItem(item, { value }))"
						/>
						<Input
							:model-value="field(item, 'label')"
							:placeholder="t('renderer.editor.label')"
							@update:model-value="value => updateItem(patchItem(item, { label: value }))"
						/>
					</div>
					<ColorPicker
						:model-value="field(item, 'color')"
						alpha
						@update:model-value="value => updateItem(patchItem(item, { color: value }))"
					/>
				</template>
			</ArrayEditor>
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
import { ColorPicker, Input, Select, Switch, Textarea } from '@deot/vc';
import { useLocale } from '@deot/docs-locale';
import type { RendererModuleEditorProps } from '../../../types';
import ActionsEditor from '../../shared/actions/editor.vue';
import ArrayEditor from '../../../editor/array/index.vue';
import Field from '../../../editor/common/field/index.vue';
import NumberEditor from '../../../editor/common/number/index.vue';
import { SECTION_ALIGNMENTS, toRecord } from '../../shared/utils';
import { HERO_VISUAL_TYPES, normalizeHeroVisual } from './visual';

const props = defineProps<RendererModuleEditorProps>();
const emit = defineEmits<{ 'update:modelValue': [value: Record<string, unknown>] }>();
const { t } = useLocale(computed(() => props.context?.locale));
const alignments = SECTION_ALIGNMENTS.map(value => ({ label: t(`renderer.editor.${value}`), value }));
const visualTypes = HERO_VISUAL_TYPES.map(value => ({ label: t(`renderer.editor.visual${value === 'code' ? 'Code' : 'Markdown'}`), value }));
const visual = computed(() => normalizeHeroVisual(props.modelValue.visual));
const actionsValue = computed(() => ({ items: Array.isArray(props.modelValue.actions) ? props.modelValue.actions : [] }));
const highlights = computed(() => (Array.isArray(props.modelValue.highlights) ? props.modelValue.highlights : []).map(toRecord));
const createHighlight = () => ({ value: '99', label: 'Label', color: '' });
const field = (item: unknown, key: string) => String(toRecord(item)[key] || '');
const patchItem = (item: unknown, patch: Record<string, unknown>) => ({ ...toRecord(item), ...patch });
const update = (patch: Record<string, unknown>) => emit('update:modelValue', { ...props.modelValue, ...patch });
const updateVisual = (patch: Record<string, unknown>) => update({ visual: { ...visual.value, ...patch } });
</script>
