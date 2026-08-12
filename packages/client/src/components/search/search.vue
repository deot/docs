<template>
	<div
		class="docs-search-mask"
		role="presentation"
		@click.self="handleClose"
	>
		<section
			class="docs-search"
			role="dialog"
			aria-modal="true"
			:aria-label="t('client.search.dialogLabel')"
			@keydown="handleKeydown"
		>
			<header class="docs-search__header">
				<span class="docs-search__icon" aria-hidden="true"></span>
				<input
					ref="input"
					v-model="keyword"
					class="docs-search__input"
					type="search"
					:placeholder="t('client.search.placeholder')"
					autocomplete="off"
					:aria-label="t('client.search.placeholder')"
					@compositionstart="composing = true"
					@compositionend="handleCompositionEnd"
				>
				<div class="docs-search__actions">
					<button
						v-if="keyword"
						class="docs-search__clear"
						type="button"
						@click="handleClear"
					>
						{{ t('client.search.clearQuery') }}
					</button>
					<button
						class="docs-search__close"
						type="button"
						:aria-label="t('client.search.close')"
						@click="handleClose"
					>
						<span class="docs-search__close-icon" aria-hidden="true"></span>
					</button>
				</div>
			</header>
			<div class="docs-search__body">
				<Scroller
					class="docs-search__scroller"
					:auto-resize="true"
					:native="false"
					:show-bar="true"
					height="100%"
					wrapper-style="overflow-x: hidden;"
				>
					<div class="docs-search__content">
						<div v-if="loading" class="docs-search__state">{{ t('client.search.searching') }}</div>
						<div v-else-if="error" class="docs-search__state docs-search__state--error">
							{{ error }}
						</div>
						<template v-else-if="keyword.trim()">
							<div class="docs-search__group-title">{{ t('client.search.documentation') }}</div>
							<button
								v-for="(item, index) in results"
								:key="`${item.id}:${item.kind}`"
								class="docs-search__result"
								:class="{
									'docs-search__result--active': index === selectedIndex,
									'docs-search__result--section': item.kind === 'section'
								}"
								:data-search-index="index"
								type="button"
								@mouseenter="handleMouseenter(index)"
								@click="handleSelect(item)"
							>
								<span class="docs-search__result-icon" aria-hidden="true">
									{{ item.kind === 'section' ? '#' : '▤' }}
								</span>
								<span class="docs-search__result-content">
									<span class="docs-search__result-title">
										<HighlightText
											:text="item.sectionTitle || item.title"
											:keyword="keyword"
										/>
									</span>
									<span v-if="item.kind === 'section'" class="docs-search__result-parent">
										{{ item.title }}
									</span>
									<span v-else-if="item.excerpt" class="docs-search__result-excerpt">
										<HighlightText :text="item.excerpt" :keyword="keyword" />
									</span>
								</span>
								<span v-if="index === selectedIndex" class="docs-search__enter" aria-hidden="true">↵</span>
							</button>
							<div v-if="!results.length" class="docs-search__state">
								{{ preparedCount ? t('client.search.noResults') : t('client.search.noCachedDocuments') }}
							</div>
						</template>
						<template v-else>
							<div class="docs-search__group-title">{{ t('client.search.recent') }}</div>
							<div
								v-for="(item, index) in history"
								:key="item.id"
								class="docs-search__history"
								:class="{ 'docs-search__history--active': index === selectedIndex }"
								:data-search-index="index"
								role="button"
								tabindex="-1"
								@mouseenter="handleMouseenter(index)"
								@click="handleSelect(item)"
							>
								<span class="docs-search__history-icon" aria-hidden="true">↶</span>
								<span class="docs-search__result-content">
									<span class="docs-search__result-title">{{ item.sectionTitle || item.title }}</span>
									<span v-if="item.sectionTitle" class="docs-search__result-parent">{{ item.title }}</span>
								</span>
								<button
									class="docs-search__history-action"
									:class="{ 'docs-search__history-action--active': item.pinned }"
									type="button"
									:aria-label="item.pinned ? t('client.search.unpin') : t('client.search.pin')"
									@click.stop="handleTogglePinned(item.id)"
								>
									{{ item.pinned ? '★' : '☆' }}
								</button>
								<button
									class="docs-search__history-action"
									type="button"
									:aria-label="t('client.search.remove')"
									@click.stop="handleRemoveHistory(item.id)"
								>
									×
								</button>
							</div>
							<div v-if="!history.length" class="docs-search__state">{{ t('client.search.noRecent') }}</div>
						</template>
					</div>
				</Scroller>
			</div>
			<footer class="docs-search__footer">
				<span><kbd>↓</kbd><kbd>↑</kbd> {{ t('client.search.navigateHint') }}</span>
				<span><kbd>↵</kbd> {{ t('client.search.selectHint') }}</span>
				<span><kbd>ESC</kbd> {{ t('client.search.closeHint') }}</span>
			</footer>
		</section>
	</div>
