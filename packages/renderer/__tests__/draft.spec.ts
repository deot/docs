import 'fake-indexeddb/auto';
import { RendererDraftCache } from '../src/combo/draft';
import { createEmptyRendererDocument } from '../src/document';

const deleteDatabase = () => new Promise<void>((resolve, reject) => {
	const request = indexedDB.deleteDatabase('deot-docs-renderer');
	request.onsuccess = () => resolve();
	request.onerror = () => reject(request.error);
});

describe('RendererDraftCache', () => {
	beforeEach(deleteDatabase);

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
