// @vitest-environment jsdom

import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { ResourceRequestError } from '../src/modules/gateway/types';
import RemoteSfc from '../src/components/remote-sfc/remote-sfc.vue';
import { computed, shallowRef } from 'vue';
import { previewConfigKey } from '../src/modules/preview/config';
import type { PreviewConfig } from '../src/modules/preview/config';

const { load, subscribe, release, push, listeners, notifyOnLoad } = vi.hoisted(() => ({
	load: vi.fn(),
	subscribe: vi.fn(),
	release: vi.fn(),
	push: vi.fn(),
	listeners: new Map<string, () => void>(),
	notifyOnLoad: { value: false }
}));
enableAutoUnmount(afterEach);
afterEach(() => vi.unstubAllGlobals());

vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }));
vi.mock('../src/modules/gateway', () => ({
	Gateway: {
		load,
		subscribe: (identity: any, listener: () => void) => {
			listeners.set(identity.source, listener);
			subscribe(identity, listener);
			return release;
		}
	}
}));
vi.mock('@deot/docs-playground', async () => ({
	Playground: (await import('vue')).defineComponent({
		name: 'Playground',
		props: ['files', 'entry', 'options', 'styleless', 'previewInset', 'expandable', 'local', 'viewport', 'views', 'previewOptions'],
		emits: ['navigate'],
		setup: props => () => <div class="playground">{props.entry}</div>
	})
}));

