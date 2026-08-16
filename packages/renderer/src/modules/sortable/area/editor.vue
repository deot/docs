<template>
	<div class="docs-renderer-module-editor">
		<Field wide :label="t('renderer.editor.source')">
			<ImageSource
				:model-value="String(modelValue.src || '')"
				:placeholder="t('renderer.editor.sourceHint')"
				@update:model-value="value => update({ src: value })"
			/>
		</Field>
		<Field wide :label="t('renderer.editor.alt')">
			<Input :model-value="String(modelValue.alt || '')" @update:model-value="value => update({ alt: value })" />
		</Field>
		<Field wide :label="t('renderer.editor.areas')">
			<Button
				class="docs-renderer-area-editor__paint"
				:disabled="!String(modelValue.src || '').trim()"
				type="primary"
				@click="handlePaint"
			>
				{{ t('renderer.editor.paintAreas') }}
			</Button>
			<p class="docs-renderer-editor__sub">{{ t('renderer.editor.areaMax', { count: AREA_ZONE_MAX }) }}</p>
			<ArrayEditor
				:model-value="areas"
				:create-item="createItem"
				:max="AREA_ZONE_MAX"
				@update:model-value="value => update({ areas: value })"
			>
				<template #default="{ item, index, update: updateItem }">
					<div class="docs-renderer-module-editor__row">
						<strong>{{ labelOf(item, index) }}</strong>
						<Input
							:model-value="field(item, 'to')"
							:placeholder="t('renderer.editor.target')"
							@update:model-value="value => updateItem(patchItem(item, { to: value }))"
						/>
						<Input
							:model-value="field(item, 'label')"
							:placeholder="t('renderer.editor.label')"
							@update:model-value="value => updateItem(patchItem(item, { label: value }))"
						/>
					</div>
				</template>
			</ArrayEditor>
		</Field>
	</div>
</template>
<script setup lang="ts">
import { computed, onBeforeUnmount } from 'vue';
import { Button, Input, Message } from '@deot/vc';
import { useLocale } from '@deot/docs-locale';
import type { RendererModuleEditorProps } from '../../../types';
import ArrayEditor from '../../../editor/array/index.vue';
import Field from '../../../editor/common/field/index.vue';
import ImageSource from '../../../editor/common/image/index.vue';
import { resolveImageSource } from '../../shared/image-source';
import { toRecord } from '../../shared/utils';
import { createAreaPaintPortal } from './popup';
import {
	AREA_ZONE_MAX,
	createAreaZone,
	normalizeAreaZone,
	normalizeAreaZones,
	type RendererAreaZone
} from './zones';

const props = defineProps<RendererModuleEditorProps>();
const emit = defineEmits<{ 'update:modelValue': [value: Record<string, unknown>] }>();
const { t } = useLocale(computed(() => props.context.locale));
const paintPortal = createAreaPaintPortal();
let paintLeaf: { destroy: () => void } | undefined;
const areas = computed(() => normalizeAreaZones(props.modelValue.areas ?? props.modelValue.list));
const update = (patch: Record<string, unknown>) => emit('update:modelValue', { ...props.modelValue, ...patch });
const field = (item: unknown, key: string) => String(toRecord(item)[key] || '');
const patchItem = (item: unknown, patch: Record<string, unknown>) => ({ ...toRecord(item), ...patch });
const createItem = () => createAreaZone(areas.value.length);
const labelOf = (item: unknown, index: number) => {
	const label = field(item, 'label');
	return label || t('renderer.editor.areaItem', { index: index + 1 });
};
const handlePaint = async () => {
	const source = String(props.modelValue.src || '').trim();
	if (!source) {
		Message.warning(t('renderer.editor.areaNeedImage'));
		return;
	}
	let src: string | undefined;
	try {
		src = await resolveImageSource(
			source,
			props.context.services?.resolveAsset,
			props.context.source
		);
	} catch (reason) {
		Message.error(reason instanceof Error ? reason.message : String(reason));
		return;
	}
	if (!src) {
		Message.warning(t('renderer.editor.areaNeedImage'));
		return;
	}
	const request = paintPortal.popup({
		src,
		areas: areas.value
	});
	paintLeaf = request;
	try {
		const next = await request as RendererAreaZone[];
		if (Array.isArray(next)) update({ areas: next.map(normalizeAreaZone) });
	} catch {
		// 用户取消绘制热区时保留当前列表。
	} finally {
		paintLeaf = undefined;
	}
};
onBeforeUnmount(() => {
	paintLeaf?.destroy();
});
</script>
