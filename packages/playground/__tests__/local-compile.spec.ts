// @vitest-environment jsdom
import { defineComponent, h, nextTick } from 'vue';
import { mount } from '@vue/test-utils';
import { compilePlayground } from '../src/core/runtime/local/compile';
import { injectStyle, removeStyle } from '../src/core/runtime/local/compile/css';
import { compileLocalScss } from '../src/core/runtime/local/compile/scss';
import { transformScript } from '../src/core/runtime/local/compile/script';
import {
	createFileIndex,
	dirname,
	getCommonRoot,
	isInsideRoot,
	normalizeVirtualPath,
	resolveModulePath
} from '../src/core/runtime/local/compile/files';
import { linkPlayground } from '../src/core/runtime/local/linker';
import type { PlaygroundFiles } from '../src/types';

const mountLinked = async (files: PlaygroundFiles, entry = 'App.vue') => {
	const compiled = await compilePlayground(files, entry);
	expect(compiled.errors, compiled.errors.join('\n')).toEqual([]);
	const linked = linkPlayground(compiled, files);
	expect(linked.errors, linked.errors.join('\n')).toEqual([]);
	expect(linked.component).toBeTruthy();
	return { compiled, linked };
};

describe('local playground compile', () => {
	it('compiles the same files map and keeps vue imports on the host runtime', async () => {
		const files: PlaygroundFiles = {
			'App.vue': `<template><p>{{ count }}</p></template>
<script setup>
import { ref } from 'vue'
import { label } from './label'
const count = ref(label)
</script>`,
			'label.ts': 'export const label = 7;\n'
		};
		const { linked } = await mountLinked(files);
		const wrapper = mount(defineComponent({
			setup() {
				return () => h(linked.component as never);
			}
		}));
		expect(wrapper.text()).toBe('7');
		wrapper.unmount();
	});

	it('captures createApp().mount without replacing the host app', async () => {
		const files: PlaygroundFiles = {
			'main.js': `import { createApp } from 'vue';
import App from './App.vue';
createApp(App).mount('#app');`,
			'App.vue': '<template><strong>captured</strong></template>'
		};
		const { linked } = await mountLinked(files, 'main.js');
		const wrapper = mount(defineComponent({
			setup() {
				return () => h(linked.component as never);
			}
		}));
		expect(wrapper.text()).toBe('captured');
		expect(document.getElementById('app')).toBeNull();
		wrapper.unmount();
	});

	it('keeps plain style blocks in the injected css', async () => {
		const files: PlaygroundFiles = {
			'App.vue': `<template><p class="local-result">x</p></template>
<style>
.local-result { color: #123456; }
</style>`
		};
		const { compiled } = await mountLinked(files);
		expect(compiled.css.join('\n')).toContain('#123456');
	});

	it('compiles scss from the same files without injecting bem', async () => {
		const files: PlaygroundFiles = {
			'App.vue': `<template><p class="scss-box">SCSS</p></template>
<style lang="scss">
@use './variables' as *;
.scss-box { color: $accent; }
</style>`,
			'_variables.scss': '$accent: #c2410c;\n'
		};
		const { compiled } = await mountLinked(files);
		const css = compiled.css.join('\n');
		expect(css).toContain('c2410c');
		expect(css).not.toContain('@mixin block');
		expect(css).not.toContain('@deot/style');
	});

	it('reports empty files, missing entries and unsupported sources', async () => {
		const empty = await compilePlayground({});
		expect(empty.errors[0]).toContain('files 为空');
		const missing = await compilePlayground({ 'App.vue': '<template />' }, 'Missing.vue');
		expect(missing.errors[0]).toContain('entry 不在 files');
		const ignored = await compilePlayground({
			'import-map.json': '{}',
			'App.vue': '<template />'
		}, 'import-map.json');
		expect(ignored.errors[0]).toContain('entry 不能是');
		const jsx = await compilePlayground({
			'App.vue': '<script lang="tsx"></script><template />'
		});
		expect(jsx.errors.join('\n')).toContain('JSX/TSX');
		const external = await compilePlayground({
			'readme.md': '# hi'
		}, 'readme.md');
		expect(external.errors.join('\n')).toContain('不支持的文件类型');
		const src = await compilePlayground({
			'App.vue': '<script src="./main.js"></script><template />',
			'main.js': 'export default {}'
		});
		expect(src.errors.join('\n')).toContain('不支持 <script src>');
		const less = await compilePlayground({
			'App.vue': '<template />\n<style lang="less">a{}</style>'
		});
		expect(less.errors.join('\n')).toContain('lang="less"');
		const brokenScss = await compilePlayground({
			'theme.scss': '$accent: ;\n'
		}, 'theme.scss');
		expect(brokenScss.errors.join('\n')).toContain('Expected expression');
		const brokenJson = await compilePlayground({
			'data.json': '{,'
		}, 'data.json');
		expect(brokenJson.errors.join('\n')).toContain('JSON');
	});

	it('links css, json and import.meta through the same files', async () => {
		const files: PlaygroundFiles = {
			'App.vue': `<template><p>{{ title }} {{ mode }}</p></template>
<script setup>
import { title } from './data.json'
import { mode } from './env'
import './extra.css'
</script>
<style scoped>
p { color: navy; }
</style>`,
			'data.json': '{ "title": "Hello" }\n',
			'env.ts': 'export const mode = import.meta.env.MODE\n',
			'extra.css': '.extra { color: red; }\n'
		};
		const { compiled, linked } = await mountLinked(files);
		expect(compiled.css.join('\n')).toContain('navy');
		expect(compiled.css.join('\n')).toContain('.extra');
		const wrapper = mount(defineComponent({
			setup() {
				return () => h(linked.component as never);
			}
		}));
		expect(wrapper.text()).toContain('Hello');
		expect(wrapper.text()).toContain('development');
		wrapper.unmount();
	});

	it('rejects missing relative and bare modules', async () => {
		const files: PlaygroundFiles = {
			'App.vue': `<script setup>
import Missing from './missing.vue'
</script>
<template><Missing /></template>`
		};
		const compiled = await compilePlayground(files);
		const linked = linkPlayground(compiled, files);
		expect(linked.errors.join('\n')).toContain('无法解析相对模块');
		const source = `<script setup>
import { x } from 'not-registered'
</script>
<template>{{ x }}</template>`;
		const bare = await compilePlayground({ 'App.vue': source });
		const bareLinked = linkPlayground(bare, { 'App.vue': source });
		expect(bareLinked.errors.join('\n')).toContain('未注册的模块');
		expect(normalizeVirtualPath('a/../b')).toBe('/b');
		expect(normalizeVirtualPath('a/../../b')).toBe('/b');
		expect(dirname('/a/b')).toBe('/a');
		expect(dirname('/file')).toBe('/');
		expect(getCommonRoot(['/only.vue'])).toBe('/');
		expect(normalizeVirtualPath('')).toBe('/');
		expect(getCommonRoot([])).toBe('/');
		expect(getCommonRoot(['/demo/App.vue', '/demo/list/index.vue'])).toBe('/demo');
		expect(getCommonRoot(['/App.vue', '/Child.vue'])).toBe('/');
		expect(isInsideRoot('/demo/App.vue', '/demo')).toBe(true);
		expect(isInsideRoot('/other.vue', '/demo')).toBe(false);
		expect(isInsideRoot('/App.vue', '/')).toBe(true);
		const index = createFileIndex({ 'Child.vue': '<template />', 'list/index.ts': 'export {}' });
		expect(resolveModulePath('/App.vue', './list', index)).toBe('/list/index.ts');
		expect(resolveModulePath('/App.vue', 'vue', index)).toBeNull();
		const broken = await compilePlayground({ 'bad.ts': 'const value: =' }, 'bad.ts');
		expect(broken.errors.join('\n')).toContain('脚本转换失败');
		const options = await compilePlayground({
			'App.vue': `<script>
export default { data: () => ({ label: 'option' }) }
</script>
<template><p>{{ label }}</p></template>
<style lang="scss">
$broken: ;
</style>`
		});
		expect(options.errors.join('\n')).toContain('SCSS');
		expect(options.modules['/App.vue']?.js).toContain('option');
		const jsxFile = await compilePlayground({ 'App.jsx': 'export default {}' }, 'App.jsx');
		expect(jsxFile.errors.join('\n')).toContain('JSX/TSX');
		const cycleFiles: PlaygroundFiles = {
			'a.js': `import { b } from './b.js'\nexport const a = b\n`,
			'b.js': `import { a } from './a.js'\nexport const b = a || 2\n`,
			'App.vue': `<script setup>
import { b } from './b.js'
</script>
<template><p>{{ b }}</p></template>`
		};
		const cycled = await compilePlayground(cycleFiles, 'App.vue');
		const cycleLinked = linkPlayground(cycled, cycleFiles);
		expect(cycleLinked.component || cycleLinked.errors.length).toBeTruthy();
		expect(linkPlayground({
			entry: '',
			modules: {},
			css: [],
			errors: ['already']
		}, {}).component).toBeNull();
		const standalone = await compilePlayground({
			'theme.scss': '.box { color: red; }\n'
		}, 'theme.scss');
		expect(standalone.errors).toEqual([]);
		expect(standalone.css.join('\n')).toContain('red');
		const indented = await compilePlayground({
			'theme.sass': '.box\n  color: blue\n'
		}, 'theme.sass');
		expect(indented.css.join('\n')).toContain('blue');
		const onlyIgnored = await compilePlayground({
			'import-map.json': '{}',
			'tsconfig.json': '{}'
		});
		expect(onlyIgnored.errors.join('\n')).toContain('files 为空');
		expect(transformScript('export const ready = true\n', 'ready.ts')).toContain('ready');
		expect(transformScript('export const ready = true\n', 'ready.js', { typescript: true })).toContain('ready');
		expect(transformScript('export const ready = true\n', 'ready.js', { typescript: false })).toContain('ready');
		const missingModule = linkPlayground({
			entry: '/App.vue',
			modules: {},
			css: [],
			errors: []
		}, { 'App.vue': '<template />' });
		expect(missingModule.errors.join('\n')).toContain('缺少编译模块');
		const brokenTemplate = await compilePlayground({
			'App.vue': '<script>\nexport default {}\n</script>\n<template><div></template>'
		});
		expect(brokenTemplate.errors.join('\n').length).toBeGreaterThan(0);
		const brokenStyle = await compilePlayground({
			'App.vue': '<template><p></p></template>\n<style>\na { color: ;\n</style>'
		});
		expect(brokenStyle.errors.join('\n')).toContain('Unclosed block');
		expect(injectStyle('docs-local-test', [])).toBeNull();
		const style = injectStyle('docs-local-test', ['.box{color:red}']);
		expect(style?.textContent).toContain('red');
		injectStyle('docs-local-test', ['.box{color:blue}']);
		removeStyle('docs-local-test');
		removeStyle('docs-local-missing');
		expect(document.querySelector('style[data-playground-id="docs-local-test"]')).toBeNull();
		expect(compileLocalScss('.a{color:red}', 'a.scss', null as unknown as PlaygroundFiles)).toContain('red');
		expect(compileLocalScss('.a{color:red}', 'a.scss', { 'sub\\a.scss': '.b{}' })).toContain('red');
	});
});

