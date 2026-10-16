// @vitest-environment jsdom
import * as Vue from 'vue';
import { mount, flushPromises } from '@vue/test-utils';
import { createBuiltinImports } from '../src/cdn';
import { compilePlayground } from '../src/core/runtime/local/compile';
import { collectBareSpecifiers } from '../src/core/runtime/local/compile/files';
import { linkPlayground } from '../src/core/runtime/local/linker';
import { loadLocalModules } from '../src/core/runtime/local/modules';
import { clearRemoteModuleCache, createRemoteLoader } from '../src/core/runtime/local/remote';

describe('runtime ESM imports', () => {
	beforeEach(() => clearRemoteModuleCache());
	afterEach(() => vi.unstubAllGlobals());

	it('routes literal, computed and virtual-file imports through one lazy loader', async () => {
		const files = {
			'entry.js': `export default {
				literal: () => import('new-package'),
				computed: id => import(id),
				child: () => import('./child.js'),
				vue: () => import('vue'),
				text: "import('ignored')",
				import() { return 'method'; }
			};`,
			'child.js': `export const load = () => import('@example/utility@2.0.0/helpers');`
		};
		vi.stubGlobal('fetch', vi.fn(async (url: string) => ({ ok: true, text: async () => `export const url = ${JSON.stringify(url)};` })));
		const remote = createRemoteLoader({}, { vue: Vue, vueRouter: {} });
		const compiled = await compilePlayground(files, 'entry.js');
		expect(compiled.errors).toEqual([]);
		expect(collectBareSpecifiers(files, Object.keys(files), false)).toEqual([]);
		const linked = linkPlayground(compiled, files, { modules: { vue: Vue }, loadModule: remote.loadModule });
		expect(linked.errors).toEqual([]);
		const component = linked.component as {
			literal: () => Promise<unknown>;
			computed: (id: string) => Promise<unknown>;
			child: () => Promise<{ load: () => Promise<unknown> }>;
			vue: () => Promise<unknown>;
			text: string;
			import: () => string;
		};
		expect(fetch).not.toHaveBeenCalled();
		expect(component.text).toBe('import(\'ignored\')');
		expect(component.import()).toBe('method');
		await expect(component.vue()).resolves.toMatchObject({ ref: Vue.ref });
		await expect(component.literal()).resolves.toMatchObject({ url: 'https://cdn.jsdelivr.net/npm/new-package/+esm' });
		await expect(component.computed('other-package')).resolves.toMatchObject({ url: 'https://cdn.jsdelivr.net/npm/other-package/+esm' });
		const child = await component.child();
		await expect(child.load()).resolves.toMatchObject({ url: 'https://cdn.jsdelivr.net/npm/@example/utility@2.0.0/helpers/+esm' });
		expect(fetch).toHaveBeenCalledTimes(3);
	});

	it('loads an ESM component package and prepares its own optional dependency on mount', async () => {
		const imports = createBuiltinImports();
		const sources = {
			[imports['@deot/vc']]: `export { Button, Snapshot } from '@deot/vc-components';`,
			[imports['@deot/vc-components']]: `import { h, onMounted, ref } from 'vue';
				export const Button = { render: () => h('button', 'ordinary') };
				export const Snapshot = { setup() {
					const value = ref('pending');
					onMounted(async () => { value.value = (await import('unregistered-peer')).default(); });
					return () => h('p', value.value);
				} };`,
			'https://cdn.jsdelivr.net/npm/unregistered-peer/+esm': `export default () => 'ready';`
		};
		vi.stubGlobal('fetch', vi.fn(async (url: string) => ({ ok: true, text: async () => sources[url] })));
		const remote = createRemoteLoader(imports, { vue: Vue, vueRouter: {} }, new Set());
		const loaded = await loadLocalModules(['@deot/vc'], imports, { vue: Vue, vueRouter: {} }, remote.load, new Set());
		expect(loaded.errors).toEqual([]);
		const { Button, Snapshot } = loaded.modules['@deot/vc'] as Record<string, Vue.Component>;
		const button = mount(Button);
		expect(button.text()).toBe('ordinary');
		expect(fetch).toHaveBeenCalledTimes(2);
		const snapshot = mount(Snapshot);
		await flushPromises();
		expect(snapshot.text()).toBe('ready');
		expect(fetch).toHaveBeenCalledTimes(3);
		button.unmount();
		snapshot.unmount();
	});

	it('preserves dependency versions emitted by the CDN unless explicitly overridden', async () => {
		const entry = 'https://cdn.jsdelivr.net/npm/component/+esm';
		const pinned = 'https://cdn.jsdelivr.net/npm/utility@1.2.3/+esm';
		const imports = { utility: 'https://cdn.jsdelivr.net/npm/utility/+esm' };
		vi.stubGlobal('fetch', vi.fn(async (url: string) => ({
			ok: true,
			text: async () => url === entry ? `export { value } from '/npm/utility@1.2.3/+esm';` : 'export const value = 42;'
		})));
		await expect(createRemoteLoader(imports, { vue: Vue, vueRouter: {} }, new Set()).load(entry)).resolves.toMatchObject({ value: 42 });
		expect(vi.mocked(fetch).mock.calls.map(call => call[0])).toEqual([entry, pinned]);
	});

	it('retries failed lazy downloads and reports execution errors with their URL', async () => {
		const entry = 'https://runtime.test/entry.js';
		const peer = 'https://cdn.jsdelivr.net/npm/lazy-peer/+esm';
		let attempts = 0;
		vi.stubGlobal('fetch', vi.fn(async (url: string) => {
			if (url === peer && ++attempts === 1) return { ok: false, status: 503 };
			return { ok: true, text: async () => url === entry ? `export const lazy = () => import('lazy-peer');` : 'export default 42;' };
		}));
		const remote = createRemoteLoader({}, { vue: Vue, vueRouter: {} });
		const module = await remote.load(entry) as { lazy: () => Promise<unknown> };
		await expect(module.lazy()).rejects.toThrow(peer);
		await expect(module.lazy()).resolves.toMatchObject({ default: 42 });
		expect(attempts).toBe(2);
		const broken = 'https://runtime.test/broken.js';
		vi.mocked(fetch).mockResolvedValue({ ok: true, text: async () => `throw new Error('ordinary execution error');` } as Response);
		await expect(remote.load(broken)).rejects.toThrow('ordinary execution error');
		await expect(remote.load(broken)).rejects.toThrow(broken);
	});

	it.each(['true', 'undefined'])('accepts CDN ESM exports containing a %s CommonJS interop marker', async (marker) => {
		const entry = 'https://cdn.jsdelivr.net/npm/consumer/+esm';
		vi.stubGlobal('fetch', vi.fn(async (url: string) => ({
			ok: true,
			text: async () => url === entry
				? `import factory from './dependency.js'; export const value = factory();`
				: `const marker = ${marker}; export { marker as __esModule }; export default () => 42;`
		})));
		await expect(createRemoteLoader({}, { vue: Vue, vueRouter: {} }).load(entry)).resolves.toMatchObject({ value: 42 });
	});
});
