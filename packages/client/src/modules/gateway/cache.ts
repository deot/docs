import { IndexedDBStore } from '@deot/helper-cache';
import type { ResourceCache, ResourceRecord } from './types';

const isResourceRecord = (value: unknown): value is ResourceRecord => {
	if (!value || typeof value !== 'object') return false;
	const identity = (value as Partial<ResourceRecord>).identity;
	return Boolean(
		identity
		&& typeof (value as Partial<ResourceRecord>).url === 'string'
		&& typeof identity.namespace === 'string'
		&& typeof identity.lang === 'string'
		&& typeof identity.type === 'string'
		&& typeof identity.source === 'string'
	);
};

/** 基于共享 deot-docs object store 的 Gateway 持久化存储。 */
export class IndexedDBResourceCache implements ResourceCache {
	private store = new IndexedDBStore({
		name: 'deot-docs',
		storeName: 'resources',
		keyPath: '__id',
		// schema 字段保存在 JSON value 内；修改数据库版本会使 helper-cache
		// 重建 object store，从而清除已有资源。
		version: 1
	});

	async get(key: string) {
		const record = await this.store.get(key);
		return isResourceRecord(record) ? record : null;
	}

	async set(key: string, value: ResourceRecord) {
		await this.store.set(key, value);
	}

	async remove(key: string) {
		await this.store.remove(key);
	}

	async list() {
		const rows = await this.store.search();
		const records = await Promise.all(rows.map(row => this.store.get(String(row.__id))));
		return records.filter(isResourceRecord);
	}

	async clear() {
		const rows = await this.store.search();
		await Promise.all(rows.map(row => this.store.remove(String(row.__id))));
	}
}
