<template>
	<div class="docs-renderer-module-editor">
		<Field wide :label="t('renderer.editor.mode')">
			<Select
				:model-value="layout.mode"
				:data="modes"
				@update:model-value="handleMode"
			/>
		</Field>
		<template v-if="layout.mode === 'sortable'">
			<Field :label="t('renderer.editor.canvasWidth')">
				<NumberEditor
					prefix="W"
					:model-value="layout.maxWidth"
					:min="320"
					:max="3840"
					@update:model-value="value => update({ maxWidth: value })"
				/>
			</Field>
			<Field :label="t('renderer.editor.minHeight')">
				<NumberEditor
					prefix="H"
					:model-value="layout.minHeight || 0"
					:min="0"
					:max="2000"
					@update:model-value="value => update({ minHeight: value })"
				/>
			</Field>
		</template>
		<template v-else>
			<Field :label="t('renderer.editor.canvasWidth')">
				<NumberEditor
					prefix="W"
					:model-value="layout.width"
					:min="320"
					:max="3840"
					@update:model-value="value => update({ width: value })"
				/>
			</Field>
			<Field :label="t('renderer.editor.canvasHeight')">
				<NumberEditor
					prefix="H"
					:model-value="layout.height"
					:min="320"
					:max="3840"
					@update:model-value="value => update({ height: value })"
				/>
			</Field>
		</template>
		<Field wide :label="t('renderer.editor.background')">
			<ColorPicker
				:model-value="layout.background"
				alpha
				@update:model-value="value => update({ background: value })"
			/>
		</Field>
	</div>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import { ColorPicker, Select } from '@deot/vc';
import { useLocale } from '@deot/docs-locale';
import type { RendererLayout, RendererModuleEditorProps } from '../../../types';
import { createRendererLayout } from '../../../document';
import Field from '../../../editor/common/field/index.vue';
import NumberEditor from '../../../editor/common/number/index.vue';

const props = defineProps<RendererModuleEditorProps>();
const emit = defineEmits<{ 'update:modelValue': [value: RendererLayout] }>();
const { t } = useLocale(computed(() => props.context?.locale));
const layout = computed(() => {
	const value = props.modelValue as Partial<RendererLayout> | undefined;
	if (value?.mode === 'draggable' || value?.mode === 'sortable') return value as RendererLayout;
	return createRendererLayout('sortable', value as RendererLayout | undefined);
});
const modes = computed(() => [
	{ label: t('renderer.editor.sortable'), value: 'sortable' },
	{ label: t('renderer.editor.draggable'), value: 'draggable' }
]);
const update = (patch: Record<string, unknown>) => {
	const next = { ...layout.value, ...patch } as RendererLayout;
	if (next.mode === 'sortable' && !(next.minHeight && next.minHeight > 0)) {
		delete next.minHeight;
	}
	emit('update:modelValue', next);
};
const handleMode = (mode: string) => {
	if (mode !== 'sortable' && mode !== 'draggable') return;
	if (mode === layout.value.mode) return;
	emit('update:modelValue', createRendererLayout(mode, layout.value));
};
</script>