</template>
<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { Scroller } from '@deot/vc';
import { useLocale } from '@deot/docs-locale';
import type { Language } from '@deot/docs-locale';
import HighlightText from './highlight-text.vue';
import { Gateway } from '../../modules';
import { Search } from '../../modules/search';
import type { SearchHistoryRecord, SearchResult } from '../../modules/search';

const SEARCH_DELAY = 80;
const props = defineProps<{
	lang: string;
	locale: Language;
	onNavigate: (target: { path: string; hash: string }) => Promise<void> | void;
}>();
const { t } = useLocale(computed(() => props.locale));
const emit = defineEmits<{
	'portal-fulfilled': [];
}>();
const input = ref<HTMLInputElement>();
const keyword = ref('');
const results = ref<SearchResult[]>([]);
const history = ref<SearchHistoryRecord[]>([]);
const selectedIndex = ref(-1);
const preparedCount = ref(0);
const loading = ref(false);
const error = ref('');
const composing = ref(false);
let timer: ReturnType<typeof setTimeout> | undefined;
let unsubscribeStatus: (() => void) | undefined;
let requestGeneration = 0;
let active = true;

const items = computed(() => keyword.value.trim() ? results.value : history.value);
const clearTimer = () => {
	if (timer) clearTimeout(timer);
	timer = undefined;
};
const setFirstSelection = () => {
	selectedIndex.value = items.value.length ? 0 : -1;
};
const loadHistory = async () => {
	try {
		history.value = await Search.listHistory(props.lang);
		error.value = '';
		setFirstSelection();
	} catch (reason) {
		error.value = reason instanceof Error ? reason.message : t('client.search.historyLoadFailed');
	}
};
const runSearch = async () => {
	const current = ++requestGeneration;
	if (!keyword.value.trim()) {
		loading.value = false;
		results.value = [];
		await loadHistory();
		try {
			const count = await Search.prepare(props.lang);
			if (current === requestGeneration) preparedCount.value = count;
		} catch {
			// 历史仍可独立展示；索引刷新失败会在用户再次查询时进入错误态。
		}
		return;
	}
	loading.value = true;
	try {
		const nextResults = await Search.query(props.lang, keyword.value);
		if (current !== requestGeneration) return;
		results.value = nextResults;
		preparedCount.value = Search.getPreparedCount(props.lang);
		error.value = '';
		setFirstSelection();
	} catch (reason) {
		if (current !== requestGeneration) return;
		error.value = reason instanceof Error ? reason.message : t('client.search.queryFailed');
		results.value = [];
		selectedIndex.value = -1;
	} finally {
		if (current === requestGeneration) loading.value = false;
	}
};
const scheduleSearch = () => {
	clearTimer();
	timer = setTimeout(() => void runSearch(), SEARCH_DELAY);
};
const initialize = async () => {
	keyword.value = '';
	results.value = [];
	error.value = '';
	await loadHistory();
	if (!active) return;
	try {
		preparedCount.value = await Search.prepare(props.lang);
	} catch {
		// 预备索引失败会在实际查询时显示，不阻止用户查看搜索历史。
	}
	if (!active) return;
	unsubscribeStatus?.();
	unsubscribeStatus = Gateway.subscribeStatus((record) => {
		if (!active
			|| record.identity.lang !== props.lang
			|| record.identity.type !== 'markdown'
			|| record.requestStatus !== 'success') return;
		scheduleSearch();
	});
	await nextTick();
	input.value?.focus();
};
const handleClose = async () => {
	active = false;
	keyword.value = '';
	results.value = [];
	requestGeneration += 1;
	clearTimer();
	unsubscribeStatus?.();
	unsubscribeStatus = undefined;
	emit('portal-fulfilled');
};
const handleClear = async () => {
	requestGeneration += 1;
	loading.value = false;
	clearTimer();
	keyword.value = '';
	results.value = [];
	await loadHistory();
	await nextTick();
	input.value?.focus();
};
const handleMouseenter = (index: number) => {
	selectedIndex.value = index;
};
const scrollSelectionIntoView = async () => {
	await nextTick();
	document.querySelector<HTMLElement>(`.docs-search [data-search-index="${selectedIndex.value}"]`)
		?.scrollIntoView?.({ block: 'nearest' });
};
const moveSelection = async (offset: number) => {
	if (!items.value.length) return;
	selectedIndex.value = (selectedIndex.value + offset + items.value.length) % items.value.length;
	await scrollSelectionIntoView();
};
const handleSelect = async (item: SearchResult | SearchHistoryRecord) => {
	try {
		await Search.record(item);
	} catch {
		// 历史持久化失败不应阻断正文导航。
	}
	await props.onNavigate({ path: item.path, hash: item.hash });
	await handleClose();
};
const handleTogglePinned = async (id: string) => {
	try {
		await Search.togglePinned(id);
		await loadHistory();
	} catch (reason) {
		error.value = reason instanceof Error ? reason.message : t('client.search.historyUpdateFailed');
	}
};
const handleRemoveHistory = async (id: string) => {
	try {
		await Search.removeHistory(id);
		await loadHistory();
	} catch (reason) {
		error.value = reason instanceof Error ? reason.message : t('client.search.historyRemoveFailed');
	}
};
const handleKeydown = async (event: KeyboardEvent) => {
	if (event.key === 'Escape') {
		event.preventDefault();
		await handleClose();
	} else if (event.key === 'ArrowDown') {
		event.preventDefault();
		await moveSelection(1);
	} else if (event.key === 'ArrowUp') {
		event.preventDefault();
		await moveSelection(-1);
	} else if (event.key === 'Enter' && !composing.value && !event.isComposing) {
		event.preventDefault();
		const item = items.value[selectedIndex.value];
		if (item) await handleSelect(item);
	}
};
const handleCompositionEnd = () => {
	composing.value = false;
	scheduleSearch();
};

