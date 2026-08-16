<template>
	<div
		class="docs-renderer-number-editor"
		:class="{ 'has-slider': showSlider, 'has-prefix': Boolean(prefix) }"
		:title="title"
	>
		<Slider
			v-if="showSlider"
			:model-value="normalizedValue"
			:min="min"
			:max="max"
			:step="step"
			:show-tip="showTip"
			class="docs-renderer-number-editor__slider"
			@update:model-value="handleChange"
		/>
		<div class="docs-renderer-number-editor__box">
			<span v-if="prefix" class="docs-renderer-number-editor__prefix">{{ prefix }}</span>
			<InputNumber
				:model-value="normalizedValue"
				:min="min"
				:max="max"
				:step="step"
				:precision="precision"
				:null-value="min"
				class="docs-renderer-number-editor__input"
				@update:model-value="handleChange"
			/>
		</div>
	</div>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import { InputNumber, Slider } from '@deot/vc';

const props = withDefaults(defineProps<{
	modelValue: number;
	min?: number;
	max?: number;
	step?: number;
	showTip?: 'hover' | 'always' | 'never';
	showSlider?: boolean;
	prefix?: string;
	title?: string;
	precision?: number;
}>(), {
	min: 0,
	max: 100,
	step: 1,
	showTip: 'hover',
	showSlider: false,
	prefix: '',
	title: '',
	precision: 2
});
const emit = defineEmits<{ 'update:modelValue': [value: number] }>();
const roundValue = (value: number) => Number(value.toFixed(Math.max(0, props.precision)));
const toFiniteNumber = (value: unknown) => {
	const number = Number(value);
	return Number.isFinite(number) ? number : 0;
};
const clampValue = (value: number) => roundValue(Math.min(props.max, Math.max(props.min, value)));
const normalizedValue = computed(() => clampValue(toFiniteNumber(props.modelValue)));

/**
 * Slider 和数值输入共用同一入口，避免两种交互产生不同的边界行为。
 * 清空（`undefined` / `null` / `''`）按最小值处理，铺满时最大宽度清空才和 `0` 等价。
 * @param value 控件产生的候选数值。
 */
const handleChange = (value: number | string | null | undefined) => {
	if (value === '' || value === null || typeof value === 'undefined') {
		emit('update:modelValue', clampValue(props.min));
		return;
	}
	const number = Number(value);
	if (!Number.isFinite(number)) return;
	emit('update:modelValue', clampValue(number));
};
</script>
