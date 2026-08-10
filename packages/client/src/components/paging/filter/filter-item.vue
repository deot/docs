<template>
	<div class="docs-paging-filter-item">
		<span v-if="module.label" class="docs-paging-filter-item__label">
			{{ module.label }}
		</span>
		<div v-if="module.type === 'range'" class="docs-paging-filter-item__range">
			<InputNumber
				:model-value="getNumberValue(startValue)"
				:data-filter="module.field[0]"
				:placeholder="getRangePlaceholder(0)"
				v-bind="module.options"
				@update:model-value="handleStartValueUpdate"
				@enter="handleSearch"
			/>
			<span class="docs-paging-filter-item__separator">{{ module.separator || '-' }}</span>
			<InputNumber
				:model-value="getNumberValue(endValue)"
				:data-filter="module.field[1]"
				:placeholder="getRangePlaceholder(1)"
				v-bind="module.options"
				@update:model-value="handleEndValueUpdate"
				@enter="handleSearch"
			/>
		</div>
		<Input
			v-else-if="module.type === 'input'"
			:model-value="getTextValue(modelValue)"
			:data-filter="module.field"
			clearable
			:placeholder="module.placeholder || 'Enter'"
			v-bind="module.options"
			@update:model-value="handleModelValueUpdate"
			@change="handleInputChange"
			@enter="handleSearch"
		/>
		<Select
			v-else-if="module.type === 'select'"
			:model-value="getTextValue(modelValue)"
			:data-filter="module.field"
			:data="module.data || []"
			clearable
			:placeholder="module.placeholder || 'Select'"
			v-bind="module.options"
			@update:model-value="handleModelValueUpdate"
			@change="handleImmediateChange"
		/>
		<DatePicker
			v-else
			:model-value="getDateValue(modelValue)"
			:data-filter="module.field"
			:confirm="false"
			clearable
			:placeholder="module.placeholder || 'Pick date'"
			v-bind="module.options"
			@update:model-value="handleModelValueUpdate"
			@change="handleImmediateChange"
			@ok="handleSearch"
		/>
	</div>
</template>
<script setup lang="ts">
import { DatePicker, Input, InputNumber, Select } from '@deot/vc';
import type { PagingFilterModule, PagingFilterValue } from '../types';

const props = defineProps<{
	module: PagingFilterModule;
	modelValue?: PagingFilterValue;
	startValue?: PagingFilterValue;
	endValue?: PagingFilterValue;
}>();
const emit = defineEmits<{
	'update:modelValue': [value: PagingFilterValue];
	'update:startValue': [value: PagingFilterValue];
	'update:endValue': [value: PagingFilterValue];
	'search': [];
}>();

const getTextValue = (value?: PagingFilterValue): string | number | unknown[] | undefined => (
	value instanceof Date || value == null ? undefined : value
);
const getNumberValue = (value?: PagingFilterValue): string | number | unknown[] | undefined => (
	value instanceof Date || value == null ? undefined : value
);
const getDateValue = (value?: PagingFilterValue): string | unknown[] | Date | undefined => (
	typeof value === 'number' || value == null ? undefined : value
);
const getRangePlaceholder = (index: number) => {
	const placeholder = props.module.placeholder;
	return Array.isArray(placeholder) ? placeholder[index] : (placeholder || (index ? 'Max' : 'Min'));
};
const handleModelValueUpdate = (value: PagingFilterValue) => {
	emit('update:modelValue', value);
};
const handleStartValueUpdate = (value: PagingFilterValue) => {
	emit('update:startValue', value);
};
const handleEndValueUpdate = (value: PagingFilterValue) => {
	emit('update:endValue', value);
};
const handleSearch = () => {
	emit('search');
};
const handleInputChange = (value: PagingFilterValue) => {
	emit('update:modelValue', value);
	if (value === '' || value == null) emit('search');
};
const handleImmediateChange = (value: PagingFilterValue) => {
	emit('update:modelValue', value);
	emit('search');
};
</script>
<style lang="scss">
@use '../../../styles/bem' as *;

@include block(docs-paging-filter-item) {
	display: grid;
	grid-template-columns: max-content minmax(0, 1fr);
	height: 32px;
	min-width: 220px;
	background: #f2f3f5;
	border-radius: 8px;
	align-items: center;

	@include element(label) {
		padding: 0 12px;
		line-height: 32px;
		color: #4e5969;
		white-space: nowrap;
	}

	@include element(range) {
		display: grid;
		grid-template-columns: minmax(72px, 1fr) max-content minmax(72px, 1fr);
		align-items: center;
	}

	@include element(separator) {
		padding: 0 6px;
		color: #86909c;
	}

	.vc-input,
	.vc-input-number,
	.vc-select,
	.vc-date-picker {
		width: 100%;
		background: #f2f3f5;
	}

	.vc-input {
		&::before,
		&::after {
			border: 0;
		}

		&.is-focus {
			box-shadow: none;
		}
	}
}
</style>
