<template>
	<section class="docs-database">
		<header class="docs-database__header">
			<div>
				<h1>{{ t('client.database.title') }}</h1>
				<p>
					deot-docs / resources · {{ t('client.database.records', { count: records.length }) }}
					· <span :title="currentNamespace">{{ currentNamespace }}</span>
					{{ t('client.database.cache', { size: namespaceCacheSize }) }}
				</p>
			</div>
			<div class="docs-database__toolbar">
				<div class="docs-database__toolbar-primary">
					<Button type="primary" :disabled="loading" @click="handleBack">
						<span class="docs-database__button-content">
							<ClientIcon name="back" />
							{{ t('client.database.back') }}
						</span>
					</Button>
					<Button type="primary" :disabled="loading" @click="handleHome">
						<span class="docs-database__button-content">
							<ClientIcon name="home" />
							{{ t('client.database.home') }}
						</span>
					</Button>
					<Popover trigger="click" placement="bottom-right">
						<Button type="primary" :disabled="loading">{{ t('client.database.columns') }}</Button>
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
						{{ t('client.database.refresh') }}
					</Button>
					<Button
						type="primary"
						:disabled="loading || !records.length"
						@click="handleReloadAll"
					>
						{{ t('client.database.updateAll') }}
					</Button>
					<Button type="primary" :disabled="loading" @click="handlePrefetch">
						{{ t('client.database.prefetch') }}
					</Button>
				</div>
				<div class="docs-database__toolbar-danger">
					<Button type="error" :disabled="loading || !records.length" @click="handleClearAll">
						{{ t('client.database.clear') }}
					</Button>
					<Button type="error" :disabled="loading || !records.length" @click="handlePrune">
						{{ t('client.database.prune') }}
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
			<TableColumn :label="t('client.database.url')" :min-width="260" fixed="left">
				<template #default="{ row }">
					<span class="docs-database__ellipsis" :title="row.url">{{ row.url }}</span>
				</template>
			</TableColumn>
			<TableColumn v-if="isColumnVisible('source')" :label="t('client.database.source')" :min-width="190">
				<template #default="{ row }">
					<span class="docs-database__ellipsis" :title="row.identity.source">{{ row.identity.source }}</span>
				</template>
			</TableColumn>
			<TableColumn :label="t('client.database.contentStatus')" :width="130" align="center">
				<template #default="{ row }">
					<Popover :disabled="row.status !== 'error'" placement="top">
						<Tag :type="row.status">{{ getStatusLabel(row.status) }}</Tag>
						<template #content>{{ getErrorReason(row) }}</template>
					</Popover>
				</template>
			</TableColumn>
			<TableColumn :label="t('client.database.requestStatus')" :width="135" align="center">
				<template #default="{ row }">
					<Popover :disabled="row.requestStatus !== 'error'" placement="top">
						<Tag :type="row.requestStatus">{{ getStatusLabel(row.requestStatus) }}</Tag>
						<template #content>{{ getErrorReason(row) }}</template>
					</Popover>
				</template>
			</TableColumn>
			<TableColumn v-if="isColumnVisible('namespace')" :label="t('client.database.namespace')" :min-width="150">
				<template #default="{ row }">{{ row.identity.namespace }}</template>
			</TableColumn>
			<TableColumn v-if="isColumnVisible('language')" :label="t('client.database.language')" :width="100">
				<template #default="{ row }">{{ row.identity.lang }}</template>
			</TableColumn>
			<TableColumn v-if="isColumnVisible('type')" :label="t('client.database.type')" :width="90">
				<template #default="{ row }">{{ row.identity.type }}</template>
			</TableColumn>
			<TableColumn v-if="isColumnVisible('hash')" :label="t('client.database.hash')" :width="110">
				<template #default="{ row }">{{ row.hash || '-' }}</template>
			</TableColumn>
			<TableColumn v-if="isColumnVisible('content')" :label="t('client.database.content')" :width="100">
				<template #default="{ row }">{{ formatSize(row.content) }}</template>
			</TableColumn>
			<TableColumn :label="t('client.database.updated')" :min-width="170">
				<template #default="{ row }">{{ formatTime(row.updatedAt) }}</template>
			</TableColumn>
			<TableColumn :label="t('client.database.checked')" :min-width="170">
				<template #default="{ row }">{{ formatTime(row.checkedAt) }}</template>
			</TableColumn>
			<TableColumn :label="t('client.database.accessed')" :min-width="170">
				<template #default="{ row }">{{ formatTime(row.accessedAt) }}</template>
			</TableColumn>
			<TableColumn :label="t('client.database.previous')" :width="90" align="center">
				<template #default="{ row }">{{ row.previous ? t('client.common.yes') : '-' }}</template>
			</TableColumn>
			<TableColumn :label="t('client.database.actions')" :width="190" align="center" fixed="right">
				<template #default="{ row }">
					<div class="docs-database__actions">
						<Button
							class="docs-database__action"
							type="text"
							:disabled="loading || busyKeys.has(getKey(row))"
							@click="handleReload(row)"
						>
							{{ t('client.database.update') }}
						</Button>
						<Button
							class="docs-database__action"
							type="text"
							:disabled="loading || busyKeys.has(getKey(row))"
							@click="handleRemove(row)"
						>
							{{ t('client.database.delete') }}
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
import { useLocale } from '@deot/docs-locale';
import { useRoute, useRouter } from 'vue-router';
import * as api from './api';
import ClientIcon from '../../components/icon';
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
import { Gateway } from '../../modules/gateway';
import type { ResourceRecord, ResourceStatus } from '../../modules/gateway';

