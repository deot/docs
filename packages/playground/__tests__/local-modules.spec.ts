// @vitest-environment jsdom
import { mount } from '@vue/test-utils';
import * as Vue from 'vue';
import * as VueRouter from 'vue-router';
import { formatPlaygroundRuntimeError } from '../src/core/runtime/local/format-error';
import { createGuardedVue, type VueGuardCapture } from '../src/core/runtime/local/vue-guard';
import { createBuiltinImports } from '../src/cdn';
import { loadLocalModules, usesHostRuntime, resolveHostModule, resolveImportTarget, toHostModule } from '../src/core/runtime/local/modules';

describe('local playground modules', () => {
	it('loads custom Vue and other import-map urls as values', async () => {
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
		expect(result.modules.vue).toMatchObject({ url: 'https://example.test/vue.js' });
		expect(loader).toHaveBeenCalledWith('https://example.test/vue.js');
		expect(result.modules['vue-router']).toMatchObject({ url: 'https://example.test/router.js' });
		expect(result.modules['@deot/vc']).toMatchObject({ marker: true });
		expect(result.modules['lodash-es']).toMatchObject({ url: 'https://example.test/lodash.js' });
		expect(resolveHostModule('lodash-es/debounce', {
			'lodash-es': { debounce() { return 'debounced'; } }
		})).toMatchObject({ default: expect.any(Function) });
	});

	it('resolves arbitrary npm imports, scoped packages and subpaths without a registry', async () => {
		const loader = vi.fn(async (url: string) => ({ url }));
		const result = await loadLocalModules(
			['nanoid', '@example/utility/helpers'], {}, { vue: Vue, vueRouter: VueRouter }, loader
		);
		expect(result.errors).toEqual([]);
		expect(result.modules.nanoid).toEqual({ url: 'https://cdn.jsdelivr.net/npm/nanoid/+esm' });
		expect(result.modules['@example/utility/helpers']).toEqual({ url: 'https://cdn.jsdelivr.net/npm/@example/utility/helpers/+esm' });
	});

	it('uses the bundled vue-router unless an import-map url overrides it', async () => {
		const loader = vi.fn(async (url: string) => ({ url }));
		const plain = await loadLocalModules(
			['vue-router'],
			{},
			{ vue: Vue, vueRouter: VueRouter },
			loader
		);
		expect(loader).not.toHaveBeenCalled();
		expect(plain.modules.vue).toBe(Vue);
		expect(plain.modules['vue-router']).toBe(VueRouter);
		expect(resolveImportTarget('vue', { vue: 'https://example.test/vue.js' })).toBe('vue');
		expect(resolveImportTarget('@deot/vc/button', { '@deot/vc': 'https://example.test/vc.js' }))
			.toBe('@deot/vc');
	});

	it('loads business packages through ESM alongside custom Vue', async () => {
		const imports = { ...createBuiltinImports(), vue: 'https://example.test/vue.js' };
		const loader = vi.fn(async (url: string) => ({ url }));
		const result = await loadLocalModules(
			['vue', '@deot/vc', '@deot/vc-components', 'vue-router', '@deot/helper', 'lodash-es', 'dayjs'],
			imports,
			{ vue: Vue, vueRouter: VueRouter },
			loader,
			new Set(['vue'])
		);
		expect(result.errors).toEqual([]);
		expect(result.modules.vue).toEqual({ url: imports.vue });
		expect(result.modules['@deot/vc']).toEqual({ url: imports['@deot/vc'] });
		expect(result.modules['@deot/vc-components']).toEqual({ url: imports['@deot/vc-components'] });
		expect(result.modules['vue-router']).toEqual({ url: 'https://cdn.jsdelivr.net/npm/vue-router/+esm' });
		for (const id of ['@deot/helper', 'lodash-es', 'dayjs']) {
			expect(result.modules[id]).toMatchObject({ url: expect.any(String) });
		}
		expect(loader).toHaveBeenCalledTimes(7);
	});

	it('honors explicit overrides even when their urls equal builtin defaults', async () => {
		const imports = createBuiltinImports();
		const loader = vi.fn(async (url: string) => ({ url }));
		const result = await loadLocalModules(
			['vue', '@deot/helper', 'lodash-es/debounce'], imports,
			{ vue: Vue, vueRouter: VueRouter }, loader, new Set(['@deot/helper'])
		);
		expect(result.errors).toEqual([]);
		expect(result.modules.vue).toBe(Vue);
		expect(result.modules['lodash-es']).toEqual({ url: imports['lodash-es'] });
		expect(result.modules['@deot/helper']).toEqual({ url: imports['@deot/helper'] });
		expect(loader).toHaveBeenCalledTimes(2);
		expect(loader).toHaveBeenCalledWith(imports['@deot/helper']);
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
		expect(usesHostRuntime('pinia', {})).toBe(false);
		expect(usesHostRuntime('@deot/vc', defaults, new Set())).toBe(false);
		expect(usesHostRuntime('@deot/vc', { '@deot/vc': defaults['@deot/vc'] })).toBe(false);
		expect(usesHostRuntime('@deot/vc', { '@deot/vc': 'https://example.test/vc.js' })).toBe(false);
		expect(usesHostRuntime('not-builtin', {})).toBe(false);
		expect(usesHostRuntime('vue', defaults, new Set())).toBe(true);
		expect(usesHostRuntime('vue', { vue: defaults.vue })).toBe(false);
		expect(usesHostRuntime('vue', { vue: 'https://example.test/vue.js' })).toBe(false);
		expect(usesHostRuntime('vue/server-renderer', defaults, new Set())).toBe(true);
		const kept = await loadLocalModules(
			['@deot/vc', 'pinia', 'dayjs'],
			{ '@deot/vc': defaults['@deot/vc'] },
			{ vue: Vue, vueRouter: VueRouter },
			async () => ({ remote: true }),
			new Set()
		);
		expect(kept.modules['@deot/vc']).toEqual({ remote: true });
		expect(kept.modules.pinia).toEqual({ remote: true });
		expect(kept.modules.dayjs).toEqual({ remote: true });
		const nested = await loadLocalModules(
			['lodash-es/debounce'],
			{},
			{ vue: Vue, vueRouter: VueRouter },
			async url => ({ url })
		);
		expect(nested.errors).toEqual([]);
		expect(nested.modules['lodash-es/debounce']).toEqual({ url: 'https://cdn.jsdelivr.net/npm/lodash-es/debounce/+esm' });

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
