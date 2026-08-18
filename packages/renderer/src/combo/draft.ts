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

const DATABASE = 'deot-docs-renderer';
const STORE = 'drafts';

/**
 * Combo 草稿与资源 Gateway 分库保存，缓存清理不会误删尚未发布的页面。
 * 每次事务结束后立即关闭连接，避免多个编辑实例互相阻塞数据库升级。
 */
export class RendererDraftCache {
	private open() {
		return new Promise<IDBDatabase>((resolve, reject) => {
			if (typeof indexedDB === 'undefined') {
				reject(new Error('IndexedDB is unavailable'));
				return;
			}
			const request = indexedDB.open(DATABASE, 1);
			request.onupgradeneeded = () => {
				if (!request.result.objectStoreNames.contains(STORE)) {
					request.result.createObjectStore(STORE, { keyPath: 'key' });
				}
			};
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		});
	}

	async get(key: string) {
		const database = await this.open();
		try {
			return await new Promise<RendererDraftRecord | null>((resolve, reject) => {
				const request = database.transaction(STORE).objectStore(STORE).get(key);
				request.onsuccess = () => resolve(request.result || null);
				request.onerror = () => reject(request.error);
			});
		} finally {
			database.close();
		}
	}

	async set(record: RendererDraftRecord) {
		const database = await this.open();
		try {
			await new Promise<void>((resolve, reject) => {
				// Vue Proxy 不能被 structured clone，写入前固定为 JSON-safe 快照。
				const request = database.transaction(STORE, 'readwrite')
					.objectStore(STORE)
					.put(cloneRendererValue(record));
				request.onsuccess = () => resolve();
				request.onerror = () => reject(request.error);
			});
		} finally {
			database.close();
		}
	}

	async remove(key: string) {
		const database = await this.open();
		try {
			await new Promise<void>((resolve, reject) => {
				const request = database.transaction(STORE, 'readwrite').objectStore(STORE).delete(key);
				request.onsuccess = () => resolve();
				request.onerror = () => reject(request.error);
			});
		} finally {
			database.close();
		}
	}

	async list() {
		const database = await this.open();
		try {
			return await new Promise<RendererDraftRecord[]>((resolve, reject) => {
				const request = database.transaction(STORE).objectStore(STORE).getAll();
				request.onsuccess = () => resolve(request.result || []);
				request.onerror = () => reject(request.error);
			});
		} finally {
			database.close();
		}
	}

	async clear() {
		const database = await this.open();
		try {
			await new Promise<void>((resolve, reject) => {
				const request = database.transaction(STORE, 'readwrite').objectStore(STORE).clear();
				request.onsuccess = () => resolve();
				request.onerror = () => reject(request.error);
			});
		} finally {
			database.close();
		}
	}
}
