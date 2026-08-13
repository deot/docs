// @vitest-environment jsdom

import { ResourcePlan } from '../src/modules/resource-plan';
import { Gateway } from '../src/modules/gateway';
import type { DocsConfig } from '../src/types';
import type { ResourceRecord } from '../src/modules/gateway';

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
		} as ResourceRecord;

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
		} as ResourceRecord;

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
		vi.spyOn(Gateway, 'load').mockResolvedValue({
			content: JSON.stringify([
				{ label: 'Button', value: '/components/button' },
				{ label: 'Package', value: '/packages/client?tab=api#install' },
				{ label: 'API', value: '/api/v1/users' }
			])
		} as any);

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
		vi.spyOn(Gateway, 'load').mockResolvedValue({
			content: JSON.stringify([{
				label: 'API',
				children: [
					{ label: 'Incomplete', value: '/api/v1' },
					{ label: 'Users', value: '/en-US/api/v2/users?view=all#top' }
				]
			}])
		} as any);

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
				'db': { content: 'default' },
				'/components/:name': { content: 'default', sidebar: './sidebar.json' }
			}
		};
		vi.spyOn(Gateway, 'load').mockResolvedValue({
			content: JSON.stringify([
				{ label: 'External', value: 'https://example.com/docs' },
				{ label: 'Unknown', value: '/other/value' }
			])
		} as any);

		await expect(ResourcePlan.resolveHomeEntry(config, 'zh-CN')).resolves.toBeNull();
	});
});
