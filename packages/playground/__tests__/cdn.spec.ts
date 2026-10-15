// @vitest-environment jsdom

import { cdnModuleName, createBuiltinImports, createBuiltinStyles, createCdnResolver, resolveCdnURL } from '../src/cdn';
import { createRuntimePreviewOptions, createRuntimeStore } from '../src/core/store';
import { createRemoteLoader } from '../src/core/runtime/local/remote';
import { loadSass, setSassLoader } from '../src/core/scss';

const jsdelivr = 'https://cdn.jsdelivr.net/npm/';
const unpkg = 'https://esm.unpkg.com/';

describe('CDN address resolution', () => {
	afterEach(() => {
		delete (window as Partial<Window>).$docs;
		vi.unstubAllGlobals();
	});

	it.each([
		[`${jsdelivr}@scope/widget@1.2.3/+esm?target=es2022#entry`, unpkg, `${unpkg}@scope/widget@1.2.3?target=es2022#entry`],
		['https://unpkg.com/widget@2.0.0', jsdelivr, `${jsdelivr}widget@2.0.0/+esm`],
		[`${unpkg}widget@2.0.0`, jsdelivr, `${jsdelivr}widget@2.0.0/+esm`],
		[`${unpkg}@scope/widget@2.0.0/feature`, jsdelivr, `${jsdelivr}@scope/widget@2.0.0/feature/+esm`],
		[`${unpkg}widget@2.0.0/dist/index.js`, jsdelivr, `${jsdelivr}widget@2.0.0/dist/index.js/+esm`],
		[`${unpkg}@scope/widget@2.0.0/dist/index.css?theme=dark`, jsdelivr, `${jsdelivr}@scope/widget@2.0.0/dist/index.css?theme=dark`],
		[`${jsdelivr}vue/dist/vue.runtime.esm-browser.js`, unpkg, `${unpkg}vue/dist/vue.runtime.esm-browser.js`]
	])('converts %s to the selected node', (url, cdn, expected) => {
		expect(resolveCdnURL(url, undefined, { runtime: { cdn } })).toBe(expected);
	});

	it('applies the hook after builtin conversion and retains a custom final address', () => {
		const cdn = vi.fn(({ url }: { url: string }) => `https://private.test/?source=${encodeURIComponent(url)}`);
		const url = `${jsdelivr}sass/+esm`;
		expect(resolveCdnURL(url, jsdelivr, { runtime: { cdn: unpkg }, resolve: { cdn } }))
			.toBe(`https://private.test/?source=${encodeURIComponent(`${unpkg}sass`)}`);
		expect(cdn).toHaveBeenCalledExactlyOnceWith({ url: `${unpkg}sass` });
	});

	it.each([null, undefined, ''])('retains builtin conversion when the hook returns %s', (value) => {
		expect(resolveCdnURL(`${jsdelivr}sass/+esm`, undefined, {
			runtime: { cdn: unpkg }, resolve: { cdn: () => value }
		})).toBe(`${unpkg}sass`);
	});

	it('leaves local and unrelated sources intact and still offers them to the hook', () => {
		const cdn = vi.fn();
		for (const url of ['/__docs/module/feature', 'https://raw.githubusercontent.com/user/repo/main/App.vue']) {
			expect(resolveCdnURL(url, unpkg, { resolve: { cdn } })).toBe(url);
		}
		expect(cdn).toHaveBeenCalledTimes(2);
	});

	it('memoizes final results so dependency revisits do not invoke the hook again', () => {
		const cdn = vi.fn(({ url }: { url: string }) => `${url}?signed=1`);
		window.$docs = { locales: {}, routes: {}, runtime: { mode: 'production', cdn: unpkg }, resolve: { cdn } };
		const resolve = createCdnResolver();
		const source = `${jsdelivr}widget/+esm`;
		const result = resolve(source);
		expect(resolve(source)).toBe(result);
		expect(resolve(result)).toBe(result);
		expect(cdn).toHaveBeenCalledTimes(1);
	});

	it('keeps definitions raw while iframe imports, file overrides and CSS use the selected node', async () => {
		const cdn = vi.fn(({ url }: { url: string }) => `${url}?signed=1`);
		window.$docs = { locales: {}, routes: {}, runtime: { mode: 'production', cdn: unpkg }, resolve: { cdn } };
		const files = {
			'App.vue': `<script setup>import { ready } from 'widget';</script><template>{{ ready }}</template>`,
			'import-map.json': JSON.stringify({ imports: { widget: `${jsdelivr}widget@1.0.0/+esm` } })
		};
		const store = createRuntimeStore(files, 'App.vue', {});
		await vi.waitFor(() => expect(store.files['src/App.vue'].compiled.js).toContain('ready'));
		expect(store.getImportMap().imports?.widget).toBe(`${unpkg}widget@1.0.0?signed=1`);
		expect(store.resourceLinks?.esModuleShims).toContain(`${unpkg}es-module-shims@1.5.18/dist/es-module-shims.wasm.js?raw`);
		const count = cdn.mock.calls.length;
		store.getImportMap();
		expect(cdn).toHaveBeenCalledTimes(count);
		expect(store.files['import-map.json'].code).toContain(`${jsdelivr}widget@1.0.0/+esm`);
		expect(createBuiltinImports()['lodash-es']).toBe(`${jsdelivr}lodash-es/+esm`);
		expect(Object.values(createBuiltinStyles()).every(url => url.startsWith(jsdelivr))).toBe(true);
		expect(createRuntimePreviewOptions().headHTML).toContain(`${unpkg}@deot/style/dist/index.css?signed=1`);
	});

	it('converts literal HTTP imports and import() in iframe source only once', async () => {
		const cdn = vi.fn(({ url }: { url: string }) => `${url}?signed=1`);
		window.$docs = { locales: {}, routes: {}, runtime: { mode: 'production', cdn: unpkg }, resolve: { cdn } };
		const store = createRuntimeStore({
			'App.vue': `<script setup>import { value } from '${jsdelivr}qa-absolute/+esm';
			const lazy = () => import('${jsdelivr}qa-lazy/+esm');</script><template>{{ value }}</template>`
		}, 'App.vue', {});
		await vi.waitFor(() => expect(store.files['src/App.vue'].compiled.js).toContain(`${unpkg}qa-absolute?signed=1`));
		expect(store.files['src/App.vue'].compiled.js).toContain(`${unpkg}qa-lazy?signed=1`);
		expect(cdn.mock.calls.filter(([{ url }]) => url.includes('qa-absolute') || url.includes('qa-lazy'))).toHaveLength(2);
	});

	it('routes online Sass through the selected CDN and final hook before importing it', () => {
		setSassLoader();
		const cdn = vi.fn(() => { throw new Error('before Sass import'); });
		window.$docs = { locales: {}, routes: {}, runtime: { mode: 'production', cdn: unpkg }, resolve: { cdn } };
		expect(loadSass).toThrow('before Sass import');
		expect(cdn).toHaveBeenCalledExactlyOnceWith({ url: `${unpkg}sass` });
	});

	it('resolves local module requests and their transitive imports once without changing the import map', async () => {
		const cdn = vi.fn(({ url }: { url: string }) => `${url}?signed=1`);
		window.$docs = { locales: {}, routes: {}, runtime: { mode: 'production', cdn: unpkg }, resolve: { cdn } };
		const source = `${jsdelivr}feature@1.0.0/dist/index.js`;
		const imports = { feature: source };
		const fetcher = vi.fn(async (url: string) => ({
			ok: true,
			text: async () => url.includes('/child.js') ? 'export const value = 42;' : `export { value } from './child.js';`
		} as Response));
		vi.stubGlobal('fetch', fetcher);
		const loader = createRemoteLoader(imports, { vue: {}, vueRouter: {} });
		await expect(loader.load(source)).resolves.toMatchObject({ value: 42 });
		expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
			`${unpkg}feature@1.0.0/dist/index.js?signed=1`,
			`${unpkg}feature@1.0.0/dist/child.js?signed=1`
		]);
		expect(cdn).toHaveBeenCalledTimes(2);
		expect(imports.feature).toBe(source);
	});

	it('reuses host Vue when an ESM UNPKG dependency refers to its generated build path', async () => {
		window.$docs = { locales: {}, routes: {}, runtime: { mode: 'production', cdn: unpkg } };
		const source = `${jsdelivr}host-test@1.0.0/+esm`;
		const ref = () => 'host-vue';
		const fetcher = vi.fn(async () => ({
			ok: true,
			text: async () => `import { ref } from '${unpkg}vue@3.5.43/es2022/vue.mjs'; export const value = ref();`
		} as Response));
		vi.stubGlobal('fetch', fetcher);
		await expect(createRemoteLoader({ feature: source }, { vue: { ref }, vueRouter: {} }).load(source))
			.resolves.toMatchObject({ value: 'host-vue' });
		expect(fetcher).toHaveBeenCalledTimes(1);
	});

	it('recognizes package entry URLs from both ESM providers for host module reuse', () => {
		for (const url of [`${jsdelivr}vue@3.5.43/+esm`, `${unpkg}vue@3.5.43`, `${unpkg}vue@3.5.43/es2022/vue.mjs`]) {
			expect(cdnModuleName(url)).toBe('vue');
		}
		expect(cdnModuleName('https://example.com/vue')).toBeNull();
	});
});
