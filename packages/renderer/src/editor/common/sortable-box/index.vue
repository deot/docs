<template>
	<div class="docs-renderer-sortable-box">
		<Field :label="t('renderer.inspector.fullWidth')" inline>
			<Switch :model-value="fill" @update:model-value="patchFill" />
		</Field>
		<Field :label="t('renderer.editor.maxWidth')">
			<NumberEditor
				prefix="W"
				:model-value="assignedWidth"
				:min="0"
				:max="3840"
				@update:model-value="patchWidth"
			/>
		</Field>
	</div>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import { Switch } from '@deot/vc';
import { useLocale } from '@deot/docs-locale';
import type {
	RendererSortableAppearance,
	RendererSortableCapability
} from '../../../types';
import {
	rendererSortableAssignedWidth,
	rendererSortableFillsCanvas
} from '../../../frame/shared/sortable-width';
import Field from '../field/index.vue';
import NumberEditor from '../number/index.vue';

const props = defineProps<{
	appearance?: RendererSortableAppearance;
	capability?: RendererSortableCapability;
}>();
const emit = defineEmits<{ 'update:appearance': [value: Partial<RendererSortableAppearance>] }>();
const { t } = useLocale();
const fill = computed(() => rendererSortableFillsCanvas(props.capability, props.appearance));
const assignedWidth = computed(() => rendererSortableAssignedWidth(props.appearance) || 0);
const patch = (value: Partial<RendererSortableAppearance>) => emit('update:appearance', value);
const patchFill = (value: boolean) => {
	const assigned = rendererSortableAssignedWidth(props.appearance);
	patch({
		fullWidth: value,
		maxWidth: typeof assigned === 'number' ? assigned : 0
	});
};
const patchWidth = (value: number) => patch({ maxWidth: value > 0 ? value : 0 });
</script>
