// @vitest-environment jsdom
import { createMemoryHistory, createRouter } from 'vue-router';
import { installDocsCheck } from '../src/modules/check';

const { list, collectRouteResources } = vi.hoisted(() => ({
	list: vi.fn(async () => []),
	collectRouteResources: vi.fn(async () => [
		{ identity: { type: 'markdown', source: 'docs/a.md', lang: 'zh-CN' }, path: '/zh-CN/a' },
		{ identity: { type: 'page', source: 'home.json', lang: 'zh-CN' }, path: '/zh-CN' }
	])
}));
vi.mock('../src/modules/gateway', () => ({ Gateway: { list } }));
vi.mock('../src/modules/resource', () => ({ Resource: { plan: { collectRouteResources } } }));

describe('doc check hooks', () => {
	afterEach(() => {
		delete window.__DOCS_CHECK__;
	});

	const createTestRouter = () => createRouter({
		history: createMemoryHistory(),
		routes: [{ path: '/:pathMatch(.*)*', component: { render: () => null } }]
	});

	it('does nothing for normal visits', () => {
		installDocsCheck(createTestRouter(), { locales: {}, routes: {} });
		expect(window.__DOCS_CHECK__).toBeUndefined();
	});

	it('lists markdown routes and reports whether navigation changed the route', async () => {
		window.__DOCS_CHECK__ = {};
		const router = createTestRouter();
		await router.push('/zh-CN/a');
		const config = { locales: {}, routes: {} };
		installDocsCheck(router, config);
		const hooks = window.__DOCS_CHECK__ as Record<string, (...args: unknown[]) => Promise<unknown>>;
		expect(window.__DOCS_CHECK__.ready).toBe(true);
		expect(await hooks.routes()).toEqual([{ path: '/zh-CN/a', source: 'docs/a.md', lang: 'zh-CN' }]);
		expect(collectRouteResources).toHaveBeenCalledWith(config, []);
		expect(await hooks.navigate('/zh-CN/a')).toBe(false);
		expect(await hooks.navigate('/zh-CN/b')).toBe(true);
		expect(router.currentRoute.value.fullPath).toBe('/zh-CN/b');
	});
});
