// @vitest-environment jsdom
import { mount } from '@vue/test-utils';
import * as Vue from 'vue';
import * as VueRouter from 'vue-router';
import { formatPlaygroundRuntimeError } from '../src/core/runtime/local/format-error';
import { createGuardedVue, type VueGuardCapture } from '../src/core/runtime/local/vue-guard';
import { createBuiltinImports } from '../src/cdn';
import { ensureLocalBuiltin, localBuiltinIds } from '../src/core/runtime/local/builtins';
import { loadLocalModules, prefersLocalBuiltin, resolveHostModule, resolveImportTarget, toHostModule } from '../src/core/runtime/local/modules';

describe('local playground modules', () => {
	it('keeps host vue and loads other import-map urls as values', async () => {
		const loader = vi.fn(async (url: string) => ({ url, marker: true }));
		const imports = {
			'vue': 'https://example.test/vue.js',
			'vue-router': 'https://example.test/router.js',
			'@deot/vc': 'https://example.test/vc.js',
			'lodash-es': 'https://example.test/lodash.js'
		};
		const result = await loadLocalModules(
			['vue', 'vue-router', '@deot/vc', 'lodash-es/debounce'],
			imports,
			{ vue: Vue, vueRouter: VueRouter },
			loader
		);

		expect(result.errors).toEqual([]);
		expect(result.modules.vue).toBe(Vue);
		expect(loader).not.toHaveBeenCalledWith('https://example.test/vue.js');
		expect(result.modules['vue-router']).toMatchObject({ url: 'https://example.test/router.js' });
		expect(result.modules['@deot/vc']).toMatchObject({ marker: true });
		expect(result.modules['lodash-es']).toMatchObject({ url: 'https://example.test/lodash.js' });
		expect(resolveHostModule('lodash-es/debounce', {
			'lodash-es': { debounce() { return 'debounced'; } }
		})).toMatchObject({ default: expect.any(Function) });
	});

	it('uses the bundled vue-router unless an import-map url overrides it', async () => {
		const loader = vi.fn(async (url: string) => ({ url }));
		const plain = await loadLocalModules(
			['vue-router'],
			{ vue: 'https://example.test/vue.js' },
			{ vue: Vue, vueRouter: VueRouter },
			loader
		);
		expect(loader).not.toHaveBeenCalled();
		expect(plain.modules.vue).toBe(Vue);
		expect(plain.modules['vue-router']).toBe(VueRouter);
		expect(resolveImportTarget('vue', { vue: 'https://example.test/vue.js' })).toBeNull();
		expect(resolveImportTarget('@deot/vc/button', { '@deot/vc': 'https://example.test/vc.js' }))
			.toBe('@deot/vc');
	});

	it('surfaces remote load failures and normalizes host module shapes', async () => {
		const failed = await loadLocalModules(
			['dayjs'],
			{ dayjs: 'https://example.test/dayjs.js' },
			{ vue: Vue, vueRouter: VueRouter },
			async () => { throw new Error('offline'); }
		);
		expect(failed.errors[0]).toContain('无法加载模块 "dayjs"');
		expect(toHostModule(null)).toMatchObject({ default: null });
		expect(toHostModule(3)).toMatchObject({ default: 3 });
		expect(toHostModule({ title: 'Hi' }).title).toBe('Hi');
		expect(resolveHostModule('missing', {})).toBeNull();
		expect(resolveHostModule('pkg/missing', { pkg: { name: 'pkg' } })).toBeNull();
		expect(resolveHostModule('pkg/child', { pkg: 1 })).toBeNull();
		expect(resolveHostModule('pkg/a/b', { pkg: { a: 1 } })).toBeNull();
		expect(resolveImportTarget('vue/server-renderer', {})).toBeNull();
		expect(resolveImportTarget('vue/server-renderer/extra', {})).toBeNull();
		expect(resolveImportTarget('foo/bar/baz', {})).toBeNull();
		const defaults = createBuiltinImports();
		expect(prefersLocalBuiltin('pinia', {})).toBe(true);
		expect(prefersLocalBuiltin('@deot/vc', { '@deot/vc': defaults['@deot/vc'] })).toBe(true);
		expect(prefersLocalBuiltin('@deot/vc', { '@deot/vc': 'https://example.test/vc.js' })).toBe(false);
		expect(prefersLocalBuiltin('not-builtin', {})).toBe(false);
		const kept = await loadLocalModules(
			['@deot/vc', 'pinia', 'dayjs'],
			{ '@deot/vc': defaults['@deot/vc'] },
			{ vue: Vue, vueRouter: VueRouter },
			async () => ({ remote: true })
		);
		expect(kept.modules['@deot/vc']).not.toMatchObject({ remote: true });
		expect(kept.modules.pinia).toBeTruthy();
		expect(kept.modules.dayjs).toBeTypeOf('function');
		const nested = await loadLocalModules(
			['lodash-es/debounce'],
			{},
			{ vue: Vue, vueRouter: VueRouter },
			async () => {
				throw new Error('should stay local');
			}
		);
		expect(nested.errors).toEqual([]);
		expect(nested.modules['lodash-es']).toBeTruthy();
		for (const id of localBuiltinIds) {
			const loaded = await ensureLocalBuiltin(id);
			expect(loaded).toBeTruthy();
			await expect(ensureLocalBuiltin(id)).resolves.toBe(loaded);
		}

		const capture: VueGuardCapture = {
			mountedComponent: null,
			components: {},
			provides: {}
		};
		const guarded = createGuardedVue(capture);
		const app = guarded.createApp({ name: 'Root' });
		const plugin = { install() {} };
		expect(app.use(plugin)).toBe(app);
		expect(app.mixin({}).mixin).toBeTypeOf('function');
		expect(app.component('Box', { name: 'Box' }).directive('demo', {})).toBe(app);
		expect(app.provide('token', 1).mount('#app')).toBe(capture.mountedComponent);
		expect(capture.components).toMatchObject({ Box: { name: 'Box' } });
		expect(capture.provides.token).toBe(1);
		expect(app.component('Box')).toMatchObject({ name: 'Box' });
		app.unmount();
		expect(app.onUnmount(() => {})).toBe(app);
		const view = mount(capture.mountedComponent as never);
		expect(view.exists()).toBe(true);
		view.unmount();
		expect(guarded.createSSRApp).toBeTypeOf('function');
		expect((guarded as unknown as { default: unknown }).default).toBe(guarded);
		expect(formatPlaygroundRuntimeError(undefined)).toBe('');
		expect(formatPlaygroundRuntimeError({ message: '' })).toBe('');
		expect(formatPlaygroundRuntimeError({ message: 'undefined' })).toBe('');
		expect(formatPlaygroundRuntimeError(new Error('boom'))).toBe('boom');
		expect(formatPlaygroundRuntimeError('plain')).toBe('plain');
	});
});