watch(keyword, () => {
	if (!active || composing.value) return;
	scheduleSearch();
});
onMounted(() => void initialize());
onBeforeUnmount(() => {
	active = false;
	requestGeneration += 1;
	clearTimer();
	unsubscribeStatus?.();
});
</script>
<style lang="scss">
@use '../../styles/bem' as *;

@include block(docs-search-mask) {
	position: fixed;
	z-index: 1000;
	inset: 60px 0 0;
	display: grid;
	padding: 0 12px;
	background: varfix(mask-color);
	backdrop-filter: blur(5px);
	place-items: start center;
}

@include block(docs-search) {
	display: grid;
	grid-template-rows: 56px minmax(0, 1fr) 44px;
	width: min(800px, 100%);
	height: min(646px, calc(100vh - 86px));
	margin-top: 2px;
	overflow: hidden;
	background: varfix(background-color);
	border-radius: 3px;
	box-shadow: 0 10px 30px varfix(shadow-color);

	@include element(header) {
		display: grid;
		grid-template-columns: 24px minmax(0, 1fr) max-content;
		gap: 10px;
		padding: 0 12px 0 18px;
		background: varfix(background-color-soft);
		border-bottom: 1px solid varfix(border-color);
		align-items: center;
	}

	@include element(icon) {
		position: relative;
		width: 18px;
		height: 18px;
		color: varfix(foreground-color-light);
		border: 1.5px solid currentcolor;
		border-radius: 50%;

		&::after {
			position: absolute;
			right: -5px;
			bottom: -2px;
			width: 7px;
			height: 1.5px;
			background: currentcolor;
			content: "";
			transform: rotate(45deg);
		}
	}

	@include element(input) {
		width: 100%;
		height: 100%;
		padding: 0;
		font: inherit;
		font-size: 18px;
		color: varfix(foreground-color-light);
		background: transparent;
		border: 0;
		outline: 0;
		appearance: none;

		&::-webkit-search-cancel-button {
			display: none;
		}
	}

	@include element(clear) {
		padding: 5px 8px;
		font: inherit;
		color: varfix(link-color);
		cursor: pointer;
		background: transparent;
		border: 0;
	}

	@include element(actions) {
		display: grid;
		grid-auto-columns: max-content;
		grid-auto-flow: column;
		gap: 2px;
		align-items: center;
	}

	@include element(close) {
		display: grid;
		width: 28px;
		height: 28px;
		padding: 0;
		font: inherit;
		color: varfix(foreground-color-light);
		cursor: pointer;
		background: transparent;
		border: 0;
		border-radius: 50%;
		place-items: center;
		transition: color 0.2s ease, background-color 0.2s ease;

		&:hover,
		&:focus-visible {
			color: var(--vc-color-light);
			background: varfix(primary-color);
			outline: none;
		}
	}

	@include element(close-icon) {
		position: relative;
		display: block;
		width: 10px;
		height: 10px;

		&::before,
		&::after {
			position: absolute;
			top: 50%;
			left: 50%;
			width: 10px;
			height: 1px;
			background: currentcolor;
			border-radius: 1px;
			content: "";
		}

		&::before {
			transform: translate(-50%, -50%) rotate(45deg);
		}

		&::after {
			transform: translate(-50%, -50%) rotate(-45deg);
		}
	}

	@include element(body) {
		min-height: 0;
		background: varfix(background-color-soft);
	}

	@include element(scroller) {
		width: 100%;
		height: 100%;
	}

	@include element(content) {
		padding: 14px 12px 22px;
	}

	@include element(group-title) {
		padding: 0 0 10px;
		font-weight: 600;
		color: varfix(foreground-color-light);
	}

	@include element(result) {
		display: grid;
		width: 100%;
		min-height: 56px;
		padding: 9px 14px;
		font: inherit;
		color: varfix(foreground-color-light);
		text-align: left;
		cursor: pointer;
		background: varfix(background-color);
		border: 0;
		border-radius: 4px;
		grid-template-columns: 24px minmax(0, 1fr) 24px;
		gap: 10px;
		align-items: center;

		& + & {
			margin-top: 4px;
		}

		@include modifier(active) {
			color: varfix(link-color);
			background: varfix(primary-color-light);
		}

		@include modifier(section) {
			position: relative;
			width: calc(100% - 18px);
			margin-left: 18px;

			&::before {
				position: absolute;
				top: 0;
				left: 0;
				width: 10px;
				height: 24px;
				border-bottom: 1px solid varfix(border-color);
				border-left: 1px solid varfix(border-color);
				content: "";
			}
		}
	}

	@include element(result-icon) {
		font-size: 17px;
		color: varfix(foreground-color-light);
		text-align: center;
	}

	@include element(result-content) {
		display: grid;
		gap: 3px;
		min-width: 0;
	}

	@include element(result-title) {
		overflow: hidden;
		font-size: 14px;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	@include element(result-parent) {
		font-size: 12px;
		color: varfix(foreground-color-light);
	}

	@include element(result-excerpt) {
		overflow: hidden;
		font-size: 12px;
		color: varfix(foreground-color-mute);
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	@include element(enter) {
		font-size: 20px;
		color: varfix(link-color);
		text-align: center;
	}

	@include element(history) {
		display: grid;
		grid-template-columns: 24px minmax(0, 1fr) 30px 30px;
		gap: 10px;
		min-height: 56px;
		padding: 9px 10px 9px 14px;
		cursor: pointer;
		background: varfix(background-color);
		border-radius: 4px;
		align-items: center;

		& + & {
			margin-top: 4px;
		}

		@include modifier(active) {
			color: varfix(link-color);
			background: varfix(primary-color-light);
		}
	}

	@include element(history-icon) {
		font-size: 22px;
		color: varfix(foreground-color-light);
	}

	@include element(history-action) {
		width: 30px;
		height: 30px;
		padding: 0;
		font: inherit;
		font-size: 18px;
		color: varfix(foreground-color-mute);
		cursor: pointer;
		background: transparent;
		border: 0;

		&:hover,
		&--active {
			color: varfix(link-color);
		}
	}

	@include element(state) {
		display: grid;
		min-height: 120px;
		color: varfix(foreground-color-mute);
		place-items: center;

		@include modifier(error) {
			color: var(--vc-color-error);
		}
	}

	@include element(footer) {
		display: grid;
		grid-auto-columns: max-content;
		grid-auto-flow: column;
		gap: 22px;
		padding: 0 12px;
		font-size: 13px;
		color: varfix(foreground-color-light);
		background: varfix(background-color);
		border-top: 1px solid varfix(border-color);
		align-items: center;

		span {
			display: inline-grid;
			grid-auto-flow: column;
			gap: 5px;
			align-items: center;
		}

		kbd {
			min-width: 22px;
			padding: 3px 4px;
			font: inherit;
			font-size: 11px;
			text-align: center;
			background: varfix(background-color-mute);
			border: 0;
			border-radius: 2px;
			box-shadow: none;
		}
	}
}

@media screen and (width <= 768px) {
	@include block(docs-search) {
		height: min(620px, calc(100vh - 74px));
		grid-template-rows: 52px minmax(0, 1fr) 42px;

		@include element(footer) {
			gap: 10px;
			font-size: 11px;
		}
	}
}
</style>
