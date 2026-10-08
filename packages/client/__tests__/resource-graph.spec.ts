// @vitest-environment jsdom

import {
	collectResourceImports,
	dependencyUrlCandidates,
	resolveDependencyRequestUrl,
	getResourceType,
	isSupportedDependency,
	resolveDependencyUrl,
	toLogicalResourceSource
} from '../src/utils/resource-graph';
import type { DocsConfig } from '../src/types';

const createConfig = (overrides: Partial<DocsConfig> = {}): DocsConfig => ({
	locales: { 'zh-CN': { label: '简体中文' } },
	routes: {},
	runtime: { mode: 'production' },
	...overrides
});

describe('resource graph helpers', () => {
	it('collects quoted and unquoted CSS imports', async () => {
		await expect(collectResourceImports(`
			@import url(./base.css);
			@import url("./theme.css") screen;
			@import './print.css';
		`, 'style')).resolves.toEqual([
			'./base.css',
			'./theme.css',
			'./print.css'
		]);
	});

	it('collects SFC src blocks and relative module dependencies', async () => {
		await expect(collectResourceImports(`
			<script src="./setup.ts"></script>
			<script>import './logic.js'; import 'vue';</script>
			<style src="./external.css"></style>
			<style>@import url(./theme.css);</style>
		`, 'sfc')).resolves.toEqual([
			'./setup.ts',
			'./logic.js',
			'vue',
			'./external.css',
			'./theme.css'
		]);
	});

	it.each([
		`import type { Props } from './types'`,
		`import type Props from './types'`,
		`import type * as Props from './types'`,
		`import type {\n Props\n} from './types'`,
		`export type { Props } from './types'`,
		`export type { Props }`
	])('keeps runtime dependencies after semicolonless type declarations: %s', async (declaration) => {
		const source = `${declaration}\nimport Helper from './helper';\nexport { Helper };`;
		await expect(collectResourceImports(source, 'module')).resolves.toEqual(['./helper']);
		await expect(collectResourceImports(`${source}\nconst view = <div />;`, 'module')).resolves.toEqual(['./helper']);
		await expect(collectResourceImports(`<script lang="ts">${source}</script>`, 'sfc')).resolves.toEqual(['./helper']);
	});

	it('resolves Sass directives, partials and GitHub npm dependencies', async () => {
		await expect(collectResourceImports(`@use 'sass:map'; @forward './theme'; @use '../style';`, 'style'))
			.resolves.toEqual(['./theme', '../style']);
		expect(getResourceType('https://example.com/style.scss')).toBe('style');
		expect(isSupportedDependency('./catalogue')).toBe(true);
		expect(isSupportedDependency('./image.png')).toBe(false);
		expect(dependencyUrlCandidates('./theme', 'https://example.com/demo.vue', true))
			.toContain('https://example.com/_theme.scss');
		expect(resolveDependencyRequestUrl('https://raw.githubusercontent.com/deot/vc/main/node_modules/@deot/style/src/mixins/bem.scss'))
			.toBe('https://cdn.jsdelivr.net/npm/@deot/style/src/mixins/bem.scss');
		expect(resolveDependencyRequestUrl('https://example.com/node_modules/style.scss'))
			.toBe('https://example.com/node_modules/style.scss');
	});

	it('keeps dependency identities relative to the stable production base', () => {
		const config = createConfig({ base: 'https://docs.example.com/project/' });
		expect(toLogicalResourceSource(
			config,
			'zh-CN',
			'https://docs.example.com/project/zh-CN/components/button.css?raw'
		)).toBe('./components/button.css?raw');
		expect(toLogicalResourceSource(
			config,
			'zh-CN',
			'https://cdn.example.com/button.css'
		)).toBe('https://cdn.example.com/button.css');
	});

	it('maps root workspace dependencies back to logical sources', () => {
		const config = createConfig({
			runtime: { mode: 'development', workspace: '/' }
		});
		expect(toLogicalResourceSource(
			config,
			'zh-CN',
			`${location.origin}/zh-CN/components/button.css?raw`
		)).toBe('./components/button.css?raw');
	});

	it('classifies and resolves supported relative dependency URLs', () => {
		expect(getResourceType('./demo.vue')).toBe('sfc');
		expect(getResourceType('./logic.ts?raw')).toBe('module');
		expect(getResourceType('./theme.css#dark')).toBe('style');
		expect(isSupportedDependency('./logic.ts')).toBe(true);
		expect(isSupportedDependency('vue')).toBe(false);
		expect(resolveDependencyUrl(
			'../theme.css',
			'https://docs.example.com/zh-CN/components/demo.vue'
		)).toBe('https://docs.example.com/zh-CN/theme.css');
	});
});
