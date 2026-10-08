// @vitest-environment jsdom

import { createRuntimeStore } from '../src/core/store';
import { resolveReplImports } from '../src/core/repl-modules';

describe('iframe runtime modules', () => {
	afterEach(() => vi.unstubAllGlobals());

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
		vi.stubGlobal('fetch', vi.fn(async () => ({
			ok: true,
			text: async () => `export const label = 'widget'; export const optional = () => import('optional-pkg');`
		})));
		const store = createRuntimeStore({
			'App.vue': `<script setup>import { label } from 'widget';</script><template>{{ label }}</template>`
		}, 'App.vue', { builtinImportMap: { imports: { widget: 'https://example.test/widget.js' } } });
		expect(store.loading).toBe(true);
		expect(store.files['src/App.vue'].compiled.js).toBe('');
		await vi.waitFor(() => {
			expect(store.loading).toBe(false);
			expect(store.files['src/App.vue'].compiled.js).toContain('widget');
			expect(store.getImportMap().imports).toMatchObject({
				'widget': 'https://example.test/widget.js',
				'optional-pkg': 'https://cdn.jsdelivr.net/npm/optional-pkg/+esm'
			});
		});
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
		expect(store.files['src/App.vue'].compiled.js).toBe('');
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
