<template>
	<section class="docs-database">
		<header class="docs-database__header">
			<div>
				<h1>IndexedDB Resources</h1>
				<p>
					deot-docs / resources · {{ records.length }} records
					· <span :title="currentNamespace">{{ currentNamespace }}</span>
					cache {{ namespaceCacheSize }}
				</p>
			</div>
			<div class="docs-database__toolbar">
				<div class="docs-database__toolbar-primary">
					<Popover trigger="click" placement="bottom-right">
						<Button type="primary" :disabled="loading">Columns</Button>
						<template #content>
							<div class="docs-database__columns">
								<Checkbox
									v-for="item in optionalColumns"
									:key="item.value"
									:model-value="isColumnVisible(item.value)"
									:label="item.label"
									@change="handleColumnChange(item.value, $event)"
								/>
							</div>
						</template>
					</Popover>
					<Button type="primary" :disabled="loading" @click="handleRefresh">
						Refresh
					</Button>
					<Button
						type="primary"
						:disabled="loading || !records.length"
						@click="handleReloadAll"
					>
						Update all
					</Button>
					<Button type="primary" :disabled="loading" @click="handlePrefetch">
						Prefetch
					</Button>
				</div>
				<div class="docs-database__toolbar-danger">
					<Button type="error" :disabled="loading || !records.length" @click="handleClearAll">
						Clear
					</Button>
					<Button type="error" :disabled="loading || !records.length" @click="handlePrune">
						Prune
					</Button>
				</div>
			</div>
		</header>

		<Paging
			ref="paging"
			:load-data="loadData"
			:filter-modules="filterModules"
			:table-options="tableOptions"
			:default-page-size="20"
			:affix="true"
		>
			<TableColumn label="URL" :min-width="260" fixed="left">
				<template #default="{ row }">
					<span class="docs-database__ellipsis" :title="row.url">{{ row.url }}</span>
				</template>
			</TableColumn>
			<TableColumn v-if="isColumnVisible('source')" label="Source" :min-width="190">
				<template #default="{ row }">
					<span class="docs-database__ellipsis" :title="row.identity.source">{{ row.identity.source }}</span>
				</template>
			</TableColumn>
			<TableColumn label="Content Status" :width="130" align="center">
				<template #default="{ row }">
					<Popover :disabled="row.status !== 'error'" placement="top">
						<Tag :type="row.status">{{ getStatusLabel(row.status) }}</Tag>
						<template #content>{{ getErrorReason(row) }}</template>
					</Popover>
				</template>
			</TableColumn>
			<TableColumn label="Request Status" :width="135" align="center">
				<template #default="{ row }">
					<Popover :disabled="row.requestStatus !== 'error'" placement="top">
						<Tag :type="row.requestStatus">{{ getStatusLabel(row.requestStatus) }}</Tag>
						<template #content>{{ getErrorReason(row) }}</template>
					</Popover>
				</template>
			</TableColumn>
			<TableColumn v-if="isColumnVisible('namespace')" label="Namespace" :min-width="150">
				<template #default="{ row }">{{ row.identity.namespace }}</template>
			</TableColumn>
			<TableColumn v-if="isColumnVisible('language')" label="Language" :width="100">
				<template #default="{ row }">{{ row.identity.lang }}</template>
			</TableColumn>
			<TableColumn v-if="isColumnVisible('type')" label="Type" :width="90">
				<template #default="{ row }">{{ row.identity.type }}</template>
			</TableColumn>
			<TableColumn v-if="isColumnVisible('hash')" label="Hash" :width="110">
				<template #default="{ row }">{{ row.hash || '-' }}</template>
			</TableColumn>
			<TableColumn v-if="isColumnVisible('content')" label="Content" :width="100">
				<template #default="{ row }">{{ formatSize(row.content) }}</template>
			</TableColumn>
			<TableColumn label="Updated" :min-width="170">
				<template #default="{ row }">{{ formatTime(row.updatedAt) }}</template>
			</TableColumn>
			<TableColumn label="Checked" :min-width="170">
				<template #default="{ row }">{{ formatTime(row.checkedAt) }}</template>
			</TableColumn>
			<TableColumn label="Accessed" :min-width="170">
				<template #default="{ row }">{{ formatTime(row.accessedAt) }}</template>
			</TableColumn>
			<TableColumn label="Previous" :width="90" align="center">
				<template #default="{ row }">{{ row.previous ? 'Yes' : '-' }}</template>
			</TableColumn>
			<TableColumn label="Actions" :width="190" align="center" fixed="right">
				<template #default="{ row }">
					<div class="docs-database__actions">
						<Button
							class="docs-database__action"
							type="text"
							:disabled="loading || busyKeys.has(getKey(row))"
							@click="handleReload(row)"
						>
							Update
						</Button>
						<Button
							class="docs-database__action"
							type="text"
							:disabled="loading || busyKeys.has(getKey(row))"
							@click="handleRemove(row)"
						>
							Delete
						</Button>
					</div>
				</template>
			</TableColumn>
		</Paging>
	</section>
