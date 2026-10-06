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
		const broken = createRemoteLoader({}, { vue: Vue, vueRouter: {} });
		await expect(broken.load(brokenUrl)).rejects.toThrow('未注册的模块');
		await expect(loader.load('https://example.test/missing.js')).rejects.toThrow('404');
	});
});
