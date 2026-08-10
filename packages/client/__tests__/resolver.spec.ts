// @vitest-environment jsdom

import {
	createResourceIdentity,
	getDefaultLanguage,
	getDocsBase,
	getDocsDeploymentBase,
	getDocsNamespace,
	resolveResource
} from '../src/utils/resolver';
import {
	getDocsConfig,
	getDocsRuntime,
	initializeDocsRuntime
} from '../src/utils/runtime';
import type { DocsConfig } from '../src/types';

const createConfig = (overrides: Partial<DocsConfig> = {}): DocsConfig => ({
	locales: { 'zh-CN': '简体中文', 'en-US': 'English' },
	routes: {},
	...overrides
});

describe('resource resolver', () => {
	it('resolves logical resources directly from the development workspace', async () => {
		const config = createConfig({
			runtime: { mode: 'development', workspace: '/site/' }
		});
		expect(await resolveResource(config, {
			source: './installation.md',
			type: 'markdown',
			lang: 'zh-CN'
		})).toBe('/site/zh-CN/installation.md');
	});

	it('resolves production resources against base and relative imports against importer', async () => {
		const config = createConfig({
			base: 'https://docs.example.com/assets/',
			runtime: { mode: 'production' }
		});
		expect(await resolveResource(config, {
			source: './quickstart.md',
			type: 'markdown',
			lang: 'en-US'
		})).toBe('https://docs.example.com/assets/en-US/quickstart.md');
		expect(await resolveResource(config, {
			source: './button.css',
			type: 'style',
			lang: 'en-US',
			importer: 'https://docs.example.com/assets/en-US/button/index.vue'
		})).toBe('https://docs.example.com/assets/en-US/button/button.css');
	});

	it('uses an explicit namespace for logical resource identity', () => {
		const config = createConfig({ namespace: 'site-a' });
		expect(getDocsNamespace(config)).toBe('site-a');
		expect(createResourceIdentity(config, 'zh-CN', 'markdown', './index.md')).toEqual({
			namespace: 'site-a',
			lang: 'zh-CN',
			type: 'markdown',
			source: './index.md'
		});
	});

	it('supports custom resolvers, absolute resources and default values', async () => {
		const resource = vi.fn(async ({ source }) => `custom:${source}`);
		const custom = createConfig({ resolve: { resource } });
		expect(await resolveResource(custom, {
			source: './custom.md', type: 'markdown', lang: 'zh-CN'
		})).toBe('custom:./custom.md');
		expect(resource).toHaveBeenCalledOnce();

		const production = createConfig({ runtime: { mode: 'production' } });
		expect(await resolveResource(production, {
			source: 'https://cdn.example.com/index.md', type: 'markdown', lang: 'zh-CN'
		})).toBe('https://cdn.example.com/index.md');
		expect(await resolveResource(production, {
			source: '/shared/index.md', type: 'markdown', lang: 'zh-CN'
		})).toBe('/shared/index.md');
		expect(await resolveResource(production, {
			source: 'data:text/plain,docs', type: 'module', lang: 'zh-CN'
		})).toBe('data:text/plain,docs');
		expect(await resolveResource(production, {
			source: 'blob:https://docs.example.com/id', type: 'module', lang: 'zh-CN'
		})).toBe('blob:https://docs.example.com/id');
		expect(await resolveResource(production, {
			source: '//cdn.example.com/index.md', type: 'markdown', lang: 'zh-CN'
		})).toBe('//cdn.example.com/index.md');
		expect(getDefaultLanguage(createConfig())).toBe('zh-CN');
		expect(getDefaultLanguage(createConfig({ locales: {} }))).toBe('zh-CN');
		expect(getDocsNamespace(production)).toBe(new URL('/', location.href).href);
	});

	it('infers and freezes the deployment base across nested routes', async () => {
		const previous = `${location.pathname}${location.search}${location.hash}`;
		window.history.replaceState({}, '', '/docs/site/zh-CN/components/button?tab=api#demo');
		try {
			const production = createConfig({ runtime: { mode: 'production' } });
			expect(getDocsDeploymentBase(production)).toBe(`${location.origin}/docs/site/`);
			expect(getDocsBase(production)).toBe(`${location.origin}/docs/site/`);
			expect(getDocsNamespace(production)).toBe(`${location.origin}/docs/site/`);
			expect(await resolveResource(production, {
				source: './button.md', type: 'markdown', lang: 'zh-CN'
			})).toBe(`${location.origin}/docs/site/zh-CN/button.md`);

			window.history.replaceState({}, '', '/docs/site/en-US/installation');
			expect(getDocsBase(production)).toBe(`${location.origin}/docs/site/`);
		} finally {
			window.history.replaceState({}, '', previous || '/');
		}
	});

	it('uses resolver defaults for workspace, base and identity keys', async () => {
		const development = createConfig({ runtime: { mode: 'development' } });
		expect(await resolveResource(development, {
			source: './guide.md', type: 'markdown', lang: '/en-US/'
		})).toBe('/site/en-US/guide.md');

		const production = createConfig({
			base: 'https://docs.example.com/root/',
			runtime: { mode: 'production' }
		});
		expect(getDocsNamespace(production)).toBe('https://docs.example.com/root/');
		expect(createResourceIdentity(production, 'en-US', 'markdown', './a b.md'))
			.toMatchObject({ namespace: 'https://docs.example.com/root/' });
		await expect(resolveResource(development, {
			source: '../package.json', type: 'markdown', lang: 'en-US'
		})).rejects.toThrow('escapes its language directory');
		await expect(resolveResource(development, {
			source: '%2e%2e/package.json', type: 'markdown', lang: 'en-US'
		})).rejects.toThrow('escapes its language directory');
		await expect(resolveResource(development, {
			source: './%2Fetc.ts', type: 'module', lang: 'en-US'
		})).rejects.toThrow('escapes its language directory');
		await expect(resolveResource(development, {
			source: './%00invalid.ts', type: 'module', lang: 'en-US'
		})).rejects.toThrow('escapes its language directory');
		await expect(resolveResource(development, {
			source: './guide.md', type: 'markdown', lang: '../private'
		})).rejects.toThrow('Invalid resource language');
		await expect(resolveResource(development, {
			source: './guide.md', type: 'markdown', lang: 'en%2Fprivate'
		})).rejects.toThrow('Invalid resource language');
	});

	it('infers the fallback language segment when locales are empty', () => {
		const previous = location.pathname;
		window.history.replaceState({}, '', '/project/docs/zh-CN/guide');
		try {
			expect(getDocsBase(createConfig({ locales: {} })))
				.toBe(`${location.origin}/project/docs/`);
		} finally {
			window.history.replaceState({}, '', previous || '/');
		}
	});

	it('initializes development and production runtime on window.$docs', () => {
		window.$docs = createConfig();
		delete window.__DOCS_RUNTIME__;
		expect(initializeDocsRuntime()).toEqual({ mode: 'production' });
		expect(getDocsRuntime()).toEqual({ mode: 'production' });
		expect(getDocsConfig()).toBe(window.$docs);

		window.__DOCS_RUNTIME__ = { mode: 'development', workspace: '/custom/' };
		expect(initializeDocsRuntime()).toEqual({ mode: 'development', workspace: '/custom/' });

		delete (window as Partial<Window>).$docs;
		delete window.__DOCS_RUNTIME__;
		expect(initializeDocsRuntime()).toEqual({ mode: 'production' });
		delete window.$docs.runtime;
		expect(getDocsRuntime()).toEqual({ mode: 'production' });
	});
});