const records = ref<ResourceRecord[]>([]);
const route = useRoute();
const router = useRouter();
const { t } = useLocale();
const paging = ref<PagingExpose<ResourceRecord>>();
const loadingCount = ref(0);
const loading = computed(() => loadingCount.value > 0);
const busyKeys = ref(new Set<string>());
const tableOptions = { class: 'docs-database__table', rowHeight: 52, border: true };
const OPTIONAL_COLUMN_VALUES = ['source', 'namespace', 'language', 'type', 'hash', 'content'] as const;
type OptionalColumn = typeof OPTIONAL_COLUMN_VALUES[number];
const optionalColumns = computed(() => OPTIONAL_COLUMN_VALUES.map(value => ({
	value,
	label: t(`client.database.${value}`)
})));
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
		label: t('client.database.source'),
		placeholder: t('client.database.source')
	},
	{
		type: 'select',
		field: 'type',
		label: t('client.database.type'),
		placeholder: t('client.database.type'),
		data: typeOptions.value
	},
	{
		type: 'select',
		field: 'language',
		label: t('client.database.language'),
		placeholder: t('client.database.language'),
		data: languageOptions.value
	},
	{
		type: 'select',
		field: 'status',
		label: t('client.database.contentStatus'),
		placeholder: t('client.database.contentStatus'),
		data: STATUS_OPTIONS
	},
	{
		type: 'select',
		field: 'requestStatus',
		label: t('client.database.requestStatus'),
		placeholder: t('client.database.requestStatus'),
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
		if (requestId === listRequestId) Message.error(getErrorMessage(reason, t('client.database.loadFailed')));
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
	record.reason || t('client.common.resourceRequestFailed')
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
		Message.error(getErrorMessage(reason, t('client.database.operationFailed')));
	} finally {
		endLoading();
	}
};

const handleBack = () => router.back();
const handleHome = () => void router.push(`/${String(route.params.lang || '')}`);
const handleRefresh = () => run(async () => void 0, t('client.database.refreshed'));
const handleReload = async (record: ResourceRecord) => {
	const key = getKey(record);
	setBusy(key, true);
	try {
		await api.reload(record);
		await paging.value?.reset();
		Message.success(t('client.database.updatedSource', { source: record.identity.source }));
	} catch (reason) {
		Message.error(getErrorMessage(reason, t('client.database.reloadFailed')));
	} finally {
		setBusy(key, false);
	}
};
const handleRemove = (record: ResourceRecord) => run(
	() => api.remove(record),
	t('client.database.deletedSource', { source: record.identity.source })
);
const handleReloadAll = () => run(() => api.reloadAll(records.value), t('client.database.updatedAll'));
const handleClearAll = () => run(api.clear, t('client.database.clearedAll'));
const handlePrefetch = async () => {
	beginLoading();
	try {
		const result = await api.prefetch();
		await paging.value?.reset();
		if (result.rejected) {
			Message.error(t('client.database.prefetchSummary', result));
		} else {
			Message.success(t('client.database.prefetched', { total: result.total }));
		}
	} catch (reason) {
		Message.error(getErrorMessage(reason, t('client.database.prefetchFailed')));
	} finally {
		endLoading();
	}
};
const handlePrune = async () => {
	beginLoading();
	try {
		const removed = await api.prune();
		await paging.value?.reset();
		Message.success(t('client.database.pruned', { count: removed }));
	} catch (reason) {
		Message.error(getErrorMessage(reason, t('client.database.pruneFailed')));
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
	background: varfix(background-color-soft);

	@include element(header) {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		margin-bottom: 20px;
		align-items: center;
		gap: 24px;

		h1 {
			margin: 0 0 6px;
			font-size: 24px;
			color: varfix(foreground-color);
		}

		p {
			margin: 0;
			color: varfix(foreground-color-mute);
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

	@include element(button-content) {
		display: inline-grid;
		grid-auto-flow: column;
		grid-auto-columns: max-content;
		align-items: center;
		gap: 5px;

		.docs-client-icon {
			width: 15px;
			height: 15px;
		}
	}

	@include element(columns) {
		display: grid;
		min-width: 140px;
		padding: 4px 0;
		gap: 8px;
	}

	@include element(table) {
		background: varfix(background-color);
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
			color: varfix(link-color);
		}
	}

}
</style>
