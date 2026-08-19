// @vitest-environment jsdom

import { defineComponent, nextTick, ref } from 'vue';
import { mount } from '@vue/test-utils';
import { useStore } from '@vue/repl';
import { zhCN } from '@deot/docs-locale';
import { DEFAULT_CDN_URL } from '../src/constants';
import {
	createBuiltinImports,
	normalizeCdnURL
} from '../src/cdn';
import {
	createRuntimePreviewOptions
} from '../src/core/store';
import {
	applyPlaygroundImportMapOverride,
	applyPlaygroundStyleOverride,
	clearPlaygroundMaps,
	removePlaygroundImportMapOverride,
	removePlaygroundStyleOverride,
	setPlaygroundSiteModules,
	setPlaygroundSiteStyles
} from '../src/import-map';
import Playground from '../src/playground.vue';
import type { PlaygroundStoreStub } from './fixtures';

const { popup, store, setFiles } = vi.hoisted(() => {
	const nextStore: PlaygroundStoreStub = {
		options: {
			files: { value: {} },
			mainFile: { value: '' },
			activeFilename: { value: '' },
			template: { value: {} },
			builtinImportMap: { value: { imports: {} } }
		},
		files: {},
		mainFile: '',
		activeFilename: '',
		errors: [],
		init: vi.fn(),
		setActive: vi.fn(),
		addFile: vi.fn(),
		renameFile: vi.fn(),
		setFiles: vi.fn()
	};
	return { popup: vi.fn(), setFiles: vi.fn(), store: nextStore };
});

vi.mock('../src/editor', () => ({ Editor: { popup } }));
vi.mock('@deot/vc', () => ({
	Clipboard: defineComponent({
		name: 'Clipboard',
		props: ['value'],
		setup: (_, { slots }) => () => (
			<button class="clipboard">{slots.default?.()}</button>
		)
	}),
	Dropdown: defineComponent({
		name: 'Dropdown',
		props: ['modelValue'],
		emits: ['update:modelValue'],
		setup: (_, { slots }) => () => (
			<div class="dropdown">
				{slots.default?.()}
				<div class="dropdown-content">{slots.content?.()}</div>
			</div>
		)
	}),
	DropdownMenu: defineComponent({
		name: 'DropdownMenu',
		setup: (_, { slots }) => () => (
			<div class="dropdown-menu">{slots.default?.()}</div>
		)
	}),
	DropdownItem: defineComponent({
		name: 'DropdownItem',
		props: ['value', 'selected'],
		emits: ['click'],
		setup: (props, { emit, slots }) => () => (
			<button
				class={{ 'dropdown-item': true, 'is-selected': props.selected }}
				onClick={() => emit('click', props.value)}
			>
				{slots.default?.()}
			</button>
		)
	}),
	Scroller: defineComponent({
		name: 'Scroller',
		props: ['contentClass'],
		setup: (props, { slots }) => () => (
			<div class="scroller">
				<div class={props.contentClass}>{slots.default?.()}</div>
			</div>
		)
	})
}));
vi.mock('@vue/repl', () => ({
	File: class {
		constructor(public filename: string, public code = '') {}
	},
	Sandbox: defineComponent({
		name: 'Sandbox',
		props: ['store', 'autoStoreInit', 'clearConsole', 'previewOptions'],
		setup(_props, { expose }) {
			const container = ref<HTMLElement | null>(null);
			expose({ container });
			return () => (
				<div ref={container} class="sandbox">
					<iframe />
				</div>
			);
		}
	}),
	useStore: vi.fn((options) => {
		store.options = options;
		store.files = options.files.value;
		store.mainFile = options.mainFile.value;
		store.activeFilename = options.activeFilename.value;
		store.errors = [];
		store.init = vi.fn();
		store.setActive = vi.fn((filename: string) => (store.activeFilename = filename));
		store.addFile = vi.fn((file: { filename: string; code: string }) => {
			store.files[file.filename] = file;
			store.activeFilename = file.filename;
		});
		store.renameFile = vi.fn((oldFilename: string, newFilename: string) => {
			const file = store.files[oldFilename];
			file.filename = newFilename;
			store.files[newFilename] = file;
			delete store.files[oldFilename];
			if (store.mainFile === oldFilename) store.mainFile = newFilename;
		});
		store.setFiles = setFiles.mockImplementation((files: Record<string, string>, entry: string) => {
			store.files = Object.fromEntries(Object.entries(files).map(([filename, code]) => [
				`src/${filename}`,
				{ filename: `src/${filename}`, code }
			]));
			store.mainFile = `src/${entry}`;
		});
		return store;
	})
}));

