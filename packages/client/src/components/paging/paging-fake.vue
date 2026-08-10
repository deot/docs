<template>
	<Paging
		ref="paging"
		:load-data="loadData"
		:filter-modules="filterModules"
		:table-options="tableOptions"
		:default-page-size="defaultPageSize"
		:page-size-options="pageSizeOptions"
		:show-pagination="showPagination"
		:affix="affix"
		v-bind="$attrs"
	>
		<slot />
		<template v-if="$slots.empty" #empty>
			<slot name="empty" />
		</template>
		<template v-if="$slots.append" #append>
			<slot name="append" />
		</template>
		<template v-if="$slots['footer-extra']" #footer-extra="options">
			<slot name="footer-extra" v-bind="options" />
		</template>
	</Paging>
</template>
<script setup lang="ts" generic="T">
import { ref, watch } from 'vue';
import Paging from './paging.vue';
import type { PagingAffix, PagingExpose, PagingFilterModule, PagingKeywords } from './types';

defineOptions({ inheritAttrs: false });
const props = withDefaults(defineProps<{
	data: T[];
	filterModules?: PagingFilterModule[];
	filter?: (row: T, keywords: PagingKeywords) => boolean;
	tableOptions?: Record<string, unknown>;
	defaultPageSize?: number;
	pageSizeOptions?: number[];
	showPagination?: boolean;
	affix?: PagingAffix;
}>(), {
	filterModules: () => [],
	filter: undefined,
	tableOptions: () => ({}),
	defaultPageSize: 10,
	pageSizeOptions: () => [10, 20, 50],
	showPagination: true,
	affix: false
});
const paging = ref<PagingExpose<T>>();
const loadData = (_page: number, _pageSize: number, keywords: PagingKeywords) => (
	props.filter ? props.data.filter(row => props.filter!(row, keywords)) : props.data
);

watch(() => props.data, () => void paging.value?.reset(), { deep: true });
defineExpose({
	getData: () => paging.value?.getData(),
	load: () => paging.value?.load(),
	reset: (toFirst = false) => paging.value?.reset(toFirst),
	refreshAffix: () => paging.value?.refreshAffix()
});
</script>
