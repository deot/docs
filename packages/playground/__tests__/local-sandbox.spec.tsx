// @vitest-environment jsdom
import { nextTick, ref, type Ref } from 'vue';
import { mount } from '@vue/test-utils';
import LocalSandbox from '../src/core/runtime/local/local-sandbox.vue';
import PopupPreview from '../src/core/runtime/alone/wrapper.vue';
import { createLocalPlayground } from '../src/core/runtime/local/playground';
import { preloadLocalPlayground } from './preload-local';

describe('LocalSandbox', () => {
	beforeAll(async () => {
		await preloadLocalPlayground();
	}, 20_000);

	it('runs the injected handler without requesting preview height', async () => {
		const service = createLocalPlayground({
			isRef: (value: unknown): value is Ref => (
				!!value && typeof value === 'object' && 'value' in value
			)
		});
		await expect(service.enable()).resolves.toBe(true);
		service.disable();
		service.dispose();
		expect(service.run()()).toBeUndefined();
		await expect(Promise.resolve(service.run(1, () => 'ok')())).resolves.toBe('ok');
		const visible = ref(false);
		await service.run(560, { visible })();
		expect(visible.value).toBe(true);
	});
	it('renders files in the current document and injects docs:playground', async () => {
		const wrapper = mount(LocalSandbox, {
			props: {
				files: {
					'App.vue': `<template><p class="local-result">{{ label }}</p></template>
<script setup>
import { inject, version } from 'vue'
const playground = inject('docs:playground')
const label = playground && version ? 'ready' : 'missing'
</script>
<style>
.local-result { color: #123456; }
</style>`
				},
				entry: 'App.vue',
				options: {}
			},
			attachTo: document.body
		});

		await vi.waitFor(() => {
			expect(wrapper.get('.local-result').text()).toBe('ready');
		}, { timeout: 10_000 });
		expect(wrapper.find('iframe').exists()).toBe(true);
		expect(document.querySelector('style[data-playground-id]')).toBeTruthy();
		wrapper.unmount();
		await nextTick();
		expect(document.querySelector('.local-result')).toBeNull();
	}, 15_000);

	it('does not expand preview height when docs:playground.run is called', async () => {
		const messages: unknown[] = [];
		const onMessage = (event: MessageEvent) => {
			if (event.data?.action === 'docs:height') messages.push(event.data);
		};
		window.addEventListener('message', onMessage);
		const wrapper = mount(LocalSandbox, {
			props: {
				files: {
					'App.vue': `<template>
	<button type="button" @click="handleClick">open</button>
	<p v-if="isActive" class="opened">opened</p>
</template>
<script setup>
import { inject, ref } from 'vue'
const playground = inject('docs:playground')
const isActive = ref(false)
const handleClick = playground.run(560, { visible: isActive })
</script>`
				},
				entry: 'App.vue',
				options: {}
			},
			attachTo: document.body
		});
		await vi.waitFor(() => expect(wrapper.get('button').text()).toBe('open'));
		await wrapper.get('button').trigger('click');
		await vi.waitFor(() => expect(wrapper.get('.opened').text()).toBe('opened'));
		expect(messages).toEqual([]);
		window.removeEventListener('message', onMessage);
		wrapper.unmount();
	});

	it('reports compile failures and DocsLink navigation', async () => {
		const errors: string[] = [];
		const wrapper = mount(LocalSandbox, {
			props: {
				files: {
					'App.vue': `<template><DocsLink to="/guide">go</DocsLink></template>`
				},
				entry: 'Nope.vue',
				options: {},
				onError: (payload: { compile: string }) => errors.push(payload.compile)
			},
			attachTo: document.body
		});
		await vi.waitFor(() => expect(errors.join('\n')).toContain('entry 不在 files'));
		await wrapper.setProps({
			files: {
				'App.vue': '<template><DocsLink to="/guide">go</DocsLink></template>'
			},
			entry: 'App.vue'
		});
		await vi.waitFor(() => expect(wrapper.text()).toContain('go'));
		const navigated = new Promise<unknown>((resolve) => {
			const onMessage = (event: MessageEvent) => {
				if (event.data?.action !== 'docs:navigate') return;
				window.removeEventListener('message', onMessage);
				resolve(event.data);
			};
			window.addEventListener('message', onMessage);
		});
		await wrapper.get('a').trigger('click');
		await expect(navigated).resolves.toMatchObject({ action: 'docs:navigate', to: '/guide' });
		wrapper.unmount();
	});

	it('renders the same files inside the standalone preview', async () => {
		const navigate = vi.fn();
		const viewport = vi.fn();
		const wrapper = mount(PopupPreview, {
			props: {
				local: true,
				store: null,
				copyValue: '<template />',
				files: {
					'App.vue': '<template><p class="popup-local">popup</p></template>'
				},
				entry: 'App.vue',
				options: {},
				onNavigate: navigate,
				onViewportChange: viewport
			},
			attachTo: document.body
		});
		await vi.waitFor(() => expect(wrapper.get('.popup-local').text()).toBe('popup'));
		await wrapper.get('[data-action="refresh"]').trigger('click');
		await vi.waitFor(() => expect(wrapper.get('.popup-local').text()).toBe('popup'));
		const editor = document.createElement('div');
		editor.className = 'docs-playground-editor__wrapper';
		document.body.appendChild(editor);
		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
		expect(wrapper.emitted('portal-fulfilled')).toBeFalsy();
		editor.style.display = 'none';
		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
		expect(wrapper.emitted('portal-fulfilled')).toBeTruthy();
		window.dispatchEvent(new Event('resize'));
		const iframe = wrapper.get('iframe').element as HTMLIFrameElement;
		window.dispatchEvent(new MessageEvent('message', {
			data: { action: 'docs:navigate', to: '/from-popup' },
			source: iframe.contentWindow
		}));
		expect(navigate).toHaveBeenCalledWith('/from-popup');
		await wrapper.setProps({ viewport: 375 });
		await wrapper.get('[data-action="close-popup"]').trigger('click');
		wrapper.unmount();
		editor.remove();
	});

	it('wraps local preview content in a scroller and reports render errors', async () => {
		const errors: string[] = [];
		const wrapper = mount(LocalSandbox, {
			props: {
				files: {
					'App.vue': `<template><button type="button" @click="fail">boom</button></template>
<script setup>
const fail = () => { throw new Error('render-fail') }
</script>`
				},
				entry: 'App.vue',
				options: {},
				previewScroller: true,
				clearConsole: true,
				onError: (payload: { runtime: string }) => {
					if (payload.runtime) errors.push(payload.runtime);
				}
			},
			attachTo: document.body
		});
		await vi.waitFor(() => expect(wrapper.get('button').text()).toBe('boom'));
		await wrapper.get('button').trigger('click');
		await vi.waitFor(() => expect(errors.join('\n')).toContain('render-fail'));
		wrapper.unmount();
	});

	it('reports a remote module that cannot be loaded', async () => {
		const errors: string[] = [];
		const wrapper = mount(LocalSandbox, {
			props: {
				files: {
					'App.vue': `<script setup>
import dayjs from 'dayjs'
</script>
<template><p>{{ !!dayjs }}</p></template>`
				},
				entry: 'App.vue',
				options: {
					builtinImportMap: {
						imports: { dayjs: 'https://example.invalid/dayjs.js' }
					}
				},
				onError: (payload: { compile: string }) => {
					if (payload.compile) errors.push(payload.compile);
				}
			},
			attachTo: document.body
		});
		await vi.waitFor(() => expect(errors.join('\n')).toContain('无法加载模块'));
		wrapper.unmount();
	});
});