</template>
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { Button, Checkbox, Message, Popover, TableColumn } from '@deot/vc';
import * as api from './api';
import { Paging } from '../../components/paging';
import { Tag } from '../../components/tag';
import type {
	PagingExpose,
	PagingFilterModule,
	PagingKeywords,
	PagingLoadData
} from '../../components/paging';
import { getDocsNamespace, resourceIdentityKey } from '../../utils/resolver';
import { getDocsConfig } from '../../utils/runtime';
import { Gateway } from '../../modules';
import type { ResourceRecord, ResourceStatus } from '../../modules';

const records = ref<ResourceRecord[]>([]);
const paging = ref<PagingExpose<ResourceRecord>>();
const loadingCount = ref(0);
const loading = computed(() => loadingCount.value > 0);
const busyKeys = ref(new Set<string>());
const tableOptions = { class: 'docs-database__table', rowHeight: 52, border: true };
const optionalColumns = [
	{ label: 'Source', value: 'source' },
	{ label: 'Namespace', value: 'namespace' },
	{ label: 'Language', value: 'language' },
	{ label: 'Type', value: 'type' },
	{ label: 'Hash', value: 'hash' },
	{ label: 'Content', value: 'content' }
] as const;
type OptionalColumn = typeof optionalColumns[number]['value'];
const visibleColumns = ref<OptionalColumn[]>([]);
const STATUS = {
	WAITING: 'WAITING',
	PENDING: 'PENDING',
	SUCCESS: 'SUCCESS',
	ERROR: 'ERROR'
} as const;
const STATUS_VALUES: Record<keyof typeof STATUS, ResourceStatus> = {
	WAITING: 'waiting',
	PENDING: 'pending',
	SUCCESS: 'success',
	ERROR: 'error'
};
const STATUS_OPTIONS = (Object.keys(STATUS) as Array<keyof typeof STATUS>)
	.map(key => ({ label: STATUS[key], value: STATUS_VALUES[key] }));
const getStatusLabel = (status: ResourceStatus) => (
	STATUS[status.toUpperCase() as keyof typeof STATUS]
);
const currentNamespace = getDocsNamespace(getDocsConfig());
const getTextBytes = (content: string) => new TextEncoder().encode(content).length;
const getRecordBytes = (record: ResourceRecord) => getTextBytes(JSON.stringify(record));
const formatBytes = (bytes: number) => {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};
const namespaceCacheSize = computed(() => formatBytes(
	records.value.reduce((total, record) => (
		record.identity.namespace === currentNamespace
			? total + getRecordBytes(record)
			: total
	), 0)
));

const createOptions = (values: string[]) => [...new Set(values)]
	.sort()
	.map(value => ({ label: value, value }));
