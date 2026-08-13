// @vitest-environment jsdom

import {
	collectResourceImports,
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
