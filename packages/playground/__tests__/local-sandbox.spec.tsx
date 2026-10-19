// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { nextTick, ref, type Ref } from 'vue';
import { mount } from '@vue/test-utils';
import LocalSandbox from '../src/core/runtime/local/local-sandbox.vue';
import PopupPreview from '../src/core/runtime/alone/wrapper.vue';
import { createLocalPlayground } from '../src/core/runtime/local/playground';
import { preloadLocalPlayground } from './preload-local';
import { clearRemoteModuleCache } from '../src/core/runtime/local/remote';
import { createBuiltinImports } from '../src/cdn';
import {
	applyPlaygroundImportMapOverride,
	applyPlaygroundStyleOverride,
	clearPlaygroundMaps,
	setPlaygroundSiteModules,
	setPlaygroundSiteStyles
} from '../src/import-map';

const require = createRequire(import.meta.url);
const previewVueSource = readFileSync(require.resolve('vue/dist/vue.runtime.esm-browser.prod.js'), 'utf8');

describe('LocalSandbox', () => {
	beforeAll(async () => {
		await preloadLocalPlayground();
	}, 20_000);
	afterEach(() => clearPlaygroundMaps());
	beforeEach(() => clearRemoteModuleCache());

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

	it('shares configured styles across previews and refreshes without removing host styles', async () => {
		setPlaygroundSiteStyles({
			'@deot/style/dist/index.normalize-only.css': '/local/normalize.css',
			'@deot/style/dist/index.css': '/local/style.css',
			'custom': '/host.css'
		});
		applyPlaygroundStyleOverride('@deot/style/dist/index.css', '/override.css');
		const hostStyle = document.createElement('link');
		hostStyle.rel = 'stylesheet';
		hostStyle.href = '/host.css';
		document.head.appendChild(hostStyle);
		const wrappers = [0, 1].map(() => mount(LocalSandbox, {
			props: {
				files: { 'App.vue': '<template><p>styled</p></template><style>p{color:red}</style>' },
				entry: 'App.vue',
				options: {}
			},
			attachTo: document.body
		}));
		const links = () => [...document.head.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')];
		try {
			await vi.waitFor(() => wrappers.forEach(wrapper => expect(wrapper.text()).toBe('styled')));
			expect(links().map(link => link.href)).toEqual([
				'/host.css',
				'/local/normalize.css',
				'https://cdn.jsdelivr.net/npm/@deot/vc-components/dist/index.style.css',
				'/override.css'
			].map(url => new URL(url, document.baseURI).href));
			const stylesheet = links().find(link => link.href === new URL('/override.css', document.baseURI).href)!;
			const compiledStyle = document.head.querySelector('style[data-playground-id]')!;
			expect(stylesheet.compareDocumentPosition(compiledStyle) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
			(wrappers[0].vm as unknown as { refresh: () => void }).refresh();
			await vi.waitFor(() => expect(wrappers[0].text()).toBe('styled'));
			expect(links()).toHaveLength(4);
			expect(links()).toContain(stylesheet);
			await wrappers[0].setProps({ options: { cdnURL: 'https://cdn.example.test/npm' } });
			await vi.waitFor(() => expect(wrappers[0].text()).toBe('styled'));
			expect(links()).toHaveLength(5);
			wrappers.shift()!.unmount();
			expect(stylesheet.isConnected).toBe(true);
			expect(links()).toHaveLength(4);
		} finally {
			wrappers.forEach(wrapper => wrapper.unmount());
			expect(links()).toEqual([hostStyle]);
			hostStyle.remove();
		}
	});

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

	it.each(['App.vue', 'main.js'])('uses a custom Vue runtime for template refs and %s entry mounting', async (entry) => {
		const vueURL = createBuiltinImports().vue;
		const fetchRequest = vi.spyOn(globalThis, 'fetch').mockImplementation(async url => ({
			ok: true,
			text: async () => url === vueURL
				? previewVueSource
				: `import { defineComponent, h, ref } from 'vue';
export const Scroller = defineComponent({ setup(_, { slots, expose }) {
	const element = ref();
	expose({ tag: () => element.value.tagName });
	return () => h('section', { ref: element }, slots.default?.());
} });`
		} as Response));
		const errors: string[] = [];
		const wrapper = mount(LocalSandbox, {
			props: {
				files: {
					'main.js': `import { createApp } from 'vue';
import App from './App.vue';
createApp(App).provide('entry-label', 'entry').mount('#app');`,
					'App.vue': `<script setup>
import { inject, onMounted, ref } from 'vue';
import { Scroller } from '@deot/vc';
const target = ref();
const label = ref('pending');
const playground = inject('docs:playground');
const entryLabel = inject('entry-label', 'sfc');
onMounted(() => { label.value = playground && target.value ? entryLabel + ':' + target.value.tag() : 'missing'; });
const update = () => { label.value += '!'; };
</script>
<template><Scroller ref="target"><button @click="update">{{ label }}</button></Scroller><DocsLink to="/guide">go</DocsLink></template>`
				},
				entry,
				options: { builtinImportMap: { imports: { vue: vueURL } } },
				previewScroller: true,
				onError: (payload: { compile: string; runtime: string }) => {
					errors.push(...[payload.compile, payload.runtime].filter(Boolean));
				}
			},
			attachTo: document.body
		});
		try {
			const label = entry === 'main.js' ? 'entry:SECTION' : 'sfc:SECTION';
			await vi.waitFor(() => {
				expect(errors).toEqual([]);
				expect(wrapper.get('button').text()).toBe(label);
			});
			await wrapper.get('button').trigger('click');
			await vi.waitFor(() => expect(wrapper.get('button').text()).toBe(`${label}!`));
			expect(wrapper.get('a').attributes('href')).toBe('/guide');
			expect(wrapper.findAll('section')).toHaveLength(2);
			expect(fetchRequest).toHaveBeenCalledWith('https://cdn.jsdelivr.net/npm/@deot/vc/dist/index.js');
			(wrapper.vm as unknown as { refresh: () => void }).refresh();
			await vi.waitFor(() => expect(wrapper.get('button').text()).toBe(label));
			expect(errors).toEqual([]);
		} finally {
			wrapper.unmount();
			fetchRequest.mockRestore();
		}
	});

	it('isolates module overrides and reactive state across host and custom Vue previews', async () => {
		const defaults = createBuiltinImports();
		setPlaygroundSiteModules({ 'lodash-es': 'https://site.test/lodash.js' });
		applyPlaygroundImportMapOverride('lodash-es', 'https://management.test/lodash.js');
		const fetchRequest = vi.spyOn(globalThis, 'fetch').mockImplementation(async url => ({
			ok: true,
			text: async () => url === defaults.vue
				? previewVueSource
				: `
				import { ref } from 'vue';
				export const state = ref(0);
				export const label = '${url === defaults['lodash-es'] ? 'instance' : 'management'}';`
		} as Response));
		const errors: string[] = [];
		const wrappers = [
			{ 'vue': defaults.vue, 'lodash-es': defaults['lodash-es'] },
			{ 'lodash-es': defaults['lodash-es'] },
			{}
		].map(imports => mount(LocalSandbox, {
			props: {
				files: { 'App.vue': `<script setup>
import { label, state } from 'lodash-es';
</script><template><button @click="state++">{{ label }}:{{ state }}</button></template>` },
				entry: 'App.vue',
				options: { builtinImportMap: { imports } },
				onError: (payload: { compile: string; runtime: string }) => {
					errors.push(...[payload.compile, payload.runtime].filter(Boolean));
				}
			},
			attachTo: document.body
		}));
		const labels = () => wrappers.map(wrapper => wrapper.get('button').text());
		try {
			await vi.waitFor(() => {
				expect(errors).toEqual([]);
				expect(labels()).toEqual(['instance:0', 'instance:0', 'management:0']);
			});
			await wrappers[0].get('button').trigger('click');
			await wrappers[1].get('button').trigger('click');
			await wrappers[1].get('button').trigger('click');
			await vi.waitFor(() => expect(labels()).toEqual(['instance:1', 'instance:2', 'management:0']));
			(wrappers[0].vm as unknown as { refresh: () => void }).refresh();
			await vi.waitFor(() => expect(labels()).toEqual(['instance:0', 'instance:2', 'management:0']));
			expect(errors).toEqual([]);
			expect(fetchRequest).not.toHaveBeenCalledWith('https://site.test/lodash.js');
		} finally {
			wrappers.forEach(wrapper => wrapper.unmount());
			fetchRequest.mockRestore();
		}
	});

	it('reports compile failures and DocsLink navigation', async () => {
		setPlaygroundSiteStyles({ custom: '/compile-error.css' });
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
		const stylesheet = document.querySelector('link[href$="/compile-error.css"]')!;
		expect(stylesheet).toBeTruthy();
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
		expect(stylesheet.isConnected).toBe(true);
		wrapper.unmount();
		expect(stylesheet.isConnected).toBe(false);
	});

	it('renders the same files inside the standalone preview', async () => {
		setPlaygroundSiteStyles({ custom: '/popup.css' });
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
		expect(document.querySelectorAll('link[href$="/popup.css"]')).toHaveLength(1);
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
		expect(document.querySelector('link[href$="/popup.css"]')).toBeNull();
		editor.remove();
	});

	it('wraps local preview content in a scroller and reports render errors', async () => {
		const fetchRequest = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
			ok: true,
			text: async () => `import { h } from 'vue';
				export const Scroller = { setup(_, { slots }) { return () => h('section', slots.default()); } };`
		} as Response);
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
		fetchRequest.mockRestore();
	});

	it('reports a remote module that cannot be loaded', async () => {
		const fetchRequest = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('offline'));
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
		fetchRequest.mockRestore();
	});
});
