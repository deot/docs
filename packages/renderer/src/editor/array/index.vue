<template>
	<div class="docs-renderer-array-editor">
		<SortList
			:model-value="rows"
			:draggable="reorderable"
			:mask="false"
			primary-key="id"
			class="docs-renderer-array-editor__list"
			@change="handleSort"
		>
			<template #default="{ row, index }">
				<div class="docs-renderer-array-editor__item">
					<div class="docs-renderer-array-editor__content">
						<slot :item="row.value" :index="index" :update="value => handleUpdate(row.id, value)" />
					</div>
					<button
						type="button"
						class="docs-renderer-array-editor__remove"
						:disabled="deletable === false || rows.length <= min"
						:title="t('renderer.editor.removeItem')"
						:aria-label="t('renderer.editor.removeItem')"
						@click.stop="handleRemove(row.id)"
					/>
				</div>
			</template>
		</SortList>
		<Button class="docs-renderer-array-editor__add" :disabled="rows.length >= max" @click="handleAdd">
			{{ t('renderer.editor.addItem') }}
		</Button>
	</div>
</template>
<script setup lang="ts">
import { ref, watch } from 'vue';
import { Button, SortList } from '@deot/vc';
import { useLocale } from '@deot/docs-locale';
import { createRendererId } from '../../utils/id';

interface ArrayEditorRow {
	id: string;
	value: unknown;
}

const props = withDefaults(defineProps<{
	modelValue: unknown[];
	createItem: () => unknown;
	itemKey?: string | ((item: unknown, index: number) => string);
	min?: number;
	max?: number;
	deletable?: boolean;
	reorderable?: boolean;
}>(), {
	min: 0,
	max: Number.POSITIVE_INFINITY,
	deletable: true,
	reorderable: true
});
const emit = defineEmits<{ 'update:modelValue': [value: unknown[]] }>();
const { t } = useLocale();
const rows = ref<ArrayEditorRow[]>([]);

const resolveItemKey = (item: unknown, index: number) => {
	if (typeof props.itemKey === 'function') return props.itemKey(item, index);
	if (props.itemKey && item && typeof item === 'object') {
		const value = (item as Record<string, unknown>)[props.itemKey];
		if (typeof value === 'string' || typeof value === 'number') return String(value);
	}
};

/**
 * UI 稳定 ID 只存在于编辑器行中，不写入业务 JSON。
 * @param value 最新业务数组。
 */
const syncRows = (value: unknown[]) => {
	const previous = [...rows.value];
	const used = new Set<string>();
	rows.value = value.map((item, index) => {
		const key = resolveItemKey(item, index);
		const matched = key
			? previous.find(row => !used.has(row.id) && resolveItemKey(row.value, index) === key)
			: previous[index];
		const id = matched?.id || createRendererId();
		used.add(id);
		return { id, value: item };
	});
};

const emitRows = (value: ArrayEditorRow[]) => emit('update:modelValue', value.map(row => row.value));
const handleUpdate = (id: string, value: unknown) => {
	rows.value = rows.value.map(row => row.id === id ? { ...row, value } : row);
	emitRows(rows.value);
};
const handleAdd = () => {
	if (rows.value.length >= props.max) return;
	rows.value = [...rows.value, { id: createRendererId(), value: props.createItem() }];
	emitRows(rows.value);
};
const handleRemove = (id: string) => {
	if (props.deletable === false || rows.value.length <= props.min) return;
	rows.value = rows.value.filter(row => row.id !== id);
	emitRows(rows.value);
};
const handleSort = (value: ArrayEditorRow[]) => {
	rows.value = value;
	emitRows(value);
};

watch(() => props.modelValue, syncRows, { immediate: true });
</script>
<style lang="scss">
@use '../../../node_modules/@deot/docs-theme/src/functions' as *;

.docs-renderer-array-editor {
	display: grid;
	grid-column: 1 / -1;
	gap: 8px;
	min-width: 0;

	&__list,
	&__list > .vc-transition-fade {
		display: grid;
		gap: 8px;
	}

	&__item {
		position: relative;
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		padding: 10px 8px;
		background: varfix(background-color);
		border: 1px dashed varfix(border-color);
		border-radius: 4px;
	}

	&__remove {
		position: absolute;
		top: -9px;
		right: -9px;
		z-index: 1;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 20px;
		height: 20px;
		padding: 0;
		margin: 0;
		color: varfix(foreground-color-mute);
		cursor: pointer;
		background: varfix(background-color);
		border: 1px solid varfix(border-color);
		border-radius: 50%;
		appearance: none;

		&::before,
		&::after {
			position: absolute;
			top: 50%;
			left: 50%;
			width: 8px;
			height: 1.5px;
			background: currentcolor;
			border-radius: 1px;
			content: '';
		}

		&::before {
			transform: translate(-50%, -50%) rotate(45deg);
		}

		&::after {
			transform: translate(-50%, -50%) rotate(-45deg);
		}

		&:hover:not(:disabled) {
			color: #fff;
			background: varfix(error-color);
			border-color: varfix(error-color);
		}

		&:disabled {
			cursor: not-allowed;
			opacity: 0.45;
		}
	}

	&__content,
	.docs-renderer-module-editor__row {
		display: grid;
		gap: 6px;
		min-width: 0;
	}

	.docs-renderer-module-editor__row--split {
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
	}

	&__add {
		width: 100%;
		min-height: 28px;
		color: varfix(primary-color);
		background: varfix(background-color-soft);
		border-style: dashed;
	}
}
</style>
