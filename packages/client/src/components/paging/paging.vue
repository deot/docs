<template>
	<div class="docs-paging">
		<PagingFilter
			v-if="filterModules.length"
			:modules="filterModules"
			@search="handleSearch"
			@reset="handleReset"
		/>
		<Table
			ref="table"
			class="docs-paging__table"
			:data="records"
			:loading="loading"
			v-bind="tableOptions"
			:affix="[affixOptions[0], false]"
		>
			<slot />
			<template v-if="$slots.empty" #empty>
				<slot name="empty" />
			</template>
			<template v-if="$slots.append" #append>
				<slot name="append" />
			</template>
		</Table>
		<Affix
			v-if="showPagination"
			ref="footerAffix"
			v-bind="affixOptions[1]"
		>
			<template #default>
				<footer
					class="docs-paging__pagination"
				>
					<slot
						name="footer-extra"
						:current="current"
						:page-size="pageSize"
						:total="total"
						:loading="loading"
					/>
					<div class="docs-paging__pagination-control">
						<Pagination
							:count="total"
							:current="current"
							:page-size="pageSize"
							:page-size-options="pageSizeOptions"
							show-count
							show-sizer
							show-elevator
							@change="handlePageChange"
							@page-size-change="handlePageSizeChange"
						/>
					</div>
				</footer>
			</template>
		</Affix>
	</div>
</template>
<script setup lang="ts" generic="T">
import { computed, nextTick, onMounted, ref } from 'vue';
import { Affix, Pagination, Table } from '@deot/vc';
import PagingFilter from './filter/index.vue';
import type {
	PagingAffix,
	PagingFilterModule,
	PagingKeywords,
	PagingListResult,
	PagingLoadData,
	PagingLoadResult,
	PagingPageResult
} from './types';

const props = withDefaults(defineProps<{
	loadData: PagingLoadData<T>;
	filterModules?: PagingFilterModule[];
	tableOptions?: Record<string, unknown>;
	defaultPageSize?: number;
	pageSizeOptions?: number[];
	showPagination?: boolean;
	affix?: PagingAffix;
}>(), {
	filterModules: () => [],
	tableOptions: () => ({}),
	defaultPageSize: 10,
	pageSizeOptions: () => [10, 20, 50],
	showPagination: true,
	affix: false
});
const emit = defineEmits<{
	'search': [keywords: PagingKeywords];
	'reset': [];
	'page-change': [current: number];
	'page-size-change': [pageSize: number];
	'loading-change': [loading: boolean];
	'load-error': [reason: unknown];
}>();
const records = ref<T[]>([]);
const keywords = ref<PagingKeywords>({});
const current = ref(1);
const pageSize = ref(props.defaultPageSize);
const total = ref(0);
const loading = ref(false);
const table = ref<{ refreshAffix?: () => void }>();
const footerAffix = ref<{ refresh?: () => void }>();
let requestId = 0;

const affixOptions = computed(() => {
	const source = Array.isArray(props.affix)
		? props.affix
		: [props.affix, props.affix];
	return source.map((item, index) => ({
		disabled: !item,
		placement: index === 0 ? 'top' : 'bottom',
		offset: 0,
		...(item && typeof item === 'object' ? item : {})
	}));
});
const refreshAffix = () => {
	void nextTick(() => {
		table.value?.refreshAffix?.();
		footerAffix.value?.refresh?.();
	});
};

const isPageResult = (value: unknown): value is PagingPageResult<T> => (
	!!value && typeof value === 'object' && Array.isArray((value as PagingPageResult<T>).records)
);
const isListResult = (value: unknown): value is PagingListResult<T> => (
	!!value && typeof value === 'object' && Array.isArray((value as PagingListResult<T>).list)
);
const unwrap = (value: PagingLoadResult<T>): Exclude<PagingLoadResult<T>, { data: unknown }> => (
	value && typeof value === 'object' && !Array.isArray(value) && 'data' in value
		? value.data
		: value
);
const normalize = (result: PagingLoadResult<T>) => {
	const value = unwrap(result);
	if (Array.isArray(value)) {
		const pages = Math.max(1, Math.ceil(value.length / pageSize.value));
		current.value = Math.min(current.value, pages);
		const start = (current.value - 1) * pageSize.value;
		return { records: value.slice(start, start + pageSize.value), total: value.length };
	}
	if (isPageResult(value)) {
		if (value.current) current.value = value.current;
		return { records: value.records, total: value.total };
	}
	if (isListResult(value)) {
		if (value.page.current) current.value = value.page.current;
		return { records: value.list, total: value.page.count };
	}
	throw new TypeError('Invalid Paging loadData result');
};
/**
 * 使用单调递增 ID，避免较慢的旧查询覆盖较新的数据。
 */
const load = async () => {
	const id = ++requestId;
	loading.value = true;
	emit('loading-change', true);
	try {
		const response = await props.loadData(current.value, pageSize.value, { ...keywords.value });
		if (id !== requestId) return;
		const result = normalize(response);
		records.value = result.records;
		total.value = result.total;
		refreshAffix();
	} catch (reason) {
		if (id === requestId) emit('load-error', reason);
	} finally {
		if (id === requestId) {
			loading.value = false;
			emit('loading-change', false);
		}
	}
};
const reset = async (toFirst = false) => {
	if (toFirst) current.value = 1;
	await load();
};
const getData = () => records.value;
const handleSearch = (value: PagingKeywords) => {
	keywords.value = value;
	current.value = 1;
	emit('search', value);
	void load();
};
const handleReset = () => {
	emit('reset');
};
const handlePageChange = (value: number) => {
	current.value = value;
	emit('page-change', value);
	void load();
};
const handlePageSizeChange = (value: number | string) => {
	// 分页组件或自定义替身可能返回字符串，统一转成有效数字后再参与切片计算。
	const nextPageSize = Number(value);
	if (!Number.isFinite(nextPageSize) || nextPageSize <= 0) return;
	pageSize.value = nextPageSize;
	current.value = 1;
	emit('page-size-change', nextPageSize);
	void load();
};

onMounted(() => void load());
defineExpose({ getData, load, reset, refreshAffix });
</script>
<style lang="scss">
@use '../../styles/bem' as *;

@include block(docs-paging) {
	@include element(table) {
		background: varfix(background-color);
	}

	@include element(pagination) {
		display: grid;
		grid-template-columns: minmax(0, 1fr) max-content;
		width: 100%;
		padding: 12px 8px 8px 0;
		background: varfix(background-color);
		align-items: center;
		gap: 16px;
	}

	@include element(pagination-control) {
		grid-column: 2;
		justify-self: end;
	}
}
</style>
