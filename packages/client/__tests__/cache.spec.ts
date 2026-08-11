// @vitest-environment jsdom

import 'fake-indexeddb/auto';
import { ResourceGateway } from '../src/modules/gateway';
import { IndexedDBResourceCache } from '../src/modules/gateway/cache';
import type { ResourceRecord } from '../src/modules/gateway';
import { resourceIdentityKey } from '../src/utils/resolver';

const deleteDatabase = async () => {
	await new Promise<void>((resolve, reject) => {
		const request = window.indexedDB.deleteDatabase('deot-docs');
		request.onsuccess = () => resolve();
		request.onerror = () => reject(request.error);
	});
};

const createRecord = (source: string): ResourceRecord => ({
	identity: {
		namespace: 'docs',
		lang: 'zh-CN',
		type: 'markdown',
		source
	},
	url: `https://docs.example.com/${source.replace(/^\.\//, '')}`,
	status: 'success',
	requestStatus: 'success',
	requestStatusUpdatedAt: 3,
	statusHistory: [{
		id: `success:${source}`,
		status: 'success',
		createdAt: 1,
		completedAt: 2
	}],
	contentHistoryId: `success:${source}`,
	contentHistoryIndex: 0,
	content: `# ${source}`,
	hash: source,
	updatedAt: 2,
	checkedAt: 2,
	accessedAt: 3
});

const putRawRow = async (row: Record<string, unknown>) => {
	await new Promise<void>((resolve, reject) => {
		const openRequest = window.indexedDB.open('deot-docs', 1);
		openRequest.onerror = () => reject(openRequest.error);
		openRequest.onupgradeneeded = () => {
			const database = openRequest.result;
			if (!database.objectStoreNames.contains('resources')) {
				database.createObjectStore('resources', { keyPath: '__id' });
			}
		};
		openRequest.onsuccess = () => {
			const database = openRequest.result;
			const transaction = database.transaction('resources', 'readwrite');
			transaction.objectStore('resources').put(row);
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

describe('IndexedDBResourceCache', () => {
	beforeEach(async () => {
		await deleteDatabase();
	});

	afterAll(async () => {
		await deleteDatabase();
	});

	it('persists records across cache instances and lists every valid row', async () => {
		const first = createRecord('./index.md');
		const second = createRecord('./guide.md');
		const writer = new IndexedDBResourceCache();
		await writer.set('index', first);
		await writer.set('guide', second);

		const reader = new IndexedDBResourceCache();
		expect(await reader.get('index')).toEqual(first);
		expect(await reader.list()).toEqual([second, first]);
	});

	it('removes individual rows, ignores malformed storage rows and clears the store', async () => {
		const cache = new IndexedDBResourceCache();
		await cache.set('index', createRecord('./index.md'));
		await cache.set('guide', createRecord('./guide.md'));
		await putRawRow({ __id: 'missing-data' });
		await putRawRow({ __id: 'invalid-data', data: JSON.stringify('not-a-record') });

		expect(await cache.list()).toHaveLength(2);
		expect(await cache.get('invalid-data')).toBeNull();
		await cache.remove('index');
		expect(await cache.get('index')).toBeNull();
		expect((await cache.list()).map(record => record.identity.source))
			.toEqual(['./guide.md']);

		await cache.clear();
		expect(await cache.list()).toEqual([]);
	});

	it('repairs legacy records from IndexedDB and persists the normalized schema', async () => {
		const identity = createRecord('./legacy.md').identity;
		const key = resourceIdentityKey(identity);
		const legacy = {
			identity,
			url: 'https://docs.example.com/legacy.md',
			status: 'success',
			statusUpdatedAt: 9,
			content: '',
			updatedAt: 10,
			checkedAt: 11,
			accessedAt: 12
		};
		await putRawRow({ __id: key, data: JSON.stringify(legacy) });

		const gateway = new ResourceGateway({ request: vi.fn() });
		const [record] = await gateway.list();
		expect(record).toMatchObject({
			identity,
			status: 'success',
			requestStatus: 'success',
			requestStatusUpdatedAt: 11,
			content: '',
			contentHistoryIndex: 0
		});
		expect(record.contentHistoryId).toBe(record.statusHistory[0].id);
		expect(record).not.toHaveProperty('statusUpdatedAt');

		const persisted = await new IndexedDBResourceCache().get(key);
		expect(persisted).toEqual(record);
	});
});
