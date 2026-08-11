import { IndexedDBStore } from '@deot/helper-cache';
import type { SearchHistoryRecord, SearchNavigationTarget } from './types';

const HISTORY_LIMIT = 20;

const isSearchHistoryRecord = (value: unknown): value is SearchHistoryRecord => {
	if (!value || typeof value !== 'object') return false;
	const record = value as Partial<SearchHistoryRecord>;
	return typeof record.id === 'string'
		&& typeof record.namespace === 'string'
		&& typeof record.lang === 'string'
		&& typeof record.path === 'string'
		&& typeof record.hash === 'string'
		&& typeof record.title === 'string'
		&& typeof record.pinned === 'boolean'
		&& typeof record.visitedAt === 'number';
};

export const createSearchHistoryId = (target: SearchNavigationTarget) => (
	[target.namespace, target.lang, target.path, target.hash]
		.map(encodeURIComponent)
		.join('|')
);

/** 搜索历史使用独立数据库，避免升级 Gateway 资源库时重建其 object store。 */
export class IndexedDBSearchHistory {
	private store = new IndexedDBStore({
		name: 'deot-docs-search',
		storeName: 'history',
		keyPath: '__id',
		version: 1
	});

	async list(namespace: string, lang: string) {
		const rows = await this.store.search();
		const records = await Promise.all(rows.map(row => this.store.get(String(row.__id))));
		return records
			.filter(isSearchHistoryRecord)
			.filter(record => record.namespace === namespace && record.lang === lang)
			.sort((left, right) => (
				Number(right.pinned) - Number(left.pinned)
				|| (right.pinnedAt || 0) - (left.pinnedAt || 0)
				|| right.visitedAt - left.visitedAt
			));
	}

	/**
	 * 写入实际访问目标。达到上限时只淘汰未收藏的最旧记录；全部收藏后
	 * 保留已有列表，但调用方仍可继续完成页面导航。
	 * @param target 被用户选择的搜索目标。
	 * @returns 本次是否写入了历史。
	 */
	async record(target: SearchNavigationTarget) {
		const id = createSearchHistoryId(target);
		const existing = await this.store.get(id);
		const current = isSearchHistoryRecord(existing) ? existing : null;
		const records = await this.list(target.namespace, target.lang);
		if (!current && records.length >= HISTORY_LIMIT) {
			const removable = [...records]
				.filter(record => !record.pinned)
				.sort((left, right) => left.visitedAt - right.visitedAt)[0];
			if (!removable) return false;
			await this.store.remove(removable.id);
		}
		await this.store.set(id, {
			...target,
			id,
			pinned: current?.pinned || false,
			pinnedAt: current?.pinnedAt,
			visitedAt: Date.now()
		} satisfies SearchHistoryRecord);
		return true;
	}

	async togglePinned(id: string) {
		const value = await this.store.get(id);
		if (!isSearchHistoryRecord(value)) return null;
		const pinned = !value.pinned;
		const record: SearchHistoryRecord = {
			...value,
			pinned,
			pinnedAt: pinned ? Date.now() : undefined
		};
		await this.store.set(id, record);
		return record;
	}

	async remove(id: string) {
		await this.store.remove(id);
	}
}
