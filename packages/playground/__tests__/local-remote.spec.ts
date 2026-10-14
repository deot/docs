import * as Vue from 'vue';
import { createBuiltinImports } from '../src/cdn';
import { clearRemoteModuleCache, createRemoteLoader } from '../src/core/runtime/local/remote';
import { ensureLocalBuiltin } from '../src/core/runtime/local/builtins';
import * as Sucrase from 'sucrase';

describe('local remote modules', () => {
	const vueUrl = 'https://example.test/vue.js';
	const helperUrl = 'https://example.test/helper.js';
	const buttonUrl = 'https://example.test/button.js';

	beforeEach(() => {
		clearRemoteModuleCache();
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
		vi.restoreAllMocks();
	});

	it('shares downloads and transforms across concurrent previews while isolating module state', async () => {
		const entry = 'https://assets.test/shared/entry.js';
		const child = 'https://assets.test/shared/child.js';
		let complete!: () => void;
		const pending = new Promise<void>((resolve) => { complete = resolve; });
		vi.mocked(fetch).mockImplementation(async (url) => {
			await pending;
			return {
				ok: true,
				text: async () => url === entry
					? `import { label } from './child.js'; let count = 0; export const next = () => label + ++count; export const context = this;`
					: `export const label = 'preview:';`
			} as Response;
		});
		const transform = vi.spyOn(Sucrase, 'transform');
		const tasks = Array.from({ length: 8 }, () => createRemoteLoader({ widget: entry }, { vue: Vue, vueRouter: {} }).load(entry));
		complete();
		const results = await Promise.all(tasks) as Array<{ next: () => string; context: unknown }>;
		expect(vi.mocked(fetch).mock.calls.map(call => call[0])).toEqual([entry, child]);
		expect(transform).toHaveBeenCalledTimes(2);
		expect(results.map(result => result.next())).toEqual(Array(8).fill('preview:1'));
		expect(results.every(result => result.context === undefined)).toBe(true);
		expect(results[0].next()).toBe('preview:2');
		expect(results[1].next()).toBe('preview:2');
	});

	it('resolves cached source dependencies against each preview import map', async () => {
		const entry = 'https://assets.test/maps/entry.js';
		const first = 'https://assets.test/maps/first.js';
		const second = 'https://assets.test/maps/second.js';
		vi.mocked(fetch).mockImplementation(async url => ({
			ok: true,
			text: async () => url === entry
				? `import { label } from 'feature'; export const value = label;`
				: `export const label = '${url === first ? 'first' : 'second'}';`
		} as Response));
		await expect(createRemoteLoader({ feature: first }, { vue: Vue, vueRouter: {} }).load(entry)).resolves.toMatchObject({ value: 'first' });
		await expect(createRemoteLoader({ feature: second }, { vue: Vue, vueRouter: {} }).load(entry)).resolves.toMatchObject({ value: 'second' });
		expect(vi.mocked(fetch).mock.calls.map(call => call[0])).toEqual([entry, first, second]);
	});

	it('retries failed downloads and transformations in later previews', async () => {
		const entry = 'https://assets.test/retry/entry.js';
		vi.mocked(fetch)
			.mockResolvedValueOnce({ ok: false, status: 503 } as Response)
			.mockResolvedValueOnce({ ok: true, text: async () => 'export const = ;' } as Response)
			.mockResolvedValueOnce({ ok: true, text: async () => 'export const value = 42;' } as Response);
		const load = () => createRemoteLoader({ widget: entry }, { vue: Vue, vueRouter: {} }).load(entry);
		await expect(load()).rejects.toThrow('503');
		await expect(load()).rejects.toThrow();
		await expect(load()).resolves.toMatchObject({ value: 42 });
		expect(fetch).toHaveBeenCalledTimes(3);
	});

	it('keeps different module versions separate and rereads same-origin development modules', async () => {
		vi.stubGlobal('location', new URL('https://docs.test/guide'));
		let value = 1;
		vi.mocked(fetch).mockImplementation(async () => ({ ok: true, text: async () => `export const value = ${value};` } as Response));
		const load = (url: string) => createRemoteLoader({ widget: url }, { vue: Vue, vueRouter: {} }).load(url);
		await expect(load('https://assets.test/version/1.js')).resolves.toMatchObject({ value: 1 });
		await expect(load('/__docs/module/widget')).resolves.toMatchObject({ value: 1 });
		value = 2;
		await expect(load('https://assets.test/version/2.js')).resolves.toMatchObject({ value: 2 });
		await expect(load('https://assets.test/version/1.js')).resolves.toMatchObject({ value: 1 });
		await expect(load('/__docs/module/widget')).resolves.toMatchObject({ value: 2 });
		expect(fetch).toHaveBeenCalledTimes(4);
	});

	it('evicts old sources while retaining recently reused modules', async () => {
		vi.mocked(fetch).mockResolvedValue({ ok: true, text: async () => 'export const value = 42;' } as Response);
		const load = (index: number) => {
			const url = `https://assets.test/bounded/${index}.js`;
			return createRemoteLoader({ widget: url }, { vue: Vue, vueRouter: {} }).load(url);
		};
		for (let index = 0; index < 128; index++) await load(index);
		await load(0);
		await load(128);
		await load(0);
		expect(fetch).toHaveBeenCalledTimes(129);
		await expect(load(1)).resolves.toMatchObject({ value: 42 });
		expect(fetch).toHaveBeenCalledTimes(130);
	});

	it('preserves cyclic module graphs across previews', async () => {
		const left = 'https://assets.test/cycle/left.js';
		vi.mocked(fetch).mockImplementation(async url => ({
			ok: true,
			text: async () => url === left
				? `import { readLeft } from './right.js'; export const value = 42; export const read = () => readLeft();`
				: `import { value } from './left.js'; export const readLeft = () => value;`
		} as Response));
		for (let index = 0; index < 2; index++) {
			const result = await createRemoteLoader({ widget: left }, { vue: Vue, vueRouter: {} }).load(left) as { read: () => number };
			expect(result.read()).toBe(42);
		}
		expect(fetch).toHaveBeenCalledTimes(2);
	});

	it('waits for shared dependencies when loading multiple entry graphs concurrently', async () => {
		vi.stubGlobal('location', new URL('https://assets.test/guide'));
		const left = 'https://assets.test/concurrent/left.js';
		const right = 'https://assets.test/concurrent/right.js';
		const child = 'https://assets.test/concurrent/child.js';
		let complete!: () => void;
		const pending = new Promise<void>((resolve) => { complete = resolve; });
		vi.mocked(fetch).mockImplementation(async url => ({
			ok: true,
			text: async () => {
				if (url !== child) return `import { value } from './child.js'; export const result = value;`;
				await pending;
				return 'export const value = 42;';
			}
		} as Response));
		const loader = createRemoteLoader({ widget: left }, { vue: Vue, vueRouter: {} });
		const tasks = Promise.all([loader.load(left), loader.load(right)]);
		complete();
		await expect(tasks).resolves.toEqual([{ result: 42 }, { result: 42 }]);
		expect(vi.mocked(fetch).mock.calls.map(call => call[0]).filter(url => url === child)).toHaveLength(1);
	});

	it('keeps the host vue when only other modules are overridden', async () => {
		const loader = createRemoteLoader({
			'vue': createBuiltinImports().vue,
			'@deot/helper': helperUrl,
			'@deot/vc': buttonUrl,
			'lodash-es': 'https://example.test/lodash.js'
		}, { vue: Vue, vueRouter: {} }, new Set(['@deot/helper', '@deot/vc', 'lodash-es']));
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

	it('loads transitive builtin components with the custom Vue runtime', async () => {
		const imports = { ...createBuiltinImports(), vue: vueUrl };
		vi.mocked(fetch).mockImplementation(async url => ({
			ok: true,
			text: async () => url === vueUrl
				? `export const ref = () => 'cdn-vue';`
				: url === imports['@deot/vc']
					? `export { Scroller } from '@deot/vc-components';`
					: `import { ref } from 'vue'; export const Scroller = ref();`
		} as Response));
		const loader = createRemoteLoader(imports, { vue: Vue, vueRouter: {} });
		await expect(loader.load(imports['@deot/vc'])).resolves.toMatchObject({ Scroller: 'cdn-vue' });
		expect(fetch).toHaveBeenCalledWith(imports['@deot/vc-components']);
	});

	it('binds Vue imports in CDN ESM bundles to the custom runtime', async () => {
		const entry = 'https://cdn.jsdelivr.net/npm/example/+esm';
		vi.mocked(fetch).mockImplementation(async url => ({
			ok: true,
			text: async () => url === vueUrl
				? `export const ref = () => 'cdn-vue';`
				: `import { ref } from '/npm/vue@3.5.39/+esm'; export const value = ref();`
		} as Response));
		const native = vi.fn();
		const loader = createRemoteLoader({ vue: vueUrl }, { vue: Vue, vueRouter: {} }, undefined, native);
		await expect(loader.load(entry)).resolves.toMatchObject({ value: 'cdn-vue' });
		expect(native).not.toHaveBeenCalled();
		expect(vi.mocked(fetch).mock.calls.map(call => call[0])).toEqual([entry, vueUrl]);
	});

	it('applies individual overrides to pinned CDN dependencies while inheriting host Vue', async () => {
		const entry = 'https://cdn.jsdelivr.net/npm/example/+esm';
		const imports = createBuiltinImports();
		vi.mocked(fetch).mockImplementation(async url => ({
			ok: true,
			text: async () => url === entry
				? `import { ref } from '/npm/vue@3.5.39/+esm';
					import { mark } from '/npm/@deot/helper@1.0.0/+esm';
					import { debounce } from 'lodash-es';
					export const value = ref(mark); export const inherited = debounce;
					export const lazy = () => import('/npm/@deot/helper@1.0.0/+esm');`
				: `export const mark = 'preview-helper';`
		} as Response));
		const native = vi.fn();
		const loader = createRemoteLoader(imports, { vue: Vue, vueRouter: {} }, new Set(['@deot/helper']), native);
		const result = await loader.load(entry) as { value: unknown; inherited: unknown; lazy: () => Promise<unknown> };
		expect(Vue.isRef(result.value)).toBe(true);
		expect(result.value).toMatchObject({ value: 'preview-helper' });
		expect(result.inherited).toBe((await ensureLocalBuiltin('lodash-es') as { debounce: unknown }).debounce);
		await expect(result.lazy()).resolves.toMatchObject({ mark: 'preview-helper' });
		expect(native).not.toHaveBeenCalled();
		expect(vi.mocked(fetch).mock.calls.map(call => call[0])).toEqual([entry, imports['@deot/helper']]);
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

	it('resolves relative dependencies of root-relative module overrides', async () => {
		vi.stubGlobal('location', new URL('https://docs.test/guide'));
		vi.mocked(fetch).mockImplementation(async url => ({
			ok: true,
			text: async () => String(url).endsWith('/widget.js')
				? `export { label } from './child.js'; export const lazy = () => import('feature');`
				: `export const label = 'local-module';`
		} as Response));
		const loader = createRemoteLoader({ widget: '/modules/widget.js', feature: '/feature.js' }, { vue: Vue, vueRouter: {} });
		const result = await loader.load('/modules/widget.js') as { label: string; lazy: () => Promise<unknown> };
		expect(result.label).toBe('local-module');
		await expect(result.lazy()).resolves.toMatchObject({ label: 'local-module' });
		expect(vi.mocked(fetch).mock.calls.map(call => call[0])).toEqual([
			'https://docs.test/modules/widget.js', 'https://docs.test/modules/child.js', 'https://docs.test/feature.js'
		]);
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