const typeOptions = computed(() => createOptions(records.value.map(record => record.identity.type)));
const languageOptions = computed(() => createOptions(records.value.map(record => record.identity.lang)));
const filterModules = computed<PagingFilterModule[]>(() => [
	{
		type: 'input',
		field: 'source',
		label: 'Source',
		placeholder: 'Source'
	},
	{
		type: 'select',
		field: 'type',
		label: 'Type',
		placeholder: 'Type',
		data: typeOptions.value
	},
	{
		type: 'select',
		field: 'language',
		label: 'Language',
		placeholder: 'Language',
		data: languageOptions.value
	},
	{
		type: 'select',
		field: 'status',
		label: 'Content Status',
		placeholder: 'Content Status',
		data: STATUS_OPTIONS
	},
	{
		type: 'select',
		field: 'requestStatus',
		label: 'Request Status',
		placeholder: 'Request Status',
		data: STATUS_OPTIONS
	}
]);
const filterRecord = (record: ResourceRecord, keywords: PagingKeywords) => {
	const source = String(keywords.source || '').trim().toLowerCase();
	const type = String(keywords.type || '');
	const language = String(keywords.language || '');
	const status = String(keywords.status || '');
	const requestStatus = String(keywords.requestStatus || '');
	return (!source || record.identity.source.toLowerCase().includes(source))
		&& (!type || record.identity.type === type)
		&& (!language || record.identity.lang === language)
		&& (!status || record.status === status)
		&& (!requestStatus || record.requestStatus === requestStatus);
};
// 状态驱动的表格刷新可能与工具栏操作重叠。使用计数器保持控件禁用，
// 直到所有操作结束，无需再维护第二个 loading 标记。
const beginLoading = () => {
	loadingCount.value += 1;
};
const endLoading = () => {
	loadingCount.value = Math.max(0, loadingCount.value - 1);
};
let listRequestId = 0;
const loadData: PagingLoadData<ResourceRecord> = async (_page, _pageSize, keywords) => {
	const requestId = ++listRequestId;
	beginLoading();
	try {
		const nextRecords = await api.getList();
		// Paging 会自行丢弃过期表格响应；共享完整列表也需要防护，
		// 避免缓存大小和筛选选项回退到旧快照。
		if (requestId === listRequestId) records.value = nextRecords;
		return nextRecords.filter(record => filterRecord(record, keywords));
	} catch (reason) {
		if (requestId === listRequestId) Message.error(getErrorMessage(reason, 'Load failed'));
		return [];
	} finally {
		endLoading();
	}
};

const getKey = (record: ResourceRecord) => resourceIdentityKey(record.identity);
const formatTime = (value?: number) => value
	? new Date(value).toLocaleString()
	: '-';
const formatSize = (value?: string) => {
	if (typeof value !== 'string') return '-';
	return formatBytes(getTextBytes(value));
};
const getErrorReason = (record: ResourceRecord) => (
	record.reason || 'Resource request failed'
);
const isColumnVisible = (column: OptionalColumn) => visibleColumns.value.includes(column);
const handleColumnChange = (column: OptionalColumn, checked: boolean) => {
	visibleColumns.value = checked
		? [...visibleColumns.value, column]
		: visibleColumns.value.filter(item => item !== column);
};
const setBusy = (key: string, value: boolean) => {
	const next = new Set(busyKeys.value);
	if (value) next.add(key);
	else next.delete(key);
	busyKeys.value = next;
};
const getErrorMessage = (reason: unknown, fallback: string) => (
	reason instanceof Error ? reason.message : fallback
);
const run = async (action: () => Promise<void>, success: string) => {
	beginLoading();
	try {
		await action();
		await paging.value?.reset();
		if (success) Message.success(success);
	} catch (reason) {
		Message.error(getErrorMessage(reason, 'Operation failed'));
	} finally {
		endLoading();
	}
};

