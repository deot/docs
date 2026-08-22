// @vitest-environment jsdom

import { Resource } from '../src/modules/resource';
import { Gateway } from '../src/modules/gateway';
import { defineRendererModule } from '@deot/docs-renderer';
import { defineComponent } from 'vue';
import type { DocsConfig } from '../src/types';
import { createContentRecord } from './fixtures/docs';

const component = defineComponent(() => () => null);
const pageLayout = { mode: 'sortable' as const, maxWidth: 1180, minHeight: 600, background: '#fff' };
const appearance = { marginTop: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 };
const ResourcePlan = Resource.plan;
const resourceModule = (
	type: string,
	collectResources: (props: Record<string, unknown>) => Array<{ type: string; source: string }>
) => defineRendererModule({
	identity: { type, version: 1, label: type, category: 'Test' },
	widget: { visible: true },
	data: { create: () => ({}) },
	viewer: component,
	editor: component,
	frames: { sortable: {} },
	integrations: { collectResources }
});

describe('ResourcePlan route resources', () => {
	afterEach(() => vi.restoreAllMocks());

	it('maps static, redirected and sidebar dynamic Markdown to localized routes', async () => {
		const config: DocsConfig = {
			namespace: 'route-search-tests',
			locales: { 'zh-CN': { label: '简体中文' } },
			routes: {
				'/': '/guide',
				'/guide': { value: 'guide', content: 'default', sidebar: './sidebar.json' },
				'/:name': { content: 'default', sidebar: './sidebar.json' },
				'/alias': '/guide'
			},
			resolve: {
				markdown: ({ value }) => `./${value}.md`
			}
		};
		const sidebar = {
			identity: {
				namespace: 'route-search-tests',
				lang: 'zh-CN',
				type: 'sidebar' as const,
				source: './sidebar.json'
			},
			content: JSON.stringify([{
				label: 'Group',
				children: [{ label: 'Dynamic', value: '/dynamic' }]
			}])
		};

		const resources = await ResourcePlan.collectRouteResources(config, [sidebar]);
		expect(resources.map(item => [item.identity.source, item.path])).toEqual([
			['./guide.md', '/zh-CN/guide'],
			['./dynamic.md', '/zh-CN/dynamic']
		]);
	});

	it('provides Vue Router compatible pathMatch params to catch-all value functions', async () => {
		const config: DocsConfig = {
			namespace: 'catch-all-search-tests',
			locales: { 'zh-CN': { label: '简体中文' } },
			routes: {
				'/guide': { value: 'guide', content: 'default', sidebar: './sidebar.json' },
				'*': {
					content: 'default',
					value: route => `fallback-${(route.params.pathMatch as string[]).join('-')}`
				}
			},
			resolve: { markdown: ({ value }) => `./${value}.md` }
		};
		const sidebar = {
			identity: {
				namespace: 'catch-all-search-tests',
				lang: 'zh-CN',
				type: 'sidebar' as const,
				source: './sidebar.json'
			},
			content: JSON.stringify([{ label: 'Fallback', value: '/missing/deep' }])
		};

		const resources = await ResourcePlan.collectRouteResources(config, [sidebar]);
		expect(resources.map(item => [item.identity.source, item.path])).toContainEqual([
			'./fallback-missing-deep.md',
			'/zh-CN/missing/deep'
		]);
	});

	it('uses route declaration order before sidebar order for the home entry', async () => {
		const config: DocsConfig = {
			namespace: 'home-entry-tests',
			locales: { 'zh-CN': { label: '简体中文' }, 'en-US': { label: 'English' } },
			routes: {
				'/packages/:name': { content: 'default', sidebar: './sidebar.json' },
				'/components/:name': { content: 'default', sidebar: './sidebar.json' },
				'/api/:version/:name': { content: 'default', sidebar: './sidebar.json' }
			},
			resolve: { resource: ({ source }) => `/site/${source.replace(/^\.\//, '')}` }
		};
		vi.spyOn(Gateway, 'load').mockResolvedValue(createContentRecord({
			content: JSON.stringify([
				{ label: 'Button', value: '/components/button' },
				{ label: 'Package', value: '/packages/client?tab=api#install' },
				{ label: 'API', value: '/api/v1/users' }
			])
		}));

		await expect(ResourcePlan.resolveHomeEntry(config, 'zh-CN')).resolves
			.toBe('/zh-CN/packages/client?tab=api#install');
		expect(Gateway.load).toHaveBeenCalledTimes(1);
	});

	it('uses direct sidebar data for home, search and prefetch plans', async () => {
		const config: DocsConfig = {
			namespace: 'inline-sidebar-tests',
			locales: { 'zh-CN': { label: '简体中文' }, 'en-US': { label: 'English' } },
			routes: {
				'/components/:name': {
					content: 'default',
					sidebar: {
						'zh-CN': [{ label: '按钮', value: '/components/button' }],
						'en-US': [{ label: 'Input', value: '/components/input' }]
					}
				}
			},
			resolve: { markdown: ({ value }) => `./${value}.md` }
		};
		const loadSpy = vi.spyOn(Gateway, 'load');

		await expect(ResourcePlan.resolveHomeEntry(config, 'en-US')).resolves
			.toBe('/en-US/components/input');
		expect(loadSpy).not.toHaveBeenCalled();

		const resources = await ResourcePlan.collectRouteResources(config, []);
		expect(resources.map(item => [item.identity.source, item.path])).toEqual([
			['./button.md', '/zh-CN/components/button'],
			['./input.md', '/en-US/components/input']
		]);

		const prefetch = vi.fn(async identities => identities.map(() => ({
			status: 'fulfilled',
			value: {}
		})));
		vi.spyOn(Gateway, 'list').mockResolvedValue([]);
		const plan = await ResourcePlan.build({ config, strict: true, prefetchResources: prefetch });
		expect([...plan.collector.identities.values()].map(identity => identity.source))
			.toEqual(['./button.md', './input.md']);
	});

	it('supports arbitrary multi-parameter routes and explicit sidebar languages', async () => {
		const config: DocsConfig = {
			namespace: 'multi-param-home-tests',
			locales: { 'zh-CN': { label: '简体中文' }, 'en-US': { label: 'English' } },
			routes: {
				'/packages/:name': { content: 'default', sidebar: 'default' },
				'/api/:version/:name': { content: 'default', sidebar: 'default' }
			}
		};
		vi.spyOn(Gateway, 'load').mockResolvedValue(createContentRecord({
			content: JSON.stringify([{
				label: 'API',
				children: [
					{ label: 'Incomplete', value: '/api/v1' },
					{ label: 'Users', value: '/en-US/api/v2/users?view=all#top' }
				]
			}])
		}));

		await expect(ResourcePlan.resolveHomeEntry(config, 'zh-CN')).resolves
			.toBe('/en-US/api/v2/users?view=all#top');
	});

	it('falls through unavailable sidebars and uses the first static content route', async () => {
		const config: DocsConfig = {
			namespace: 'static-home-tests',
			locales: { 'zh-CN': { label: '简体中文' } },
			routes: {
				'/components/:name': { content: 'default', sidebar: './missing.json' },
				'/empty': { content: null },
				'/guide': { content: 'default' }
			}
		};
		vi.spyOn(Gateway, 'load').mockRejectedValue(new Error('offline'));

		await expect(ResourcePlan.resolveHomeEntry(config, 'zh-CN')).resolves
			.toBe('/zh-CN/guide');
	});

	it('returns null when sidebar values cannot instantiate any business route', async () => {
		const config: DocsConfig = {
			namespace: 'empty-home-tests',
			locales: { 'zh-CN': { label: '简体中文' } },
			routes: {
				'/external': 'https://example.com/docs',
				'/__docs/database': { content: 'default' },
				'/components/:name': { content: 'default', sidebar: './sidebar.json' }
			}
		};
		vi.spyOn(Gateway, 'load').mockResolvedValue(createContentRecord({
			content: JSON.stringify([
				{ label: 'External', value: 'https://example.com/docs' },
				{ label: 'Unknown', value: '/other/value' }
			])
		}));

		await expect(ResourcePlan.resolveHomeEntry(config, 'zh-CN')).resolves.toBeNull();
	});

	it('discovers renderer-declared page dependencies for prefetch and prune plans', async () => {
		const config: DocsConfig = {
			namespace: 'page-plan-tests',
			locales: { 'zh-CN': { label: '简体中文' } },
			routes: { '/landing': { content: './landing.page.json' } },
			renderers: [resourceModule('test:resource', props => [{ type: 'markdown', source: String(props.source) }])]
		};
		const page = createContentRecord({
			identity: {
				namespace: 'page-plan-tests',
				lang: 'zh-CN',
				type: 'page',
				source: './landing.page.json'
			},
			url: 'https://docs.example.com/landing.page.json',
			content: JSON.stringify({
				schemaVersion: 2,
				meta: { id: 'landing' },
				layout: pageLayout,
				blocks: [{
					id: 'content',
					module: {
						type: 'test:resource',
						version: 1,
						props: { source: './landing.md' }
					},
					appearance
				}]
			})
		});
		vi.spyOn(Gateway, 'list').mockResolvedValue([page]);
		const prefetch = vi.fn(async identities => identities.map(() => ({
			status: 'fulfilled' as const,
			value: page
		})));
		const plan = await ResourcePlan.build({ config, prefetchResources: prefetch });
		expect([...plan.collector.identities.values()].map(item => item.source)).toEqual([
			'./landing.page.json',
			'./landing.md'
		]);
	});

	it('refuses strict plans when a page dependency graph cannot be proven complete', async () => {
		const config: DocsConfig = {
			namespace: 'strict-page-tests',
			locales: { 'en-US': { label: 'English' } },
			routes: { '/landing': { content: './landing.page.json' } },
			renderers: [resourceModule('company:unsupported', () => [{ type: 'binary', source: './asset.bin' }])]
		};
		const identity = {
			namespace: 'strict-page-tests',
			lang: 'en-US',
			type: 'page' as const,
			source: './landing.page.json'
		};
		const prefetch = vi.fn(async identities => identities.map(() => ({
			status: 'fulfilled' as const
		})));
		vi.spyOn(Gateway, 'list').mockResolvedValue([]);
		await expect(ResourcePlan.build({ config, strict: false, prefetchResources: prefetch }))
			.resolves.toBeDefined();
		await expect(ResourcePlan.build({ config, strict: true, prefetchResources: prefetch }))
			.rejects.toThrow('Cannot inspect page resource');

		const page = createContentRecord({
			identity,
			url: 'https://docs.example.com/landing.page.json',
			content: JSON.stringify({
				schemaVersion: 2,
				meta: { id: 'landing' },
				layout: pageLayout,
				blocks: [{
					id: 'unknown',
					module: { type: 'company:missing', version: 1, props: {} },
					appearance
				}]
			})
		});
		vi.mocked(Gateway.list).mockResolvedValue([page]);
		const unknownContent = page.content;
		page.content = '{ invalid';
		await expect(ResourcePlan.build({ config, strict: false, prefetchResources: prefetch }))
			.resolves.toBeDefined();
		page.content = unknownContent;
		await expect(ResourcePlan.build({ config, strict: false, prefetchResources: prefetch }))
			.resolves.toEqual(expect.objectContaining({ collector: expect.any(Object) }));
		await expect(ResourcePlan.build({ config, strict: true, prefetchResources: prefetch }))
			.rejects.toThrow('unknown renderer module');

		page.content = JSON.stringify({
			schemaVersion: 2,
			meta: { id: 'landing' },
			layout: pageLayout,
			blocks: [{
				id: 'unsupported',
				module: { type: 'company:unsupported', version: 1, props: {} },
				appearance
			}]
		});
		await expect(ResourcePlan.build({ config, strict: true, prefetchResources: prefetch }))
			.rejects.toThrow('Unsupported renderer resource type');
	});

	it('recursively expands page resources declared by Renderer modules', async () => {
		const config: DocsConfig = {
			namespace: 'nested-page-tests',
			locales: { 'en-US': { label: 'English' } },
			routes: { '/landing': { content: './landing.page.json' } },
			renderers: [resourceModule('company:nested-page', props => props.source
				? [{ type: 'page', source: String(props.source) }]
				: [])]
		};
		const createPage = (source: string, nested = '') => createContentRecord({
			identity: { namespace: 'nested-page-tests', lang: 'en-US', type: 'page', source },
			url: `https://docs.example.com/${source}`,
			content: JSON.stringify({
				schemaVersion: 2,
				meta: { id: source },
				layout: pageLayout,
				blocks: [{
					id: source,
					module: {
						type: 'company:nested-page',
						version: 1,
						props: nested ? { source: nested } : {}
					},
					appearance
				}]
			})
		});
		vi.spyOn(Gateway, 'list').mockResolvedValue([
			createPage('./landing.page.json', './child.page.json'),
			createPage('./child.page.json')
		]);
		const prefetch = vi.fn(async identities => identities.map(() => ({
			status: 'fulfilled' as const
		})));
		const plan = await ResourcePlan.build({ config, strict: true, prefetchResources: prefetch });
		expect([...plan.collector.identities.values()].map(item => item.source))
			.toEqual(['./landing.page.json', './child.page.json']);
		expect(prefetch).toHaveBeenCalledWith([
			expect.objectContaining({ source: './child.page.json', type: 'page' })
		]);
	});

	it('reports rejected discovered and deferred Markdown resources in strict mode', async () => {
		const deferredConfig: DocsConfig = {
			namespace: 'deferred-rejection',
			locales: { 'en-US': { label: 'English' } },
			routes: { '/guide': { value: 'guide', content: 'default' } },
			resolve: { markdown: ({ value }) => `./${value}.md` }
		};
		vi.spyOn(Gateway, 'list').mockResolvedValue([]);
		const rejectAll = vi.fn(async identities => identities.map(() => ({
			status: 'rejected' as const,
			reason: new Error('offline')
		})));
		await expect(ResourcePlan.build({
			config: deferredConfig,
			strict: true,
			graphFirst: true,
			prefetchResources: rejectAll
		})).rejects.toThrow('route resource unavailable');

		const discoveredConfig: DocsConfig = {
			namespace: 'discovered-rejection',
			locales: { 'en-US': { label: 'English' } },
			routes: { '/components/:name': { content: 'default', sidebar: './sidebar.json' } }
		};
		vi.mocked(Gateway.list).mockResolvedValue([createContentRecord({
			identity: {
				namespace: 'discovered-rejection',
				lang: 'en-US',
				type: 'sidebar',
				source: './sidebar.json'
			},
			content: JSON.stringify([{ label: 'Button', value: '/components/button' }])
		})]);
		const prefetch = vi.fn(async identities => identities.map(identity => identity.type === 'sidebar'
			? { status: 'fulfilled' as const }
			: { status: 'rejected' as const, reason: new Error('offline') }));
		await expect(ResourcePlan.build({
			config: discoveredConfig,
			strict: true,
			prefetchResources: prefetch
		})).rejects.toThrow('route resource unavailable');
	});

	it('skips malformed optional module dependency graphs outside strict mode', async () => {
		const config: DocsConfig = {
			namespace: 'optional-graph',
			locales: { 'en-US': { label: 'English' } },
			routes: { '/runtime': { content: './runtime.js' } }
		};
		const record = createContentRecord({
			identity: {
				namespace: 'optional-graph',
				lang: 'en-US',
				type: 'module',
				source: './runtime.js'
			},
			url: 'https://docs.example.com/runtime.js',
			content: 'import {'
		});
		vi.spyOn(Gateway, 'list').mockResolvedValue([record]);
		const prefetch = vi.fn(async identities => identities.map(() => ({
			status: 'fulfilled' as const
		})));
		await expect(ResourcePlan.build({ config, prefetchResources: prefetch })).resolves.toBeDefined();

		record.url = 'not a url';
		record.content = `import './dependency.js'`;
		await expect(ResourcePlan.build({ config, prefetchResources: prefetch })).resolves.toBeDefined();
	});

	it('collects a built-in home page resource when routes do not own /', async () => {
		const config: DocsConfig = {
			namespace: 'builtin-home-page-tests',
			locales: { 'zh-CN': { label: '简体中文' } },
			routes: {},
			home: { locales: { 'zh-CN': './pages/home.page.json' } }
		};
		const resources = await ResourcePlan.collectRouteResources(config, []);
		expect(resources.map(item => [item.identity.source, item.path, item.identity.type])).toEqual([
			['./pages/home.page.json', '/zh-CN', 'page']
		]);
		const prefetch = vi.fn(async identities => identities.map(() => ({
			status: 'fulfilled' as const
		})));
		vi.spyOn(Gateway, 'list').mockResolvedValue([]);
		const plan = await ResourcePlan.build({ config, prefetchResources: prefetch });
		expect([...plan.collector.identities.values()].map(item => item.source)).toEqual([
			'./pages/home.page.json'
		]);
	});
});