describe('Playground', () => {
	beforeEach(() => {
		popup.mockReset();
		setFiles.mockReset();
		vi.mocked(useStore).mockClear();
		clearPlaygroundMaps();
	});

	it('renders the preview and merges custom imports', () => {
		const wrapper = mount(Playground, {
			props: {
				modelValue: '<template>hello</template>',
				options: { builtinImportMap: { imports: { vue: '/vue.js', custom: '/custom.js' } } }
			}
		});

		expect(wrapper.classes()).toContain('docs-playground');
		expect(wrapper.find('.clipboard').attributes('aria-label')).toBe('Copy');
		expect(store.options.template.value.welcomeSFC).toContain('hello');
		expect(store.options.builtinImportMap.value.imports.vue).toBe('/vue.js');
		expect(store.options.builtinImportMap.value.imports.custom).toBe('/custom.js');
		expect(store.files['src/App.vue'].code).toContain('hello');
		expect(store.init).toHaveBeenCalledTimes(1);
		expect(wrapper.findComponent({ name: 'Sandbox' }).props('autoStoreInit')).toBe(false);
		expect(wrapper.findComponent({ name: 'Sandbox' }).props('previewOptions').showRuntimeError)
			.toBe(false);
		expect(wrapper.findComponent({ name: 'Sandbox' }).props('previewOptions').showRuntimeWarning)
			.toBe(false);
		expect(wrapper.findComponent({ name: 'Sandbox' }).props('previewOptions').headHTML)
			.toContain('@deot/style');
		expect(wrapper.findComponent({ name: 'Sandbox' }).props('previewOptions').headHTML)
			.toContain(`${DEFAULT_CDN_URL}/@deot/style/dist/index.css`);
		expect(wrapper.findComponent({ name: 'Sandbox' }).props('previewOptions').headHTML)
			.not.toContain('unpkg.com');
		expect(store.options.builtinImportMap.value.imports['@deot/vc'])
			.toBe(`${DEFAULT_CDN_URL}/@deot/vc/dist/index.js`);
		expect(wrapper.findComponent({ name: 'Sandbox' }).props('previewOptions').headHTML)
			.toContain('name="viewport"');
		expect(wrapper.findComponent({ name: 'Sandbox' }).props('previewOptions').customCode.useCode)
			.toContain('app.component("DocsLink"');
		expect(wrapper.findComponent({ name: 'Sandbox' }).props('previewOptions').customCode.useCode)
			.toContain('textDecoration:"none"');
	});

	it('shares a configurable npm CDN between preview styles and builtin imports', () => {
		expect(normalizeCdnURL(' https://unpkg.com/ ')).toBe('https://unpkg.com');
		expect(normalizeCdnURL('')).toBe(DEFAULT_CDN_URL);
		expect(createBuiltinImports()['@deot/vc'])
			.toBe(`${DEFAULT_CDN_URL}/@deot/vc/dist/index.js`);
		expect(createBuiltinImports()['lodash-es']).toBe(`${DEFAULT_CDN_URL}/lodash-es/+esm`);
		expect(createBuiltinImports('https://unpkg.com/')['lodash-es'])
			.toBe(`${DEFAULT_CDN_URL}/lodash-es/+esm`);
		expect(createRuntimePreviewOptions().headHTML)
			.toContain(`${DEFAULT_CDN_URL}/@deot/vc-components/dist/index.style.css`);

		const wrapper = mount(Playground, {
			props: {
				modelValue: '<template>cdn</template>',
				options: {
					cdnURL: 'https://unpkg.com/',
					builtinImportMap: { imports: { custom: '/custom.js' } }
				}
			}
		});
		const imports = store.options.builtinImportMap.value.imports;
		const headHTML = wrapper.findComponent({ name: 'Sandbox' }).props('previewOptions').headHTML;

		expect(imports['@deot/vc']).toBe('https://unpkg.com/@deot/vc/dist/index.js');
		expect(imports['lodash-es']).toBe(`${DEFAULT_CDN_URL}/lodash-es/+esm`);
		expect(imports.custom).toBe('/custom.js');
		expect(imports.vue).toBe('https://play.vuejs.org/vue.runtime.esm-browser.js');
		expect(headHTML).toContain('https://unpkg.com/@deot/style/dist/index.normalize-only.css');
		expect(headHTML).toContain('https://unpkg.com/@deot/vc-components/dist/index.style.css');
		expect(headHTML).toContain('https://unpkg.com/@deot/style/dist/index.css');
		expect(headHTML).not.toContain('cdn.jsdelivr.net');
	});

	it('applies site-level import map overrides above instance imports', () => {
		applyPlaygroundImportMapOverride('vue', 'https://cdn.example.com/vue.js');
		applyPlaygroundImportMapOverride('custom', 'https://cdn.example.com/custom.js');
		const wrapper = mount(Playground, {
			props: {
				modelValue: '<template>override</template>',
				options: {
					builtinImportMap: {
						imports: {
							vue: '/vue.js',
							custom: '/custom.js'
						}
					}
				}
			}
		});
		const imports = store.options.builtinImportMap.value.imports;
		expect(imports.vue).toBe('https://cdn.example.com/vue.js');
		expect(imports.custom).toBe('https://cdn.example.com/custom.js');
		expect(imports['@deot/vc']).toBe(`${DEFAULT_CDN_URL}/@deot/vc/dist/index.js`);

		removePlaygroundImportMapOverride('vue');
		mount(Playground, {
			props: {
				modelValue: '<template>reset</template>',
				options: { builtinImportMap: { imports: { vue: '/vue.js' } } }
			}
		});
		expect(store.options.builtinImportMap.value.imports.vue).toBe('/vue.js');
		expect(store.options.builtinImportMap.value.imports.custom)
			.toBe('https://cdn.example.com/custom.js');
		wrapper.unmount();
	});

	it('ignores unsafe site-level import overrides so instance defaults remain', () => {
		applyPlaygroundImportMapOverride('vue', 'javascript:alert(1)');
		const wrapper = mount(Playground, {
			props: {
				modelValue: '<template>unsafe</template>',
				options: { builtinImportMap: { imports: { vue: '/vue.js' } } }
			}
		});
		const imports = store.options.builtinImportMap.value.imports;
		expect(imports.vue).toBe('/vue.js');
		expect(JSON.stringify(imports)).not.toContain('javascript:');
		wrapper.unmount();
	});

	it('ignores unsafe instance import map entries so builtin defaults remain', () => {
		const wrapper = mount(Playground, {
			props: {
				modelValue: '<template>unsafe-instance</template>',
				options: {
					builtinImportMap: {
						imports: {
							vue: 'javascript:alert(1)',
							evil: 'data:text/javascript,alert(1)'
						}
					}
				}
			}
		});
		const imports = store.options.builtinImportMap.value.imports;
		expect(imports.vue).toBe(createBuiltinImports().vue);
		expect(imports.evil).toBeUndefined();
		expect(JSON.stringify(imports)).not.toContain('javascript:');
		wrapper.unmount();
	});

	it('applies site-level default styles to preview headHTML', () => {
		setPlaygroundSiteStyles({
			'@deot/style/dist/index.css': 'https://cdn.example.com/theme.css',
			'@my/ui/dist/index.css': '/assets/ui.css',
			'evil': 'javascript:alert(1)'
		});
		const wrapper = mount(Playground, {
			props: { modelValue: '<template>site-style</template>' }
		});
		const headHTML = wrapper.findComponent({ name: 'Sandbox' }).props('previewOptions').headHTML;
		expect(headHTML).toContain('https://cdn.example.com/theme.css');
		expect(headHTML).toContain('/assets/ui.css');
		expect(headHTML).not.toContain(`${DEFAULT_CDN_URL}/@deot/style/dist/index.css`);
		expect(headHTML).toContain(`${DEFAULT_CDN_URL}/@deot/style/dist/index.normalize-only.css`);
		expect(headHTML).not.toContain('javascript:alert');
		wrapper.unmount();
	});

	it('applies site-level style overrides to preview headHTML', () => {
		applyPlaygroundStyleOverride(
			'@deot/style/dist/index.css',
			'https://cdn.example.com/custom-style.css'
		);
		const wrapper = mount(Playground, {
			props: {
				modelValue: '<template>style</template>'
			}
		});
		const headHTML = wrapper.findComponent({ name: 'Sandbox' }).props('previewOptions').headHTML;
		expect(headHTML).toContain('https://cdn.example.com/custom-style.css');
		expect(headHTML).not.toContain(`${DEFAULT_CDN_URL}/@deot/style/dist/index.css`);
		expect(headHTML).toContain(`${DEFAULT_CDN_URL}/@deot/style/dist/index.normalize-only.css`);
		removePlaygroundStyleOverride('@deot/style/dist/index.css');
		wrapper.unmount();
	});

	it('merges site modules below instance imports and escapes unsafe style hrefs', () => {
		setPlaygroundSiteModules({
			'site-lib': 'https://cdn.example.com/site-lib.js',
			'vue': 'https://cdn.example.com/site-vue.js'
		});
		applyPlaygroundStyleOverride(
			'@deot/style/dist/index.css',
			'javascript:alert(1)'
		);
		applyPlaygroundStyleOverride(
			'custom.css',
			'https://cdn.example.com/x.css" onload="alert(1)'
		);
		const wrapper = mount(Playground, {
			props: {
				modelValue: '<template>site</template>',
				options: {
					builtinImportMap: {
						imports: { vue: '/vue.js' }
					}
				}
			}
		});
		const imports = store.options.builtinImportMap.value.imports;
		expect(imports['site-lib']).toBe('https://cdn.example.com/site-lib.js');
		expect(imports.vue).toBe('/vue.js');
		const headHTML = wrapper.findComponent({ name: 'Sandbox' }).props('previewOptions').headHTML;
		expect(headHTML).toContain(`${DEFAULT_CDN_URL}/@deot/style/dist/index.css`);
		expect(headHTML).not.toContain('javascript:alert');
		expect(headHTML).toContain('https://cdn.example.com/x.css&quot; onload=&quot;alert(1)');
		expect(headHTML).not.toContain('onload="alert');
		wrapper.unmount();
	});

	it('keeps the sandbox body theme in sync with the host document', async () => {
		document.body.setAttribute('data-doc-theme', 'dark');
		const wrapper = mount(Playground, {
			attachTo: document.body,
			props: { modelValue: '<template>theme</template>' }
		});
		await nextTick();
		await nextTick();
		const iframe = wrapper.find('iframe').element as HTMLIFrameElement;

		expect(iframe.contentDocument?.body.getAttribute('data-doc-theme')).toBe('dark');
		expect(iframe.contentDocument?.body.getAttribute('data-vc-theme')).toBe('dark');
		expect(iframe.contentDocument?.documentElement.getAttribute('data-vc-theme')).toBe('dark');
		expect(iframe.contentDocument?.documentElement.style.colorScheme).toBe('dark');

		document.body.setAttribute('data-doc-theme', 'light');
		document.body.setAttribute('data-vc-theme', 'light');
		await new Promise<void>(resolve => queueMicrotask(resolve));

		expect(iframe.contentDocument?.body.getAttribute('data-doc-theme')).toBe('light');
		expect(iframe.contentDocument?.body.getAttribute('data-vc-theme')).toBe('light');
		expect(iframe.contentDocument?.documentElement.getAttribute('data-vc-theme')).toBe('light');
		expect(iframe.contentDocument?.documentElement.style.colorScheme).toBe('light');
		document.body.removeAttribute('data-doc-theme');
		document.body.removeAttribute('data-vc-theme');
		await new Promise<void>(resolve => queueMicrotask(resolve));

		expect(iframe.contentDocument?.body.hasAttribute('data-doc-theme')).toBe(false);
		expect(iframe.contentDocument?.body.hasAttribute('data-vc-theme')).toBe(false);
		expect(iframe.contentDocument?.documentElement.hasAttribute('data-vc-theme')).toBe(false);
		expect(iframe.contentDocument?.documentElement.style.colorScheme).toBe('');
		wrapper.unmount();
	});

	it('uses the explicit locale across nested preview controls', () => {
		const wrapper = mount(Playground, {
			props: {
				locale: zhCN,
				modelValue: '<template>locale</template>'
			}
		});

		expect(wrapper.find('.clipboard').attributes('aria-label')).toBe('复制');
		expect(wrapper.find('.docs-playground__viewport-trigger').attributes('aria-label'))
			.toBe('视口：自适应');
		expect(wrapper.findAll('.docs-playground__viewport-option')[0].text()).toBe('自适应');
	});

	it('merges instance preview options and validates DocsLink bridge messages', async () => {
		const navigate = vi.fn();
		const wrapper = mount(Playground, {
			props: {
				modelValue: '<template>bridge</template>',
				onNavigate: navigate,
				previewOptions: {
					headHTML: '<meta name="instance-preview">',
					customCode: { importCode: 'const imported = true', useCode: 'void imported' }
				}
			}
		});
		await nextTick();
		const sandbox = wrapper.findComponent({ name: 'Sandbox' });
		const previewOptions = sandbox.props('previewOptions');
		expect(previewOptions.headHTML).toContain('instance-preview');
		expect(previewOptions.customCode.importCode).toContain('h as __docsH');
		expect(previewOptions.customCode.importCode).toContain('const imported = true');
		expect(previewOptions.customCode.useCode).toContain('app.component("DocsLink"');
		expect(previewOptions.customCode.useCode).toContain('void imported');

		window.dispatchEvent(new MessageEvent('message', {
			data: { action: 'docs:navigate', to: '/ignored' },
			source: window
		}));
		window.dispatchEvent(new MessageEvent('message', {
			data: { action: 'other', to: '/ignored' },
			source: wrapper.find('iframe').element.contentWindow
		}));
		expect(navigate).not.toHaveBeenCalled();

		window.dispatchEvent(new MessageEvent('message', {
			data: { action: 'docs:navigate', to: '/guide' },
			source: wrapper.find('iframe').element.contentWindow
		}));
		expect(navigate).toHaveBeenCalledWith('/guide');

		wrapper.unmount();
		window.dispatchEvent(new MessageEvent('message', {
			data: { action: 'docs:navigate', to: '/after-unmount' },
			source: window
		}));
		expect(navigate).toHaveBeenCalledTimes(1);
	});

	it('surfaces sandbox runtime errors in the playground chrome', async () => {
		const wrapper = mount(Playground, {
			attachTo: document.body,
			props: { modelValue: '<template>error</template>' }
		});
		await nextTick();
		expect(wrapper.find('.docs-playground__runtime-error').exists()).toBe(false);

		window.dispatchEvent(new MessageEvent('message', {
			data: {
				action: 'error',
				value: 'Failed to resolve module specifier "lodash". Relative references must start with "/", "./" or "../".'
			},
			source: wrapper.find('iframe').element.contentWindow
		}));
		await nextTick();
		expect(wrapper.find('.docs-playground__runtime-error').text())
			.toContain('Failed to resolve module specifier "lodash"');
		expect(wrapper.find('.docs-playground__runtime-error').text())
			.toContain('Import Map');
		expect(wrapper.find('.docs-playground__runtime-error').attributes('role')).toBe('alert');
		wrapper.unmount();
	});

	it('forwards runtime navigation in standard and styleless layouts', async () => {
		const standard = mount(Playground, { props: { modelValue: '<template />' } });
		standard.findComponent({ name: 'Runtime' }).vm.$emit('navigate', '/standard');
		expect(standard.emitted('navigate')).toEqual([['/standard']]);

		const styleless = mount(Playground, {
			props: { modelValue: '<template />', styleless: true }
		});
		styleless.findComponent({ name: 'Runtime' }).vm.$emit('navigate', '/styleless');
		expect(styleless.emitted('navigate')).toEqual([['/styleless']]);
	});

	it('switches the default responsive viewports without recreating the sandbox', async () => {
		const wrapper = mount(Playground, { props: { modelValue: '<template>viewport</template>' } });
		const viewport = wrapper.find('.docs-playground-runtime__viewport');
		const sandbox = wrapper.find('.sandbox').element;
		const options = wrapper.findAll('.docs-playground__viewport-option');

		expect(options.map(item => item.text())).toEqual(['Auto', '375px']);
		expect(viewport.attributes('style')).toContain('width: 100%');
		expect(wrapper.find('.docs-playground__viewport-trigger').attributes('aria-label'))
			.toBe('Viewport: Auto');

		await options[1].trigger('click');
		expect(wrapper.find('.docs-playground-runtime__viewport').attributes('style'))
			.toContain('width: 375px');
		expect(wrapper.find('.docs-playground-runtime__viewport').attributes('style'))
			.toContain('max-width: 100%');
		expect(wrapper.find('.docs-playground__viewport-trigger').classes()).toContain('is-active');
		expect(wrapper.emitted('update:viewport')).toEqual([[375]]);
		expect(wrapper.find('.sandbox').element).toBe(sandbox);
	});

	it('closes the viewport menu when external options hide it', async () => {
		const wrapper = mount(Playground, { props: { modelValue: '<template>viewport</template>' } });
		wrapper.findComponent({ name: 'Dropdown' }).vm.$emit('update:modelValue', true);
		await nextTick();
		expect(wrapper.find('.docs-playground__viewport-trigger').attributes('aria-expanded'))
			.toBe('true');

		await wrapper.setProps({ viewportOptions: [] });
		expect(wrapper.find('.docs-playground__viewport-trigger').exists()).toBe(false);

		await wrapper.setProps({ viewportOptions: ['auto', 375] });
		expect(wrapper.find('.docs-playground__viewport-trigger').attributes('aria-expanded'))
			.toBe('false');
	});

	it('supports fixed viewport height, external updates and an empty option list', async () => {
		const wrapper = mount(Playground, {
			props: {
				modelValue: '<template>fixed viewport</template>',
				viewport: [375, 667],
				viewportOptions: ['auto', [375, 667], 768]
			}
		});

		expect(wrapper.find('.docs-playground__preview').attributes('style'))
			.toContain('height: 687px');
		expect(wrapper.find('.docs-playground-runtime__viewport').attributes('style'))
			.toContain('width: 375px');
		expect(wrapper.findAll('.docs-playground__viewport-option').map(item => item.text()))
			.toEqual(['Auto', '375 × 667px', '768px']);
		expect(wrapper.find('.docs-playground__viewport-option[aria-checked="true"]').text())
			.toBe('375 × 667px');

		await wrapper.setProps({ viewport: 768 });
		expect(wrapper.find('.docs-playground__preview').attributes('style'))
			.toContain('height: 44px');
		expect(wrapper.find('.docs-playground-runtime__viewport').attributes('style'))
			.toContain('width: 768px');
		await wrapper.setProps({ viewport: undefined });
		expect(wrapper.find('.docs-playground-runtime__viewport').attributes('style'))
			.toContain('width: 100%');

		await wrapper.setProps({ viewport: 375, viewportOptions: [] });
		expect(wrapper.find('.docs-playground__viewport-menu').exists()).toBe(false);
		expect(wrapper.find('.docs-playground-runtime__viewport').attributes('style'))
			.toContain('width: 375px');

		await wrapper.setProps({ viewport: undefined, viewportOptions: ['auto', 768] });
		expect(wrapper.find('.docs-playground-runtime__viewport').attributes('style'))
			.toContain('width: 100%');
		await wrapper.setProps({ viewportOptions: [] });
		expect(wrapper.find('.docs-playground-runtime__viewport').attributes('style'))
			.toContain('width: 100%');
	});

	it('filters invalid direct viewport options and applies viewport sizing to styleless mode', () => {
		const normalized = mount(Playground, {
			props: {
				modelValue: '<template>normalized</template>',
				viewportOptions: [0, 'mobile', 375, 375]
			}
		});
		expect(normalized.find('.docs-playground__viewport-menu').exists()).toBe(false);
		expect(normalized.find('.docs-playground-runtime__viewport').attributes('style'))
			.toContain('width: 375px');

		const styleless = mount(Playground, {
			props: {
				modelValue: '<template>styleless</template>',
				styleless: true,
				viewport: [375, 667],
				viewportOptions: []
			}
		});
		expect(styleless.find('.docs-playground-runtime--styleless').attributes('style'))
			.toContain('height: 667px');
		expect(styleless.find('.docs-playground-runtime__viewport').attributes('style'))
			.toContain('width: 375px');
		expect(styleless.find('.docs-playground__viewport-menu').exists()).toBe(false);
	});

	it('is exported from the package entry', async () => {
		const entry = await import('../src');
		expect(entry.CodePreview).toBeDefined();
		expect(entry.Playground).toBe(Playground);
	});

	it('opens the editor and synchronizes multi-file actions', async () => {
		const wrapper = mount(Playground, {
			props: {
				files: { 'main.js': 'first', 'App.vue': '<template />' },
				entry: 'main.js',
				views: ['runtime', 'files']
			}
		});
		await wrapper.find('[data-action="edit"]').trigger('click');
		const options = popup.mock.calls[0][0];
		expect(options.files).toEqual({ 'main.js': 'first', 'App.vue': '<template />' });
		expect(options.entry).toBe('main.js');
		options.onActiveChange('App.vue');
		expect(store.setActive).toHaveBeenCalledWith('src/App.vue');

		options.onFilesChange(
			{ 'main.js': 'second', 'App.vue': '<template />' },
			'main.js',
			{ type: 'update', filename: 'main.js' }
		);
		expect(store.files['src/main.js'].code).toBe('second');
		expect(wrapper.emitted('update:modelValue')).toEqual([['second']]);
		expect(wrapper.emitted('change')).toEqual([['second']]);

		options.onFilesChange(
			{ 'main.js': 'second', 'App.vue': '<template />', 'util.ts': '' },
			'main.js',
			{ type: 'create', filename: 'util.ts' }
		);
		await nextTick();
		expect(store.addFile).toHaveBeenCalledWith(expect.objectContaining({ filename: 'src/util.ts' }));
		expect(wrapper.find('[data-filename="util.ts"]').classes()).toContain('is-active');

		options.onFilesChange(
			{ 'bootstrap.js': 'second', 'App.vue': '<template />', 'util.ts': '' },
			'bootstrap.js',
			{ type: 'rename', previousFilename: 'main.js', filename: 'bootstrap.js' }
		);
		await nextTick();
		expect(store.renameFile).toHaveBeenCalledWith('src/main.js', 'src/bootstrap.js');
		expect(wrapper.emitted('update:entry')).toEqual([['bootstrap.js']]);

		options.onFilesChange(
			{ 'bootstrap.js': 'second', 'App.vue': '<template />' },
			'bootstrap.js',
			{ type: 'delete', filename: 'util.ts' }
		);
		await nextTick();
		expect(store.files['src/util.ts']).toBeUndefined();
		expect(wrapper.find('[data-filename="bootstrap.js"]').classes()).toContain('is-active');
		expect(wrapper.emitted('update:files')?.at(-1)?.[0]).toEqual({
			'bootstrap.js': 'second',
			'App.vue': '<template />'
		});
	});

	it('changes entry and accepts external file updates', async () => {
		const wrapper = mount(Playground, {
			props: { files: { 'App.vue': 'app', 'main.js': 'main' }, entry: 'App.vue' }
		});
		await wrapper.find('[data-action="edit"]').trigger('click');
		const options = popup.mock.calls[0][0];
		options.onFilesChange(
			{ 'App.vue': 'app', 'main.js': 'main' },
			'main.js',
			{ type: 'entry', filename: 'main.js' }
		);
		expect(store.mainFile).toBe('src/main.js');
		expect(wrapper.emitted('update:entry')).toEqual([['main.js']]);

		await wrapper.setProps({ files: { 'App.vue': 'changed', 'child.ts': 'child' }, entry: 'App.vue' });
		await nextTick();
		expect(setFiles).toHaveBeenCalledWith({ 'App.vue': 'changed', 'child.ts': 'child' }, 'App.vue');

		await wrapper.setProps({ entry: 'child.ts' });
		await nextTick();
		expect(store.mainFile).toBe('src/child.ts');
		expect(store.setActive).toHaveBeenCalledWith('src/child.ts');

		await wrapper.setProps({ entry: 'missing.ts' });
		await nextTick();
		expect(wrapper.find('.docs-playground__error').text()).toContain('missing.ts');
	});

	it('synchronizes external single-file model changes', async () => {
		const wrapper = mount(Playground, { props: { modelValue: 'first' } });
		await wrapper.setProps({ modelValue: 'second' });
		await nextTick();
		expect(store.files['src/App.vue'].code).toBe('second');
	});

	it('supports a styleless sandbox and default template', () => {
		const wrapper = mount(Playground, { props: { styleless: true } });
		expect(wrapper.find('.docs-playground').exists()).toBe(false);
		expect(wrapper.find('.docs-playground-runtime--styleless').attributes('style'))
			.toContain('height: 24px');
		expect(wrapper.find('.docs-playground__header').exists()).toBe(false);
		expect(wrapper.find('.sandbox').exists()).toBe(true);
		expect(wrapper.findComponent({ name: 'Sandbox' }).props('autoStoreInit')).toBe(false);
		expect(store.options.template.value.welcomeSFC).toContain('<slot />');
	});

	it('supports runtime-only and files-only views', async () => {
		const runtime = mount(Playground, { props: { modelValue: '<template>runtime</template>' } });
		expect(runtime.find('.sandbox').exists()).toBe(true);
		expect(runtime.find('.docs-playground-files').exists()).toBe(false);
		expect(runtime.find('.docs-playground__views').exists()).toBe(false);
		expect(runtime.find('.docs-playground__preview').attributes('style'))
			.toContain('height: 44px');

		const fixedRuntime = mount(Playground, {
			attrs: { style: 'height: 200px' },
			props: { modelValue: '<template>fixed</template>' }
		});
		expect(fixedRuntime.attributes('style')).toContain('height: 200px');
		expect(fixedRuntime.find('.docs-playground__preview').attributes('style'))
			.toContain('height: 44px');

		const files = mount(Playground, {
			props: {
				files: {
					'App.vue': '<template><strong>files</strong></template>',
					'util.ts': 'export const value = 1'
				},
				entry: 'App.vue',
				views: ['files']
			}
		});
		expect(useStore).toHaveBeenCalledTimes(2);
		expect(files.find('.sandbox').exists()).toBe(false);
		expect(files.find('.docs-playground-files').exists()).toBe(true);
		expect(files.find('.docs-playground__header').exists()).toBe(false);
		expect(files.find('.docs-playground__tools').exists()).toBe(false);
		expect(files.find('.docs-code-preview__copy').attributes('aria-label')).toBe('Copy current file');
		expect(files.find('code.hljs').html()).toContain('hljs-tag');
		expect(files.find('code.hljs').html()).not.toContain('<strong>files</strong>');
		expect(files.find('pre').element.childNodes).toHaveLength(1);
		await files.find('[data-filename="util.ts"]').trigger('click');
		expect(files.find('[data-filename="util.ts"]').classes()).toContain('is-active');
		expect(files.find('code.hljs').text()).toContain('export const value');
	});

	it('orders views, lazily creates the sandbox and retains it after switching', async () => {
		const wrapper = mount(Playground, {
			props: {
				files: { 'App.vue': '<template>app</template>' },
				entry: 'App.vue',
				views: ['files', 'runtime']
			}
		});
		expect(useStore).not.toHaveBeenCalled();
		const buttons = wrapper.findAll('.docs-playground__view');
		expect(buttons.map(item => item.attributes('aria-label'))).toEqual(['File preview', 'Runtime preview']);
		expect(buttons[0].classes()).toContain('is-active');
		expect(wrapper.find('.sandbox').exists()).toBe(false);
		expect(wrapper.find('.docs-playground__header').exists()).toBe(false);
		expect(wrapper.find('.docs-playground-files__actions').exists()).toBe(true);

		await buttons[1].trigger('click');
		expect(useStore).toHaveBeenCalledTimes(1);
		expect(wrapper.find('.sandbox').exists()).toBe(true);
		expect(wrapper.find('.docs-playground__header').exists()).toBe(true);
		expect(wrapper.find('.docs-playground__header').element.lastElementChild?.classList)
			.toContain('docs-playground__views');
		await buttons[0].trigger('click');
		expect(wrapper.find('.sandbox').exists()).toBe(true);
		expect(wrapper.find('.docs-playground__preview').isVisible()).toBe(false);
	});

	it('normalizes and reacts to external views', async () => {
		const wrapper = mount(Playground, {
			props: {
				files: { 'App.vue': '<template>app</template>' },
				views: ['invalid', 'files', 'files']
			}
		});
		expect(wrapper.find('.docs-playground-files').isVisible()).toBe(true);
		expect(wrapper.find('.docs-playground__views').exists()).toBe(false);

		await wrapper.setProps({ views: [] });
		await nextTick();
		expect(wrapper.find('.sandbox').exists()).toBe(true);
		expect(wrapper.find('.docs-playground-files').exists()).toBe(false);
	});

	it('destroys a removed runtime and recreates it only when selected', async () => {
		const wrapper = mount(Playground, {
			props: {
				files: { 'App.vue': '<template>app</template>' },
				views: ['runtime', 'files']
			}
		});
		expect(wrapper.find('.sandbox').exists()).toBe(true);

		await wrapper.setProps({ views: ['files'] });
		expect(wrapper.find('.sandbox').exists()).toBe(false);

		await wrapper.setProps({ views: ['files', 'runtime'] });
		expect(wrapper.find('.sandbox').exists()).toBe(false);
		await wrapper.findAll('.docs-playground__view')[1].trigger('click');
		expect(wrapper.find('.sandbox').exists()).toBe(true);
	});

	it('shows an invalid explicit entry', () => {
		const wrapper = mount(Playground, {
			props: { files: { 'App.vue': 'app' }, entry: 'missing.js' }
		});
		expect(wrapper.find('.docs-playground__error').text()).toContain('missing.js');
	});
});