const handleRefresh = () => run(async () => void 0, 'Refreshed');
const handleReload = async (record: ResourceRecord) => {
	const key = getKey(record);
	setBusy(key, true);
	try {
		await api.reload(record);
		await paging.value?.reset();
		Message.success(`${record.identity.source} updated`);
	} catch (reason) {
		Message.error(getErrorMessage(reason, 'Reload failed'));
	} finally {
		setBusy(key, false);
	}
};
const handleRemove = (record: ResourceRecord) => run(
	() => api.remove(record),
	`${record.identity.source} deleted`
);
const handleReloadAll = () => run(() => api.reloadAll(records.value), 'Updated all');
const handleClearAll = () => run(api.clear, 'Cleared all');
const handlePrefetch = async () => {
	beginLoading();
	try {
		const result = await api.prefetch();
		await paging.value?.reset();
		if (result.rejected) {
			Message.error(`Prefetch: ${result.fulfilled} ok, ${result.rejected} failed`);
		} else {
			Message.success(`Prefetched ${result.total}`);
		}
	} catch (reason) {
		Message.error(getErrorMessage(reason, 'Prefetch failed'));
	} finally {
		endLoading();
	}
};
const handlePrune = async () => {
	beginLoading();
	try {
		const removed = await api.prune();
		await paging.value?.reset();
		Message.success(`Pruned ${removed}`);
	} catch (reason) {
		Message.error(getErrorMessage(reason, 'Garbage cleanup failed'));
	} finally {
		endLoading();
	}
};

let statusRefreshTimer: ReturnType<typeof setTimeout> | undefined;
let unsubscribeStatus: (() => void) | undefined;
let disposed = false;
const handleStatusChange = () => {
	if (statusRefreshTimer) clearTimeout(statusRefreshTimer);
	/**
	 * 预加载时可能同时到达大量生命周期通知。debounce 仅用于限制
	 * IndexedDB 全量查询次数，不会对资源请求做防抖。
	 */
	statusRefreshTimer = setTimeout(() => {
		statusRefreshTimer = undefined;
		if (!disposed) void paging.value?.reset();
	}, 80);
};

onMounted(() => {
	disposed = false;
	unsubscribeStatus = Gateway.subscribeStatus(handleStatusChange);
});
onBeforeUnmount(() => {
	disposed = true;
	unsubscribeStatus?.();
	unsubscribeStatus = undefined;
	if (statusRefreshTimer) clearTimeout(statusRefreshTimer);
	statusRefreshTimer = undefined;
});
</script>
<style lang="scss">
@use '../../styles/bem' as *;

@include block(docs-database) {
	min-width: 960px;
	min-height: 100vh;
	padding: 28px 32px 40px;
	background: #f7f8fa;

	@include element(header) {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		margin-bottom: 20px;
		align-items: center;
		gap: 24px;

		h1 {
			margin: 0 0 6px;
			font-size: 24px;
			color: #17233d;
		}

		p {
			margin: 0;
			color: #808695;
		}
	}

	@include element(toolbar) {
		display: grid;
		grid-auto-flow: column;
		grid-auto-columns: max-content;
		justify-content: end;
		gap: 24px;
	}

	@include element(toolbar-primary) {
		display: grid;
		grid-auto-flow: column;
		grid-auto-columns: max-content;
		gap: 10px;
	}

	@include element(toolbar-danger) {
		display: grid;
		grid-auto-flow: column;
		grid-auto-columns: max-content;
		gap: 10px;
	}

	@include element(columns) {
		display: grid;
		min-width: 140px;
		padding: 4px 0;
		gap: 8px;
	}

	@include element(table) {
		background: #fff;
	}

	@include element(ellipsis) {
		display: block;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	@include element(actions) {
		display: grid;
		grid-auto-flow: column;
		grid-auto-columns: max-content;
		justify-content: center;
		gap: 8px;

		.docs-database__action {
			color: #2b72fd;
		}
	}

}
</style>
