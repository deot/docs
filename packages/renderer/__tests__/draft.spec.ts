// @vitest-environment jsdom

import 'fake-indexeddb/auto';
import { RendererDraftCache } from '../src/combo/draft';
import { createEmptyRendererDocument } from '../src/document';

const deleteDatabase = () => new Promise<void>((resolve, reject) => {
	const request = indexedDB.deleteDatabase('deot-docs-renderer');
	request.onsuccess = () => resolve();
	request.onerror = () => reject(request.error);
});

const putRawRow = async (row: Record<string, unknown>) => {
	await new Promise<void>((resolve, reject) => {
		const openRequest = window.indexedDB.open('deot-docs-renderer', 1);
		openRequest.onerror = () => reject(openRequest.error);
		openRequest.onupgradeneeded = () => {
			const database = openRequest.result;
			if (!database.objectStoreNames.contains('drafts')) {
				database.createObjectStore('drafts', { keyPath: '__id' });
			}
		};
		openRequest.onsuccess = () => {
			const database = openRequest.result;
			const transaction = database.transaction('drafts', 'readwrite');
			transaction.objectStore('drafts').put(row);
			transaction.oncomplete = () => {
				database.close();
				resolve();
			};
			transaction.onerror = () => {
				database.close();
				reject(transaction.error);
			};
		};
	});
};

describe('RendererDraftCache', () => {
	beforeEach(deleteDatabase);

	afterAll(deleteDatabase);

	it('persists JSON snapshots across cache instances and removes them', async () => {
		const first = new RendererDraftCache();
		const document = createEmptyRendererDocument();
		await first.set({ key: 'page', document, updatedAt: 100 });
		document.meta.title = 'Changed after write';

		const second = new RendererDraftCache();
		const record = await second.get('page');
		expect(record).toEqual(expect.objectContaining({
			key: 'page',
			updatedAt: 100,
			document: expect.objectContaining({ meta: expect.objectContaining({ title: '' }) })
		}));

		await second.remove('page');
		expect(await first.get('page')).toBeNull();
	});

	it('lists and clears every stored draft', async () => {
		const cache = new RendererDraftCache();
		const document = createEmptyRendererDocument();
		await cache.set({ key: 'home', document, updatedAt: 1 });
		await cache.set({ key: 'about', document, updatedAt: 2 });
		expect((await cache.list()).map(item => item.key).sort()).toEqual(['about', 'home']);
		await cache.clear();
		expect(await cache.list()).toEqual([]);
		expect(await cache.get('home')).toBeNull();
	});

	it('ignores malformed storage rows when reading drafts', async () => {
		const cache = new RendererDraftCache();
		await cache.set({
			key: 'home',
			document: createEmptyRendererDocument(),
			updatedAt: 1
		});
		await putRawRow({ __id: 'missing-data' });
		await putRawRow({ __id: 'invalid-data', data: JSON.stringify('not-a-record') });
		await putRawRow({ __id: 'invalid-key', data: JSON.stringify({
			key: 1,
			updatedAt: 1,
			document: {}
		}) });
		await putRawRow({ __id: 'invalid-updated-at', data: JSON.stringify({
			key: 'invalid-updated-at',
			updatedAt: '1',
			document: {}
		}) });
		await putRawRow({ __id: 'missing-document', data: JSON.stringify({
			key: 'missing-document',
			updatedAt: 1
		}) });
		await putRawRow({ __id: 'invalid-document', data: JSON.stringify({
			key: 'invalid-document',
			updatedAt: 1,
			document: 'nope'
		}) });

		expect(await cache.get('invalid-data')).toBeNull();
		expect(await cache.get('invalid-key')).toBeNull();
		expect(await cache.get('invalid-updated-at')).toBeNull();
		expect(await cache.get('missing-document')).toBeNull();
		expect(await cache.get('invalid-document')).toBeNull();
		expect((await cache.list()).map(item => item.key)).toEqual(['home']);
	});

	it('reports browsers without IndexedDB as an optional draft capability', async () => {
		const current = globalThis.indexedDB;
		vi.stubGlobal('indexedDB', undefined);
		const cache = new RendererDraftCache();
		await expect(cache.get('page')).rejects.toThrow('IndexedDB is unavailable');
		await expect(cache.set({
			key: 'page',
			document: createEmptyRendererDocument(),
			updatedAt: 1
		})).rejects.toThrow('IndexedDB is unavailable');
		await expect(cache.remove('page')).rejects.toThrow('IndexedDB is unavailable');
		await expect(cache.list()).rejects.toThrow('IndexedDB is unavailable');
		await expect(cache.clear()).rejects.toThrow('IndexedDB is unavailable');
		vi.stubGlobal('indexedDB', current);
	});
});
