<template>
	<section class="docs-playground-resource">
		<header class="docs-playground-resource__header">
			<div>
				<h1>{{ t('client.playgroundResource.title') }}</h1>
				<p>
					deot-docs-playground-resource / resources · {{ t('client.playgroundResource.records', {
						count: rows.length
					}) }}
					· <span :title="currentNamespace">{{ currentNamespace }}</span>
					{{ t('client.playgroundResource.cache', { size: namespaceCacheSize }) }}
				</p>
				<p class="docs-playground-resource__hint">
					{{ t('client.playgroundResource.hint') }}
				</p>
			</div>
			<div class="docs-playground-resource__toolbar">
				<div class="docs-playground-resource__toolbar-primary">
					<Button type="primary" :disabled="loading" @click="handleBack">
						<span class="docs-playground-resource__button-content">
							<ClientIcon name="back" />
							{{ t('client.playgroundResource.back') }}
						</span>
					</Button>
					<Button type="primary" :disabled="loading" @click="handleHome">
						<span class="docs-playground-resource__button-content">
							<ClientIcon name="home" />
							{{ t('client.playgroundResource.home') }}
						</span>
					</Button>
					<Popover trigger="click" placement="bottom-right">
						<Button type="primary" :disabled="loading">
							{{ t('client.playgroundResource.columns') }}
						</Button>
						<template #content>
							<div class="docs-playground-resource__columns">
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
						{{ t('client.playgroundResource.refresh') }}
					</Button>
					<Button
						type="primary"
						:disabled="loading || !rows.length"
						@click="handlePrefetch"
					>
						{{ t('client.playgroundResource.prefetch') }}
					</Button>
				</div>
				<div class="docs-playground-resource__toolbar-danger">
					<Button type="error" :disabled="loading || !rows.length" @click="handleClear">
						{{ t('client.playgroundResource.clear') }}
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
			<TableColumn :label="t('client.playgroundResource.kind')" :width="100" fixed="left">
				<template #default="{ row }">
					<span
						class="docs-playground-resource__kind"
						:class="{ 'is-style': row.kind === 'style' }"
					>
						{{ row.kind === 'style'
							? t('client.playgroundResource.kindStyle')
							: t('client.playgroundResource.kindImport') }}
					</span>
				</template>
			</TableColumn>
			<TableColumn :label="t('client.playgroundResource.alias')" :min-width="140" fixed="left">
				<template #default="{ row }">
					<code>{{ row.alias }}</code>
				</template>
			</TableColumn>
			<TableColumn
				v-if="isColumnVisible('defaultUrl')"
				:label="t('client.playgroundResource.defaultUrl')"
				:min-width="220"
			>
				<template #default="{ row }">
					<span
						class="docs-playground-resource__ellipsis"
						:title="row.defaultUrl || '-'"
					>{{ row.defaultUrl || '-' }}</span>
				</template>
			</TableColumn>
			<TableColumn :label="t('client.playgroundResource.currentUrl')" :min-width="240">
				<template #default="{ row }">
					<span
						class="docs-playground-resource__ellipsis"
						:title="row.currentUrl || '-'"
					>{{ row.currentUrl || '-' }}</span>
				</template>
			</TableColumn>
			<TableColumn :label="t('client.playgroundResource.status')" :width="110" align="center">
				<template #default="{ row }">
					<span
						class="docs-playground-resource__status"
						:class="{ 'is-overridden': row.overridden }"
					>
						{{ row.overridden
							? t('client.playgroundResource.overridden')
							: t('client.playgroundResource.default') }}
					</span>
				</template>
			</TableColumn>
			<TableColumn
				:label="t('client.playgroundResource.requestStatus')"
				:width="135"
				align="center"
			>
				<template #default="{ row }">
					<Popover :disabled="row.requestStatus !== 'error'" placement="top">
						<Tag :type="row.requestStatus">{{ row.requestStatus.toUpperCase() }}</Tag>
						<template #content>{{ row.reason || t('client.playgroundResource.probeFailed') }}</template>
					</Popover>
				</template>
			</TableColumn>
			<TableColumn
				v-if="isColumnVisible('updated')"
				:label="t('client.playgroundResource.updated')"
				:min-width="170"
			>
				<template #default="{ row }">{{ formatTime(row.updatedAt) }}</template>
			</TableColumn>
			<TableColumn
				v-if="isColumnVisible('checked')"
				:label="t('client.playgroundResource.checked')"
				:min-width="170"
			>
				<template #default="{ row }">{{ formatTime(row.checkedAt) }}</template>
			</TableColumn>
			<TableColumn
				:label="t('client.playgroundResource.actions')"
				:width="210"
				align="center"
				fixed="right"
			>
				<template #default="{ row }">
					<div class="docs-playground-resource__actions">
						<Button
							class="docs-playground-resource__action"
							type="text"
							:disabled="loading || busyKeys.has(rowKey(row))"
							@click="handleEdit(row)"
						>
							{{ t('client.playgroundResource.edit') }}
						</Button>
						<Button
							class="docs-playground-resource__action"
							type="text"
							:disabled="loading || busyKeys.has(rowKey(row))"
							@click="handleReset(row)"
						>
							{{ t('client.playgroundResource.rollback') }}
						</Button>
						<Button
							v-if="row.requestStatus === 'error'"
							class="docs-playground-resource__action"
							type="text"
							:disabled="loading || busyKeys.has(rowKey(row))"
							@click="handleRetry(row)"
						>
							{{ t('client.playgroundResource.retry') }}
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
import { SourceEditor } from './components/portal';
import ClientIcon from '../../components/icon';
import { Paging } from '../../components/paging';
import { Tag } from '../../components/tag';
import type {
	PagingExpose,
	PagingFilterModule,
	PagingKeywords,
	PagingLoadData
} from '../../components/paging';
import type {
	PlaygroundResourceRequestStatus,
	PlaygroundResourceRow
} from '../../modules/resource/playground';
import { getDocsNamespace } from '../../utils/resolver';
import { getDocsConfig } from '../../utils/runtime';

