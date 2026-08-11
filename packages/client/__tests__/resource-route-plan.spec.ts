// @vitest-environment jsdom

import { ResourcePlan } from '../src/modules/resource-plan';
import type { DocsConfig } from '../src/types';
import type { ResourceRecord } from '../src/modules/gateway';

describe('ResourcePlan route resources', () => {
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
});
