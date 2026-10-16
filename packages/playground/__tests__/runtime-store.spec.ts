// @vitest-environment jsdom

import { createRuntimeStore } from '../src/core/store';
import { resolveReplImports } from '../src/core/repl-modules';
import { watch } from 'vue';

describe('iframe runtime modules', () => {
	afterEach(() => vi.unstubAllGlobals());

	it.each([
		['missing process', undefined],
		['missing env', {}],
		['existing env', { env: { DOCS_TEST: 'preserved' } }]
	] as const)('initializes iframe compilation with %s without replacing host values', async (_name, existing) => {
		const host = globalThis as { process?: { env?: Record<string, string | undefined> } };
		const env = existing && 'env' in existing ? existing.env : undefined;
		let initialized: typeof host.process;
		let store: ReturnType<typeof createRuntimeStore>;
		vi.stubGlobal('process', existing);
		try {
			store = createRuntimeStore({ 'App.vue': '<template>ready</template>' }, 'App.vue', {});
			initialized = host.process;
		} finally {
			// Vitest 与 Node 仍需使用真实 process；编译结果在恢复后检查。
			vi.unstubAllGlobals();
		}
		expect(initialized?.env).toEqual(env || {});
		if (existing) expect(initialized).toBe(existing);
		if (env) expect(initialized?.env).toBe(env);
		await vi.waitFor(() => expect(store.files['src/App.vue'].compiled.js).toContain('ready'));
		expect(store.errors).toEqual([]);
	});

	it('discovers transitive modules and registers dynamic npm imports without downloading them', async () => {
		const fetcher = vi.fn(async (url: string) => ({
			ok: true,
			text: async () => url.endsWith('widget.js')
				? `export { label } from './child.js'; export const lazy = () => import('optional-pkg');`
				: 'export const label = "widget";'
		}));
		vi.stubGlobal('fetch', fetcher);
		await expect(resolveReplImports({ widget: 'https://example.test/widget.js' }, ['widget'])).resolves.toEqual({
			'widget': 'https://example.test/widget.js',
			'optional-pkg': 'https://cdn.jsdelivr.net/npm/optional-pkg/+esm'
		});
		expect(fetcher.mock.calls.map(([url]) => url)).toEqual(['https://example.test/widget.js', 'https://example.test/child.js']);
	});

	it('initializes the preview after remote dependency discovery and retains the module override', async () => {
		let complete!: (response: Response) => void;
		vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((resolve) => { complete = resolve; })));
		const store = createRuntimeStore({
			'App.vue': `<script setup>import { label } from 'widget';</script><template>{{ label }}</template>`
		}, 'App.vue', { builtinImportMap: { imports: { widget: 'https://example.test/widget.js' } } });
		expect(store.loading).toBe(true);
		expect(store.errors).toEqual([]);
		expect(store.files['src/App.vue'].compiled.js).toBe('');
		expect(store.getImportMap().imports?.widget).toBe('https://example.test/widget.js');
		complete({
			ok: true,
			text: async () => `export const label = 'widget'; export const optional = () => import('optional-pkg');`
		} as Response);
		await vi.waitFor(() => {
			expect(store.loading).toBe(false);
			expect(store.files['src/App.vue'].compiled.js).toContain('widget');
			expect(store.getImportMap().imports).toMatchObject({
				'widget': 'https://example.test/widget.js',
				'optional-pkg': 'https://cdn.jsdelivr.net/npm/optional-pkg/+esm'
			});
		});
		expect(store.errors).toEqual([]);
	});

	it('reports failed remote dependencies without starting an empty preview', async () => {
		vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404 })));
		const store = createRuntimeStore({
			'App.vue': `<script setup>import { label } from 'widget';</script><template>{{ label }}</template>`
		}, 'App.vue', { builtinImportMap: { imports: { widget: 'https://example.test/missing.js' } } });
		await vi.waitFor(() => {
			expect(store.loading).toBe(false);
			expect(store.errors.map(String).join('\n')).toContain('404 https://example.test/missing.js');
		});
		expect(store.errors.map(String).join('\n')).not.toContain('reading \'code\'');
		expect(store.files['src/App.vue'].compiled.js).toBe('');
	});

	it('retains the current import map when replacing source files without transient syntax errors', async () => {
		const store = createRuntimeStore({ 'App.vue': '<template>initial</template>' }, 'App.vue', {});
		await vi.waitFor(() => expect(store.files['src/App.vue'].compiled.js).toContain('initial'));
		store.setImportMap({ imports: { feature: 'https://example.test/feature.js' } }, true);
		const errors: string[] = [];
		const stop = watch(() => store.errors.map(String), value => errors.push(...value), { flush: 'sync' });
		try {
			await store.setFiles({ 'App.vue': '<template>updated</template>' }, 'App.vue');
			expect(store.getImportMap().imports?.feature).toBe('https://example.test/feature.js');
			expect(errors).toEqual([]);
			await store.setFiles({
				'App.vue': '<template>next</template>',
				'import-map.json': JSON.stringify({ imports: { feature: 'https://example.test/next.js' } })
			}, 'App.vue');
			expect(store.getImportMap().imports?.feature).toBe('https://example.test/next.js');
			expect(errors).toEqual([]);
		} finally {
			stop();
		}
	});

	it('uses an existing import-map file and still reports genuinely invalid JSON', async () => {
		const store = createRuntimeStore({
			'App.vue': '<template>ready</template>',
			'import-map.json': JSON.stringify({ imports: { feature: 'https://example.test/feature.js' } })
		}, 'App.vue', {});
		await vi.waitFor(() => expect(store.files['src/App.vue'].compiled.js).toContain('ready'));
		expect(store.getImportMap().imports?.feature).toBe('https://example.test/feature.js');
		expect(store.files['src/import-map.json']).toBeUndefined();
		store.files['import-map.json'].code = '{';
		store.getImportMap();
		expect(store.errors.map(String).join('\n')).toContain('Syntax error in import-map.json:');
		expect(store.errors.map(String).join('\n')).not.toContain('reading \'code\'');
	});

	it('resolves nested Vue, TS and dynamic imports from their importer without changing source', async () => {
		const files = {
			'remote/examples/App.vue': `<script setup lang="ts">
				import { label } from './nested/model';
				import Child from './nested/Child.vue';
				</script><template><Child />{{ label }}</template>`,
			'remote/examples/nested/model.ts': `import type { Props } from './types';
				import { label as importedLabel } from '../values';
				export { importedLabel as exportedLabel };
				export const getLabel = () => importedLabel;
				export { Props }; export { label } from '../values';
				export const lazy = () => import('../values');
				export const mode = process.env.NODE_ENV;
				export const text = 'process.env.NODE_ENV';`,
			'remote/examples/nested/Child.vue': '<template><p>child</p></template>',
			'remote/examples/values.ts': `export const label: string = 'nested';`
		};
		const store = createRuntimeStore(files, 'remote/examples/App.vue', {});
		await vi.waitFor(() => {
			expect(store.files['src/remote/examples/App.vue'].compiled.js).toContain('./remote/examples/nested/model.ts');
			expect(store.files['src/remote/examples/App.vue'].compiled.js).toContain('./remote/examples/nested/Child.vue');
			expect(store.files['src/remote/examples/nested/model.ts'].compiled.js).toContain('./remote/examples/values.ts');
			expect(store.files['src/remote/examples/nested/model.ts'].compiled.js).not.toContain('export { Props }');
			expect(store.files['src/remote/examples/nested/model.ts'].compiled.js).toContain('export { label as exportedLabel } from');
			expect(store.files['src/remote/examples/nested/model.ts'].compiled.js).toContain('getLabel = () => __docs_reexport_0__');
			expect(store.files['src/remote/examples/nested/model.ts'].compiled.js).toContain('"development"');
			expect(store.files['src/remote/examples/nested/model.ts'].compiled.js).toContain('\'process.env.NODE_ENV\'');
		});
		expect(store.files['src/remote/examples/nested/model.ts'].code).toBe(files['remote/examples/nested/model.ts']);
		expect(store.errors).toEqual([]);
		await store.setFiles({ ...files, 'remote/examples/values.ts': 'export const label = \'edited\';' }, 'remote/examples/App.vue');
		await vi.waitFor(() => expect(store.files['src/remote/examples/nested/model.ts'].compiled.js).toContain('./remote/examples/values.ts'));
	});
});