const rows = ref<PlaygroundResourceRow[]>([]);
const cacheBytes = ref(0);
const route = useRoute();
const router = useRouter();
const { t } = useLocale();
const paging = ref<PagingExpose<PlaygroundResourceRow>>();
const loadingCount = ref(0);
const loading = computed(() => loadingCount.value > 0);
const busyKeys = ref(new Set<string>());
const tableOptions = {
	class: 'docs-playground-resource__table',
	rowHeight: 52,
	border: true
};
const OPTIONAL_COLUMN_VALUES = ['defaultUrl', 'updated', 'checked'] as const;
type OptionalColumn = typeof OPTIONAL_COLUMN_VALUES[number];
const optionalColumns = computed(() => OPTIONAL_COLUMN_VALUES.map(value => ({
	value,
	label: t(`client.playgroundResource.${value}`)
})));
const visibleColumns = ref<OptionalColumn[]>([]);
const STATUS_OPTIONS: Array<{ label: string; value: PlaygroundResourceRequestStatus }> = [
	{ label: 'WAITING', value: 'waiting' },
	{ label: 'PENDING', value: 'pending' },
	{ label: 'SUCCESS', value: 'success' },
	{ label: 'ERROR', value: 'error' }
];
const KIND_OPTIONS = [
	{ label: 'Import', value: 'import' },
	{ label: 'CSS', value: 'style' }
];
const OVERRIDDEN_OPTIONS = [
	{ label: 'YES', value: '1' },
	{ label: 'NO', value: '0' }
];
const currentNamespace = getDocsNamespace(getDocsConfig());
const formatBytes = (bytes: number) => {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};
const namespaceCacheSize = computed(() => formatBytes(cacheBytes.value));
const rowKey = (row: Pick<PlaygroundResourceRow, 'kind' | 'alias'>) => `${row.kind}:${row.alias}`;
const formatTime = (value?: number) => (
	value ? new Date(value).toLocaleString() : '-'
);
const isColumnVisible = (column: OptionalColumn) => visibleColumns.value.includes(column);
const handleColumnChange = (column: OptionalColumn, checked: boolean) => {
	visibleColumns.value = checked
		? [...visibleColumns.value, column]
		: visibleColumns.value.filter(item => item !== column);
};

const filterModules = computed<PagingFilterModule[]>(() => [
	{
		type: 'input',
		field: 'alias',
		label: t('client.playgroundResource.alias'),
		placeholder: t('client.playgroundResource.alias')
	},
	{
		type: 'select',
		field: 'kind',
		label: t('client.playgroundResource.kind'),
		placeholder: t('client.playgroundResource.kind'),
		data: KIND_OPTIONS
	},
	{
		type: 'select',
		field: 'overridden',
		label: t('client.playgroundResource.status'),
		placeholder: t('client.playgroundResource.status'),
		data: OVERRIDDEN_OPTIONS
	},
	{
		type: 'select',
		field: 'requestStatus',
		label: t('client.playgroundResource.requestStatus'),
		placeholder: t('client.playgroundResource.requestStatus'),
		data: STATUS_OPTIONS
	}
]);

const filterRow = (row: PlaygroundResourceRow, keywords: PagingKeywords) => {
	const alias = String(keywords.alias || '').trim().toLowerCase();
	const kind = String(keywords.kind || '');
	const overridden = String(keywords.overridden || '');
	const requestStatus = String(keywords.requestStatus || '');
	return (!alias || row.alias.toLowerCase().includes(alias))
		&& (!kind || row.kind === kind)
		&& (!overridden || (row.overridden ? '1' : '0') === overridden)
		&& (!requestStatus || row.requestStatus === requestStatus);
};

const beginLoading = () => {
	loadingCount.value += 1;
};
const endLoading = () => {
	loadingCount.value = Math.max(0, loadingCount.value - 1);
};

