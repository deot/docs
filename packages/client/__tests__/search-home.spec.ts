// @vitest-environment jsdom

import 'fake-indexeddb/auto';
import { Search } from '../src/modules/search';

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

describe('inline home search', () => {
	beforeEach(() => {
		window.$docs = {
			namespace: 'docs-search-home',
			locales: { 'zh-CN': { label: '简体中文' } },
			routes: {},
			home: {
				locales: {
					'zh-CN': {
						schemaVersion: 2,
						meta: { id: 'inline-home', title: 'Inline Home' },
						layout: { mode: 'sortable', maxWidth: 1180, minHeight: 600, background: '#fff' },
						blocks: [{
							id: 'hero',
							module: {
								type: 'hero',
								version: 1,
								props: { title: 'Welcome', description: 'Searchable home canvas' }
							},
							appearance: { marginTop: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 }
						}]
					}
				}
			}
		};
		list.mockResolvedValue([]);
		collectRouteResources.mockResolvedValue([]);
	});

	it('indexes an inline built-in home document without a Gateway record', async () => {
		const results = await Search.query('zh-CN', 'searchable home');
		expect(results).toEqual(expect.arrayContaining([
			expect.objectContaining({ title: 'Inline Home', path: '/zh-CN', source: 'home' })
		]));
	});
});