describe('RemoteSfc', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		listeners.clear();
		notifyOnLoad.value = false;
		window.$docs = {
			locales: { 'zh-CN': { label: '简体中文' }, 'en-US': { label: 'English' } },
			routes: {},
			modules: { lodash: 'https://esm.sh/lodash' },
			namespace: 'remote-test',
			base: 'https://docs.example.com/',
			runtime: { mode: 'production' }
		};
		load.mockImplementation(async (identity: any, options: any) => {
			const url = options.url as string;
			let content = '.base { display: block; }';
			if (url.endsWith('/components/index.vue')) {
				content = `<script src="./logic.ts"></script>
					<script>import "./dep.ts"; import "lodash"</script>
					<style src="./theme.css"></style>
					<style>@import "./inline.css";</style><template><div /></template>`;
			} else if (url.endsWith('/components/dep.ts')) {
				content = 'import "./theme.css"; export default 1';
			} else if (url.endsWith('/components/logic.ts')) {
				content = 'export default 1';
			} else if (url.endsWith('/components/theme.css')) {
				content = '@import url(./base.css); .root { color: red; }';
			} else if (url.endsWith('/components/inline.css')) {
				content = '.inline { display: block; }';
			}
			if (notifyOnLoad.value) listeners.get(identity.source)?.();
			return {
				content
			};
		});
	});

	it('loads recursive SFC dependencies and maps bare modules', async () => {
		notifyOnLoad.value = true;
		const wrapper = mount(() => (
			<RemoteSfc source="./components/index.vue" lang="zh-CN" />
		));
		await vi.waitFor(() => expect(wrapper.find('.playground').exists()).toBe(true));
		const playground = wrapper.findComponent({ name: 'Playground' });
		expect(playground.props('entry')).toBe('components/index.vue');
		expect(Object.keys(playground.props('files'))).toEqual([
			'components/index.vue',
			'components/logic.ts',
			'components/dep.ts',
			'components/theme.css',
			'components/inline.css',
			'components/base.css'
		]);
		expect(playground.props('options')).toEqual({
			builtinImportMap: { imports: { lodash: 'https://esm.sh/lodash' } }
		});
		expect(subscribe).toHaveBeenCalledTimes(6);
		expect(load).toHaveBeenCalledTimes(6);
		const signals = load.mock.calls.map(call => call[1].signal);
		expect(signals.every(signal => signal instanceof AbortSignal)).toBe(true);
		expect(new Set(signals).size).toBe(1);

		await playground.vm.$emit('navigate', '/guide');
		expect(push).toHaveBeenCalledWith('/zh-CN/guide');
		await playground.vm.$emit('navigate', '/en-US/guide');
		expect(push).toHaveBeenCalledWith('/en-US/guide');
		wrapper.unmount();
		expect(signals[0].aborted).toBe(true);
	});

	it('loads extensionless remote modules, nested Vue files and Sass partials', async () => {
		const root = 'https://raw.githubusercontent.com/deot/vc/refs/heads/main/packages/components/theme/examples/';
		const sources: Record<string, string> = {
			[`${root}theme-audit.vue`]: `<script setup>
				import './theme-audit/catalogue'; import './theme-audit/gallery.vue';
			</script><style lang="scss">@use './theme-audit/style';</style>`,
			[`${root}theme-audit/catalogue.ts`]: 'export const count = 1',
			[`${root}theme-audit/gallery.vue`]: '<template><div /></template>',
			[`${root}theme-audit/style.scss`]: '@use \'../../../style/theme\';'
		};
		const partial = new URL('../../../style/_theme.scss', `${root}theme-audit/style.scss`).href;
		sources[partial] = '$color: red;';
		vi.stubGlobal('fetch', vi.fn(async () => ({
			ok: true,
			json: async () => ({ tree: Object.keys(sources).map(url => ({ type: 'blob', path: url.split('/refs/heads/main/')[1] })) })
		})));

		load.mockImplementation(async (_identity: any, options: any) => {
			if (!(options.url in sources)) throw new ResourceRequestError(404);
			return { content: sources[options.url] };
		});
		const wrapper = mount(RemoteSfc, { props: { source: `${root}theme-audit.vue`, lang: 'zh-CN' } });
		await vi.waitFor(() => expect(wrapper.find('.playground').exists()).toBe(true));
		const files = wrapper.findComponent({ name: 'Playground' }).props('files');
		expect(Object.keys(files)).toHaveLength(5);
		expect(files[new URL(partial).pathname.slice(1)]).toBe('$color: red;');
		expect(Object.keys(files).some(key => key.endsWith('/catalogue.ts'))).toBe(true);
	});

	it('continues loading relative files when the GitHub file tree is rate limited', async () => {
		const base = 'https://raw.githubusercontent.com/deot/vc/refs/heads/main/demo/';
		const sources: Record<string, string> = {
			[`${base}App.vue`]: `<script>import './logic';</script>`,
			[`${base}logic.ts`]: 'export const value = 1;'
		};
		vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 403 })));
		load.mockImplementation(async (_identity: any, options: any) => {
			if (!(options.url in sources)) throw new ResourceRequestError(404);
			return { content: sources[options.url] };
		});
		const wrapper = mount(RemoteSfc, { props: { source: `${base}App.vue`, lang: 'zh-CN' } });
		await vi.waitFor(() => expect(wrapper.find('.playground').exists()).toBe(true));
		expect(Object.keys(wrapper.findComponent({ name: 'Playground' }).props('files'))).toHaveLength(2);
	});

	it('tracks a non-GitHub HTTP source tree through extensionless imports and cycles', async () => {
		const base = 'https://assets.example.com/demo/';
		const sources: Record<string, string> = {
			[`${base}App.vue`]: `<script setup>import './logic'; import './widgets';</script><style>@use './theme';</style>`,
			[`${base}logic.js`]: `import './App.vue'; export const value = 1;`,
			[`${base}widgets/index.tsx`]: `export { value } from '../logic';`,
			[`${base}_theme.scss`]: '$color: red;'
		};
		load.mockImplementation(async (_identity: any, options: any) => {
			if (!(options.url in sources)) throw new ResourceRequestError(404);
			return { content: sources[options.url] };
		});
		const wrapper = mount(RemoteSfc, { props: { source: `${base}App.vue`, lang: 'zh-CN' } });
		await vi.waitFor(() => expect(wrapper.find('.playground').exists()).toBe(true));
		expect(wrapper.findComponent({ name: 'Playground' }).props('files')).toEqual({
			'demo/App.vue': sources[`${base}App.vue`],
			'demo/logic.js': sources[`${base}logic.js`],
			'demo/widgets/index.tsx': sources[`${base}widgets/index.tsx`],
			'demo/_theme.scss': '$color: red;'
		});
	});

	it('forwards site playground defaults while keeping remote sfc styleless', async () => {
		window.$docs.components = {
			playground: {
				previewInset: 16,
				expandable: true,
				options: {
					builtinImportMap: {
						imports: { vue: 'https://cdn.example.com/vue.js' }
					}
				}
			}
		};
		const wrapper = mount(() => (
			<RemoteSfc source="./components/index.vue" lang="zh-CN" />
		));
		await vi.waitFor(() => expect(wrapper.find('.playground').exists()).toBe(true));
		const playground = wrapper.findComponent({ name: 'Playground' });
		expect(playground.props('previewInset')).toBe(16);
		expect(playground.props('expandable')).toBe(true);
		expect(playground.props('styleless')).toBe(true);
		expect(playground.props('options')).toEqual({
			builtinImportMap: {
				imports: {
					vue: 'https://cdn.example.com/vue.js',
					lodash: 'https://esm.sh/lodash'
				}
			}
		});
	});

	it('applies preview modules and local props without reloading sources for CSS changes', async () => {
		const config = shallowRef<PreviewConfig>({
			url: './components/index.vue', styles: ['/custom.css'], modules: { lodash: 'https://example.com/lodash.js' },
			playground: { local: true, styleless: false, viewport: [375, 640], previewInset: 16, views: ['runtime', 'files'] }
		});
		const wrapper = mount(RemoteSfc, {
			props: { source: config.value.url, lang: 'zh-CN' },
			global: { provide: { [previewConfigKey as symbol]: computed(() => config.value) } }
		});
		await vi.waitFor(() => expect(wrapper.find('.playground').exists()).toBe(true));
		const playground = wrapper.findComponent({ name: 'Playground' });
		expect(playground.props('options').builtinImportMap.imports.lodash).toBe('https://example.com/lodash.js');
		expect(playground.props('viewport')).toEqual([375, 640]);
		expect(playground.props('styleless')).toBe(false);
		expect(playground.props('previewInset')).toBe(16);
		const options = playground.props('options');
		const instance = playground.vm.$;
		const calls = load.mock.calls.length;
		config.value = { ...config.value, styles: ['/other.css'], modules: { ...config.value.modules } };
		await flushPromises();
		expect(wrapper.findComponent({ name: 'Playground' }).props('options')).toBe(options);
		expect(wrapper.findComponent({ name: 'Playground' }).vm.$).toBe(instance);
		expect(load).toHaveBeenCalledTimes(calls);
		config.value = { ...config.value, modules: { lodash: 'https://example.com/next.js' }, playground: { local: false } };
		await flushPromises();
		const iframe = wrapper.findComponent({ name: 'Playground' });
		expect(iframe.vm.$).not.toBe(instance);
		expect(iframe.props('local')).toBe(false);
		expect(iframe.props('previewOptions').headHTML).toContain('/other.css');
		expect(iframe.props('options').builtinImportMap.imports.lodash).toBe('https://example.com/next.js');
		expect(load).toHaveBeenCalledTimes(calls);
	});

	it('resolves recursive imports when development URLs are root-relative', async () => {
		window.$docs.runtime = { mode: 'development', workspace: '/site/' };
		const wrapper = mount(RemoteSfc, {
			props: { source: './components/index.vue', lang: 'zh-CN' }
		});
		await vi.waitFor(() => expect(wrapper.find('.playground').exists()).toBe(true));
		expect(load).toHaveBeenCalledWith(expect.objectContaining({
			source: './components/dep.ts'
		}), expect.objectContaining({
			url: expect.stringContaining('/site/zh-CN/components/dep.ts')
		}));
	});

	it('reloads subscribed content, reports failures and releases subscriptions', async () => {
		const wrapper = mount(RemoteSfc, {
			props: { source: './components/index.vue', lang: 'zh-CN' }
		});
		await vi.waitFor(() => expect(wrapper.find('.playground').exists()).toBe(true));
		listeners.get('./components/index.vue')?.();
		await flushPromises();
		expect(load.mock.calls.length).toBeGreaterThan(4);
		wrapper.unmount();
		expect(release).toHaveBeenCalled();

		load.mockRejectedValueOnce(new Error('SFC failed'));
		const failed = mount(RemoteSfc, {
			props: { source: './components/index.vue', lang: 'zh-CN' }
		});
		await vi.waitFor(() => expect(failed.text()).toContain('SFC failed'));

		load.mockRejectedValueOnce(new Error('plain failure'));
		await failed.setProps({ source: './components/other.vue' });
		await vi.waitFor(() => expect(failed.text()).toContain('plain failure'));

		load.mockRejectedValueOnce(new Error('404 Not Found'));
		await failed.setProps({ source: './components/missing.vue' });
		await vi.waitFor(() => expect(failed.text()).toContain('404 Not Found'));

		load.mockRejectedValueOnce({ unexpected: true });
		await failed.setProps({ source: './components/unknown.vue' });
		await vi.waitFor(() => expect(failed.text()).toContain('Resource request failed'));
	});

	it('aborts stale resource graphs on route changes and unmount', async () => {
		let finishOld!: (record: { content: string }) => void;
		let oldSignal!: AbortSignal;
		load.mockImplementationOnce(async (_identity: any, options: any) => {
			oldSignal = options.signal;
			return new Promise<{ content: string }>((resolve) => {
				finishOld = resolve;
			});
		});
		const wrapper = mount(RemoteSfc, {
			props: { source: './components/index.vue', lang: 'zh-CN' }
		});
		await vi.waitFor(() => expect(oldSignal).toBeInstanceOf(AbortSignal));

		await wrapper.setProps({ source: './components/other.vue' });
		expect(oldSignal.aborted).toBe(true);
		await vi.waitFor(() => expect(wrapper.find('.playground').exists()).toBe(true));
		expect(wrapper.findComponent({ name: 'Playground' }).props('entry'))
			.toBe('components/other.vue');
		finishOld({ content: '<template>stale</template>' });
		await flushPromises();
		expect(wrapper.findComponent({ name: 'Playground' }).props('entry'))
			.toBe('components/other.vue');

		let finishUnmounted!: (record: { content: string }) => void;
		let unmountSignal!: AbortSignal;
		load.mockImplementationOnce(async (_identity: any, options: any) => {
			unmountSignal = options.signal;
			return new Promise<{ content: string }>((resolve) => {
				finishUnmounted = resolve;
			});
		});
		await wrapper.setProps({ source: './components/pending.vue' });
		await vi.waitFor(() => expect(unmountSignal).toBeInstanceOf(AbortSignal));
		wrapper.unmount();
		expect(unmountSignal.aborted).toBe(true);
		finishUnmounted({ content: '<template>ignored</template>' });
		await flushPromises();
	});
});