let listRequestId = 0;
const loadData: PagingLoadData<PlaygroundResourceRow> = async (_page, _pageSize, keywords) => {
	const requestId = ++listRequestId;
	beginLoading();
	try {
		const page = await api.getPage();
		if (requestId === listRequestId) {
			rows.value = page.rows;
			cacheBytes.value = page.bytes;
		}
		return page.rows.filter(row => filterRow(row, keywords));
	} catch (reason) {
		if (requestId === listRequestId) {
			Message.error(getErrorMessage(reason, t('client.playgroundResource.loadFailed')));
		}
		return [];
	} finally {
		endLoading();
	}
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
		Message.success(success);
	} catch (reason) {
		Message.error(getErrorMessage(reason, t('client.playgroundResource.operationFailed')));
	} finally {
		endLoading();
	}
};
const runRow = async (
	row: PlaygroundResourceRow,
	action: () => Promise<unknown>,
	success: string,
	failed: string
) => {
	const key = rowKey(row);
	setBusy(key, true);
	try {
		await action();
		await paging.value?.reset();
		Message.success(success);
	} catch (reason) {
		await paging.value?.reset();
		Message.error(getErrorMessage(reason, failed));
	} finally {
		setBusy(key, false);
	}
};

const handleBack = () => router.back();
const handleHome = () => void router.push(`/${String(route.params.lang || '')}`);
const handleRefresh = () => run(async () => void 0, t('client.playgroundResource.refreshed'));
const handleClear = () => run(api.clear, t('client.playgroundResource.cleared'));
const handlePrefetch = async () => {
	beginLoading();
	try {
		const result = await api.prefetch(rows.value);
		await paging.value?.reset();
		if (result.rejected) {
			Message.error(t('client.playgroundResource.prefetchSummary', {
				total: result.total,
				fulfilled: result.fulfilled,
				rejected: result.rejected
			}));
		} else {
			Message.success(t('client.playgroundResource.prefetched', { total: result.total }));
		}
	} catch (reason) {
		Message.error(getErrorMessage(reason, t('client.playgroundResource.prefetchFailed')));
	} finally {
		endLoading();
	}
};

const handleEdit = (row: PlaygroundResourceRow) => {
	SourceEditor.popup({
		row,
		onConfirm: (url: string) => runRow(
			row,
			() => api.save(row, url),
			t('client.playgroundResource.saved', { alias: row.alias }),
			t('client.playgroundResource.saveFailed')
		)
	});
};
const handleReset = (row: PlaygroundResourceRow) => {
	if (!row.overridden) {
		Message.info(t('client.playgroundResource.rollbackSkipped'));
		return;
	}
	return runRow(
		row,
		() => api.reset(row),
		t('client.playgroundResource.rollbackDone', { alias: row.alias }),
		t('client.playgroundResource.rollbackFailed')
	);
};
const handleRetry = (row: PlaygroundResourceRow) => runRow(
	row,
	() => api.retry(row),
	t('client.playgroundResource.retried', { alias: row.alias }),
	t('client.playgroundResource.retryFailed')
);

let statusRefreshTimer: ReturnType<typeof setTimeout> | undefined;
let unsubscribeStatus: (() => void) | undefined;
let disposed = false;
const handleStatusChange = () => {
	if (statusRefreshTimer) clearTimeout(statusRefreshTimer);
	statusRefreshTimer = setTimeout(() => {
		statusRefreshTimer = undefined;
		if (!disposed) void paging.value?.reset();
	}, 80);
};

onMounted(() => {
	disposed = false;
	unsubscribeStatus = api.subscribeStatus(handleStatusChange);
});
onBeforeUnmount(() => {
	disposed = true;
	unsubscribeStatus?.();
	unsubscribeStatus = undefined;
	if (statusRefreshTimer) clearTimeout(statusRefreshTimer);
	statusRefreshTimer = undefined;
	SourceEditor.destroy();
});
</script>
<style lang="scss">
@use '../../styles/bem' as *;

@include block(docs-playground-resource) {
	min-width: 960px;
	min-height: 100vh;
	padding: 28px 32px 40px;
	background: varfix(background-color-soft);

	@include element(header) {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		margin-bottom: 20px;
		align-items: start;
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

	@include element(hint) {
		margin-top: 8px !important;
		font-size: 13px;
		line-height: 1.5;
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

		code {
			font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
			font-size: 12px;
		}
	}

	@include element(ellipsis) {
		display: block;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	@include element(kind) {
		display: inline-flex;
		padding: 2px 8px;
		font-size: 12px;
		color: varfix(foreground-color-mute);
		white-space: nowrap;
		background: varfix(background-color-soft);
		border-radius: 999px;

		@include when(style) {
			color: #0f766e;
			background: #ccfbf1;
		}
	}

	@include element(status) {
		display: inline-flex;
		padding: 2px 8px;
		font-size: 12px;
		color: varfix(foreground-color-mute);
		background: varfix(background-color-soft);
		border-radius: 999px;

		@include when(overridden) {
			color: #1d4ed8;
			background: #dbeafe;
		}
	}

	@include element(actions) {
		display: grid;
		grid-auto-flow: column;
		grid-auto-columns: max-content;
		justify-content: center;
		gap: 8px;

		.docs-playground-resource__action {
			color: varfix(link-color);
		}
	}
}
</style>
