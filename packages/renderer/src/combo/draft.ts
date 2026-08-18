import { IndexedDBStore } from '@deot/helper-cache';
import type { RendererDocument } from '../types';
import { cloneRendererValue } from '../validate';

export interface RendererDraftRecord {
	/**
	 * IndexedDB 主键，通常是页面逻辑地址。
	 */
	key: string;
	document: RendererDocument;
	updatedAt: number;
}

const isRendererDraftRecord = (value: unknown): value is RendererDraftRecord => {
	if (!value || typeof value !== 'object') return false;
	const record = value as Partial<RendererDraftRecord>;
	return typeof record.key === 'string'
		&& typeof record.updatedAt === 'number'
		&& Boolean(record.document)
		&& typeof record.document === 'object';
};

/**
 * Combo 草稿与资源 Gateway 分库保存，缓存清理不会误删尚未发布的页面。
 * helper-cache 在每次事务结束后关闭连接，避免多个编辑实例互相阻塞数据库升级。
 */
export class RendererDraftCache {
	private store = new IndexedDBStore({
		name: 'deot-docs-renderer',
		storeName: 'drafts',
		keyPath: '__id',
		// schema 字段保存在 JSON value 内；修改数据库版本会使 helper-cache
		// 重建 object store，从而清除已有草稿。
		version: 1
	});

	private assertAvailable() {
		if (typeof indexedDB === 'undefined') {
			throw new Error('IndexedDB is unavailable');
		}
	}

	async get(key: string) {
		this.assertAvailable();
		const record = await this.store.get(key);
		return isRendererDraftRecord(record) ? record : null;
	}

	async set(record: RendererDraftRecord) {
		this.assertAvailable();
		// Vue Proxy 先拍成 JSON-safe 快照，再交给 helper-cache 序列化。
		await this.store.set(record.key, cloneRendererValue(record));
	}

	async remove(key: string) {
		this.assertAvailable();
		await this.store.remove(key);
	}

	async list() {
		this.assertAvailable();
		const rows = await this.store.search();
		const records = await Promise.all(rows.map(row => this.store.get(String(row.__id))));
		return records.filter(isRendererDraftRecord);
	}

	async clear() {
		this.assertAvailable();
		const rows = await this.store.search();
		await Promise.all(rows.map(row => this.store.remove(String(row.__id))));
	}
}
