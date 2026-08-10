<template>
	<div class="docs-paging-filter">
		<FilterItem
			v-for="module in modules"
			:key="getModuleKey(module)"
			:module="module"
			:model-value="getCommonValue(module)"
			:start-value="getRangeValue(module, 0)"
			:end-value="getRangeValue(module, 1)"
			@update:model-value="handleCommonValueUpdate(module, $event)"
			@update:start-value="handleRangeValueUpdate(module, 0, $event)"
			@update:end-value="handleRangeValueUpdate(module, 1, $event)"
			@search="handleSearch"
		/>
		<div class="docs-paging-filter__operate">
			<Button type="primary" @click="handleSearch">Search</Button>
			<Button @click="handleReset">Reset</Button>
		</div>
	</div>
</template>
<script setup lang="ts">
import { reactive, watch } from 'vue';
import { Button } from '@deot/vc';
import FilterItem from './filter-item.vue';
import type {
	PagingFilterModule,
	PagingFilterValue,
	PagingKeywords
} from '../types';

const props = defineProps<{ modules: PagingFilterModule[] }>();
const emit = defineEmits<{
	search: [keywords: PagingKeywords];
	reset: [keywords: PagingKeywords];
}>();
const keywords = reactive<PagingKeywords>({});

const cloneValue = (value: PagingFilterValue) => (
	Array.isArray(value) ? [...value] : value
);
const defaultValue = (module: PagingFilterModule, index?: number) => {
	if (module.type === 'range') return cloneValue(module.defaultValue?.[index || 0]);
	return cloneValue(module.defaultValue);
};
const initialize = () => {
	const activeFields = new Set(props.modules.flatMap(module => (
		Array.isArray(module.field) ? module.field : [module.field]
	)));
	// 筛选模块允许运行时变化；同步移除失效值，避免隐藏筛选项继续影响查询。
	Object.keys(keywords).forEach((field) => {
		if (!activeFields.has(field)) delete keywords[field];
	});
	props.modules.forEach((module) => {
		const fields = Array.isArray(module.field) ? module.field : [module.field];
		fields.forEach((field, index) => {
			if (!(field in keywords)) keywords[field] = defaultValue(module, index);
		});
	});
};
watch(() => props.modules, initialize, { immediate: true, deep: true });

const snapshot = (): PagingKeywords => Object.fromEntries(
	Object.entries(keywords).map(([key, value]) => [key, cloneValue(value)])
);
const getModuleKey = (module: PagingFilterModule) => (
	Array.isArray(module.field) ? module.field.join(':') : module.field
);
const getCommonValue = (module: PagingFilterModule) => (
	module.type === 'range' ? undefined : keywords[module.field]
);
const handleCommonValueUpdate = (module: PagingFilterModule, value: PagingFilterValue) => {
	if (module.type !== 'range') keywords[module.field] = value;
};
const getRangeValue = (module: PagingFilterModule, index: number) => (
	module.type === 'range' ? keywords[module.field[index]] : undefined
);
const handleRangeValueUpdate = (module: PagingFilterModule, index: number, value: PagingFilterValue) => {
	if (module.type === 'range') keywords[module.field[index]] = value;
};
const handleSearch = () => emit('search', snapshot());
const handleReset = () => {
	props.modules.forEach((module) => {
		const fields = Array.isArray(module.field) ? module.field : [module.field];
		fields.forEach((field, index) => {
			keywords[field] = defaultValue(module, index);
		});
	});
	const value = snapshot();
	emit('reset', value);
	emit('search', value);
};
</script>
<style lang="scss">
@use '../../../styles/bem' as *;

@include block(docs-paging-filter) {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
	margin-bottom: 17px;
	align-items: center;
	gap: 16px;

	@include element(operate) {
		display: grid;
		grid-auto-flow: column;
		grid-auto-columns: max-content;
		justify-content: end;
		gap: 8px;
	}
}
</style>