describe('local preview port', () => {
	it('forwards height and navigate messages through the bridge iframe', async () => {
		const { installLocalBridge, LocalPreviewPort } = await import('../src/core/runtime/local/port');
		const iframe = document.createElement('iframe');
		document.body.appendChild(iframe);
		installLocalBridge(iframe);
		const port = new LocalPreviewPort(iframe);
		const outbound: unknown[] = [];
		const onWindow = (event: MessageEvent) => {
			outbound.push(event.data);
		};
		window.addEventListener('message', onWindow);
		port.parent.postMessage({ action: 'docs:navigate', to: '/markdown' });

		const inbound = new Promise<MessageEvent>((resolve) => {
			port.addEventListener('message', resolve);
		});
		iframe.contentWindow?.postMessage({ action: 'docs:height:applied', accepted: true }, '*');
		const reply = await inbound;
		await nextTick();
		expect(reply.data).toMatchObject({ action: 'docs:height:applied', accepted: true });
		expect(reply.source).toBe(port.parent);
		const onPageHide = () => {};
		port.addEventListener('pagehide', onPageHide);
		port.removeEventListener('pagehide', onPageHide);
		const onPortMessage = () => {};
		port.addEventListener('message', onPortMessage);
		port.removeEventListener('message', onPortMessage);
		Object.defineProperty(iframe, 'clientHeight', { configurable: true, get: () => 48 });
		if (iframe.contentWindow) {
			Object.defineProperty(iframe.contentWindow, 'innerHeight', {
				configurable: true,
				get: () => 0
			});
		}
		expect(port.innerHeight).toBe(48);
		expect(port.contentWindow).toBe(iframe.contentWindow);
		const frame = port.requestAnimationFrame(() => {});
		port.cancelAnimationFrame(frame);
		const timer = port.setTimeout(() => {}, 1000);
		port.clearTimeout(timer as number);
		await vi.waitFor(() => {
			expect(outbound).toContainEqual({ action: 'docs:navigate', to: '/markdown' });
		});
		window.removeEventListener('message', onWindow);
		iframe.remove();
	});
});
