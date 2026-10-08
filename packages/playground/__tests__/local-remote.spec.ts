import * as Vue from 'vue';
import { createBuiltinImports } from '../src/cdn';
import { createRemoteLoader } from '../src/core/runtime/local/remote';

describe('local remote modules', () => {
	const vueUrl = 'https://example.test/vue.js';
	const helperUrl = 'https://example.test/helper.js';
	const buttonUrl = 'https://example.test/button.js';

	beforeEach(() => {
		vi.stubGlobal('fetch', vi.fn(async (url: string) => {
			const files: Record<string, string> = {
				[helperUrl]: `import { ref } from 'vue';\nexport const mark = ref('helper');\n`,
				[buttonUrl]: `import { mark } from '@deot/helper';\nexport const Button = mark;\n`,
				[vueUrl]: `export const ref = () => 'cdn-vue';\n`
			};
			const text = files[url];
			if (!text) return { ok: false, status: 404, statusText: 'Not Found', text: async () => '' };
			return { ok: true, status: 200, statusText: 'OK', text: async () => text };
		}));
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('keeps the host vue when the import map uses the default cdn url', async () => {
		const loader = createRemoteLoader({
			'vue': createBuiltinImports().vue,
			'@deot/helper': helperUrl,
			'@deot/vc': buttonUrl,
			'lodash-es': 'https://example.test/lodash.js'
		}, { vue: Vue, vueRouter: {} });
		const loaded = await loader.load(buttonUrl) as { Button: { value: string } };
		expect(loaded.Button.value).toBe('helper');
		expect(vi.mocked(fetch).mock.calls.map(call => call[0])).not.toContain(vueUrl);
	});

	it('loads vue from a custom import-map url', async () => {
		const loader = createRemoteLoader({
			'vue': vueUrl,
			'@deot/helper': helperUrl
		}, { vue: Vue, vueRouter: {} });
		const loaded = await loader.load(helperUrl) as { mark: string };
		expect(loaded.mark).toBe('cdn-vue');
		expect(vi.mocked(fetch).mock.calls.map(call => call[0])).toContain(vueUrl);
	});

	it('executes minified derived classes with native fields and a comma after super', async () => {
		vi.mocked(fetch).mockResolvedValue({
			ok: true,
			text: async () => 'class Parent{};export class Child extends Parent{value=1;constructor(value){super(),this.value+=value}}'
		} as Response);
		const loader = createRemoteLoader({}, { vue: Vue, vueRouter: {} });
		const result = await loader.load('https://example.test/minified.js') as { Child: new (value: number) => { value: number } };
		expect(new result.Child(2).value).toBe(3);
	});

	it('loads transitive npm dependencies and defers dynamic imports until invoked', async () => {
		const entry = 'https://example.test/lazy.js';
		vi.mocked(fetch).mockImplementation(async () => ({
			ok: true,
			text: async () => `
				import { encode } from 'encoder';
				export const value = encode('hello');
				export const optional = id => import(id);
				export const text = "import('ignored')";
				// import('also-ignored')
			`
		} as Response));
		const native = vi.fn(async (url: string) => url.includes('encoder/')
			? { encode: (value: string) => value.toUpperCase() }
			: { default: 'optional' });
		const loader = createRemoteLoader({}, { vue: Vue, vueRouter: {} }, undefined, native);
		const result = await loader.load(entry) as { value: string; optional: (id: string) => Promise<unknown>; text: string };
		expect(result.value).toBe('HELLO');
		expect(result.text).toBe('import(\'ignored\')');
		expect(native).toHaveBeenCalledTimes(1);
		await expect(result.optional('@example/feature')).resolves.toMatchObject({ default: 'optional' });
		await result.optional('@example/feature');
		expect(native).toHaveBeenCalledTimes(2);
		expect(native).toHaveBeenLastCalledWith('https://cdn.jsdelivr.net/npm/@example/feature/+esm');
	});

	it('calls default exports from native npm dependencies and reuses them for dynamic imports', async () => {
		const entry = 'https://example.test/default.js';
		vi.mocked(fetch).mockResolvedValue({
			ok: true,
			text: async () => `import factory, { label } from 'factory-pkg';
				export const value = factory(label);
				export const lazy = async () => (await import('factory-pkg')).default('lazy');`
		} as Response);
		const factory = vi.fn((value: string) => `created:${value}`);
		const native = vi.fn(async () => Object.freeze({ default: factory, label: 'static' }));
		const loader = createRemoteLoader({}, { vue: Vue, vueRouter: {} }, undefined, native);
		const result = await loader.load(entry) as { value: string; lazy: () => Promise<string> };
		expect(result.value).toBe('created:static');
		await expect(result.lazy()).resolves.toBe('created:lazy');
		expect(native).toHaveBeenCalledOnce();
	});

	it('uses import-map overrides for lazy relative and npm imports', async () => {
		const entry = 'https://example.test/lazy.js';
		const mapped = 'https://custom.test/feature.js';
		const child = 'https://example.test/child.js';
		vi.mocked(fetch).mockImplementation(async url => ({
			ok: true,
			text: async () => url === entry
				? `export const mapped = () => import('feature');
					export const child = () => import('./child.js');
					export const vue = () => import('vue');`
				: 'export const value = 42;'
		} as Response));
		const loader = createRemoteLoader({ feature: mapped }, { vue: Vue, vueRouter: {} });
		const result = await loader.load(entry) as { mapped: () => Promise<unknown>; child: () => Promise<unknown>; vue: () => Promise<unknown> };
		expect(fetch).toHaveBeenCalledTimes(1);
		await expect(Promise.all([result.mapped(), result.mapped()])).resolves.toEqual([{ value: 42 }, { value: 42 }]);
		await expect(result.child()).resolves.toMatchObject({ value: 42 });
		await expect(result.vue()).resolves.toMatchObject({ ref: Vue.ref });
		expect(fetch).toHaveBeenCalledWith(mapped);
		expect(fetch).toHaveBeenCalledWith(child);
	});

	it('follows relative files and reports missing modules', async () => {
		const iconUrl = 'https://example.test/icon.js';
		const entryUrl = 'https://example.test/entry.js';
		const lodashUrl = 'https://example.test/lodash.js';
		vi.stubGlobal('fetch', vi.fn(async (url: string) => {
			const files: Record<string, string> = {
				[iconUrl]: 'export const name = \'icon\';\n',
				[entryUrl]: [
					'import { name } from \'./icon.js\';',
					'import { debounce } from \'lodash-es/debounce\';',
					'export const label = debounce(name);',
					''
				].join('\n'),
				[lodashUrl]: 'export const debounce = (value) => value;\n'
			};
			const text = files[url];
			if (!text) return { ok: false, status: 404, statusText: 'Not Found', text: async () => '' };
			return { ok: true, status: 200, statusText: 'OK', text: async () => text };
		}));
		const loader = createRemoteLoader({
			'lodash-es': lodashUrl
		}, { vue: Vue, vueRouter: {} });
		const loaded = await loader.load(entryUrl) as { label: string };
		expect(loaded.label).toBe('icon');

		const piniaUrl = 'https://example.test/pinia-entry.js';
		vi.stubGlobal('fetch', vi.fn(async (url: string) => {
			if (url !== piniaUrl) {
				return { ok: false, status: 404, statusText: 'Not Found', text: async () => '' };
			}
			return {
				ok: true,
				status: 200,
				statusText: 'OK',
				text: async () => 'import { createPinia } from \'pinia\';\nexport const kind = typeof createPinia;\n'
			};
		}));
		const hostPinia = createRemoteLoader({}, { vue: Vue, vueRouter: {} });
		const piniaLoaded = await hostPinia.load(piniaUrl) as { kind: string };
		expect(piniaLoaded.kind).toBe('function');

		const brokenUrl = 'https://example.test/broken.js';
		vi.stubGlobal('fetch', vi.fn(async (url: string) => {
			if (url !== brokenUrl) {
				return { ok: false, status: 404, statusText: 'Not Found', text: async () => '' };
			}
			return {
				ok: true,
				status: 200,
				statusText: 'OK',
				text: async () => `import missing from 'missing-pkg';\nexport const value = missing;\n`
			};
		}));
		const broken = createRemoteLoader({}, { vue: Vue, vueRouter: {} }, undefined, async () => { throw new Error('404 missing-pkg'); });
		await expect(broken.load(brokenUrl)).rejects.toThrow('404 missing-pkg');
		await expect(loader.load('https://example.test/missing.js')).rejects.toThrow('404');
	});
});
