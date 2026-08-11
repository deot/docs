// @vitest-environment jsdom

import 'fake-indexeddb/auto';
import { Search } from '../src/modules/search';
import { IndexedDBSearchHistory } from '../src/modules/search/history';
import type { ResourceRecord } from '../src/modules/gateway';
import type { SearchNavigationTarget } from '../src/modules/search/types';

const { collectRouteResources, list } = vi.hoisted(() => ({
	collectRouteResources: vi.fn(),
	list: vi.fn()
}));

vi.mock('../src/modules/gateway', () => ({
	Gateway: { list }
}));

vi.mock('../src/modules/resource-plan', () => ({
	ResourcePlan: { collectRouteResources }
}));

const createRecord = (
	source: string,
	content: string | undefined,
	overrides: Partial<ResourceRecord['identity']> = {}
): ResourceRecord => ({
	identity: {
		namespace: 'docs-search-tests',
		lang: 'zh-CN',
		type: 'markdown',
		source,
		...overrides
	},
	url: `https://docs.example.com/${source}`,
	status: typeof content === 'string' ? 'success' : 'error',
	requestStatus: typeof content === 'string' ? 'success' : 'error',
	requestStatusUpdatedAt: 1,
	statusHistory: [],
	contentHistoryId: null,
	contentHistoryIndex: null,
	content,
	hash: content ? `hash:${content}` : undefined,
	updatedAt: content ? 1 : undefined,
	checkedAt: 1,
	accessedAt: 1
});

const deleteHistoryDatabase = async () => {
	await new Promise<void>((resolve, reject) => {
		const request = indexedDB.deleteDatabase('deot-docs-search');
		request.onsuccess = () => resolve();
		request.onerror = () => reject(request.error);
	});
};

describe('Search', () => {
	beforeEach(async () => {
		await deleteHistoryDatabase();
		window.$docs = {
			namespace: 'docs-search-tests',
			locales: { 'zh-CN': { label: '简体中文' }, 'en-US': { label: 'English' } },
			routes: {}
		};
		list.mockReset();
		collectRouteResources.mockReset();
	});

	afterAll(async () => {
		await deleteHistoryDatabase();
	});

	it('isolates cached Markdown and ranks document and section matches', async () => {
		const guide = createRecord(
			'./guide.md',
			'# Installation Guide\n\nInstall the package.\n\n## Quick install\n\nRun install now.'
		);
		const ignored = [
			createRecord('./english.md', '# Install English', { lang: 'en-US' }),
			createRecord('./other.md', '# Install Other', { namespace: 'other' }),
			createRecord('./sidebar.json', '[]', { type: 'sidebar' }),
			createRecord('./missing.md', undefined)
		];
		list.mockResolvedValue([guide, ...ignored]);
		collectRouteResources.mockResolvedValue([
			{ identity: guide.identity, path: '/zh-CN/guide' }
		]);

		const results = await Search.query('zh-CN', 'install');

		expect(results.map(item => [item.kind, item.title, item.sectionTitle])).toEqual([
			['document', 'Installation Guide', undefined],
			['section', 'Installation Guide', 'Quick install']
		]);
		expect(results.every(item => item.path === '/zh-CN/guide')).toBe(true);
		expect(results[1].hash).toBe('#quick-install');
	});

	it('reuses unchanged parsed content and refreshes it after the hash changes', async () => {
		const record = createRecord('./guide.md', '# First title\n\nOld body');
		list.mockResolvedValue([record]);
		collectRouteResources.mockResolvedValue([
			{ identity: record.identity, path: '/zh-CN/guide' }
		]);
		expect(await Search.query('zh-CN', 'old')).toHaveLength(1);

		record.content = '# Second title\n\nNew body';
		record.hash = 'changed';
		expect(await Search.query('zh-CN', 'new')).toHaveLength(1);
		expect(await Search.query('zh-CN', 'old')).toHaveLength(0);
	});

	it('limits flattened search results to fifty entries', async () => {
		const sections = Array.from({ length: 60 }, (_, index) => (
			`## Match ${index}\n\nShared searchable content ${index}`
		)).join('\n\n');
		const record = createRecord('./large.md', `# Large\n\n${sections}`);
		list.mockResolvedValue([record]);
		collectRouteResources.mockResolvedValue([
			{ identity: record.identity, path: '/zh-CN/large' }
		]);

		expect(await Search.query('zh-CN', 'match')).toHaveLength(50);
	});

	it('exposes persistent history operations through the shared singleton', async () => {
		const target = {
			id: 'ignored-result-id',
			kind: 'document' as const,
			namespace: 'docs-search-tests',
			lang: 'zh-CN',
			path: '/zh-CN/guide',
			hash: '',
			title: 'Guide',
			source: './guide.md',
			excerpt: '',
			score: 100
		};
		expect(await Search.query('zh-CN', '   ')).toEqual([]);
		expect(await Search.record(target)).toBe(true);
		let records = await Search.listHistory('zh-CN');
		expect(records).toHaveLength(1);
		await Search.togglePinned(records[0].id);
		records = await Search.listHistory('zh-CN');
		expect(records[0].pinned).toBe(true);
		await Search.removeHistory(records[0].id);
		expect(await Search.listHistory('zh-CN')).toEqual([]);
	});
});

describe('IndexedDBSearchHistory', () => {
	let now = 0;

	beforeEach(async () => {
		await deleteHistoryDatabase();
		now = Date.parse('2026-08-11T00:00:00Z');
		vi.spyOn(Date, 'now').mockImplementation(() => now);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	const createTarget = (index: number, lang = 'zh-CN'): SearchNavigationTarget => ({
		namespace: 'docs-search-tests',
		lang,
		path: `/${lang}/page-${index}`,
		hash: index % 2 ? '#section' : '',
		title: `Page ${index}`,
		sectionTitle: index % 2 ? 'Section' : undefined
	});

	it('persists, deduplicates, pins, sorts and removes selected targets', async () => {
		const first = new IndexedDBSearchHistory();
		await first.record(createTarget(1));
		now += 10;
		await first.record(createTarget(2));
		await first.togglePinned((await first.list('docs-search-tests', 'zh-CN'))[1].id);

		const second = new IndexedDBSearchHistory();
		const records = await second.list('docs-search-tests', 'zh-CN');
		expect(records.map(record => [record.title, record.pinned])).toEqual([
			['Page 1', true],
			['Page 2', false]
		]);
		expect(await second.list('docs-search-tests', 'en-US')).toEqual([]);

		now += 10;
		await second.record(createTarget(1));
		expect(await second.list('docs-search-tests', 'zh-CN')).toHaveLength(2);
		await second.remove(records[0].id);
		expect((await second.list('docs-search-tests', 'zh-CN')).map(item => item.title))
			.toEqual(['Page 2']);
	});

	it('keeps at most twenty entries and refuses to evict an all-pinned list', async () => {
		const history = new IndexedDBSearchHistory();
		for (let index = 0; index < 21; index++) {
			now += 1;
			await history.record(createTarget(index));
		}
		let records = await history.list('docs-search-tests', 'zh-CN');
		expect(records).toHaveLength(20);
		expect(records.some(record => record.title === 'Page 0')).toBe(false);

		for (const record of records) await history.togglePinned(record.id);
		expect(await history.record(createTarget(99))).toBe(false);
		records = await history.list('docs-search-tests', 'zh-CN');
		expect(records).toHaveLength(20);
		expect(records.some(record => record.title === 'Page 99')).toBe(false);
	});
});
