// @vitest-environment jsdom

import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import RemoteSfc from '../src/components/remote-sfc/remote-sfc.vue';

const { load, subscribe, release, push, listeners, notifyOnLoad } = vi.hoisted(() => ({
	load: vi.fn(),
	subscribe: vi.fn(),
	release: vi.fn(),
	push: vi.fn(),
	listeners: new Map<string, () => void>(),
	notifyOnLoad: { value: false }
}));
enableAutoUnmount(afterEach);

vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }));
vi.mock('../src/modules', () => ({
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
		props: ['files', 'entry', 'options', 'styleless'],
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
