// @vitest-environment jsdom

import { defineComponent, h, nextTick } from 'vue';
import { mount } from '@vue/test-utils';
import { Markdown as MarkdownRenderer } from '../src/markdown';
import { Markdown } from '../src';

vi.mock('@deot/vc', () => ({
	Clipboard: defineComponent({
		props: ['value'],
		template: '<button class="clipboard"><slot /></button>'
	})
}));

vi.mock('@deot/docs-playground', () => ({
	registerVueHighlight: vi.fn(),
	Playground: defineComponent({
		props: ['modelValue', 'theme', 'files', 'entry', 'views'],
		setup(props) {
			return () => h('div', { class: 'playground' }, [
				props.modelValue || '',
				'-',
				props.entry || '',
				'-',
				JSON.stringify(props.files || {}),
				'-',
				props.theme || '',
				'-',
				JSON.stringify(props.views || [])
			]);
		}
	})
}));

describe('markdown', () => {
	afterEach(() => {
		document.body.innerHTML = '';
	});

	it('renders markdown features and adds the md marker', () => {
		const html = MarkdownRenderer.render([
			'# Title',
			'',
			'https://example.com',
			'',
			'::: TIP',
			'help',
			':::',
			'',
			'```ts',
			'const value = 1',
			'```'
		].join('\n'));

		expect(html).toContain('class="header-anchor"');
		expect(html).toContain('href="https://example.com"');
		expect(html).toContain('class="TIP"');
		expect(html).toContain('md=""');
		expect(html).toContain('<code class="language-ts">');
	});

	it('keeps an unnamed single-file RUNTIME block backward compatible', () => {
		const html = MarkdownRenderer.render(':::RUNTIME {"theme":"dark"}\n```vue\n<template>ok</template>\n```\n:::');

		expect(html).toContain('data-playground');
		expect(html).toContain('data-code="&lt;template&gt;ok&lt;/template&gt;');
		expect(html).toContain('data-props="{&quot;theme&quot;:&quot;dark&quot;}"');
		expect(html).not.toContain('data-files=');
	});

	it('collects named fences into one multi-file playground', () => {
		const source = [
			':::RUNTIME {"entry":"main.js","theme":"dark"}',
			'```js main.js',
			'import App from "./App.vue";',
			'```',
			'```vue App.vue',
			'<template>multi</template>',
			'```',
			':::'
		].join('\n');
		const html = MarkdownRenderer.render(source);

		expect(html.match(/data-playground/g)).toHaveLength(1);
		expect(html).toContain('data-entry="main.js"');
		expect(html).toContain('&quot;main.js&quot;');
		expect(html).toContain('&quot;App.vue&quot;');
		expect(html).not.toContain('<pre>');
	});

	it('renders the wrapper, playgrounds, highlighting and clipboard controls', async () => {
		const source = '# Hello\n\n:::RUNTIME {"theme":"dark"}\n```vue\n<template>demo</template>\n```\n:::\n\n```js\n\tconst n = 1\n```';
		const wrapper = mount(Markdown, { props: { modelValue: source }, attachTo: document.body });
		await nextTick();

		expect(wrapper.find('h1').text()).toContain('Hello');
		expect(document.querySelector('.playground')?.textContent).toMatch(/<template>demo<\/template>.*dark/s);
		expect(wrapper.find('code').classes()).toContain('hljs');
		expect(wrapper.find('.clipboard').exists()).toBe(true);
		expect(wrapper.find('code').text()).toMatch(/const\s+n\s+=\s+1/);
	});

	it('mounts multi-file props through the directive', async () => {
		const source = [
			':::RUNTIME {"entry":"App.vue","theme":"dark","views":["files","runtime"]}',
			'```vue App.vue',
			'<template>app</template>',
			'```',
			'```ts util.ts',
			'export const value = 1',
			'```',
			':::'
		].join('\n');
		mount(Markdown, { props: { modelValue: source }, attachTo: document.body });
		await nextTick();

		const text = document.querySelector('.playground')?.textContent || '';
		expect(text).toContain('-App.vue-');
		expect(text).toContain('"App.vue":"<template>app</template>\\n"');
		expect(text).toContain('"util.ts":"export const value = 1\\n"');
		expect(text).toContain('-dark');
		expect(text).toContain('["files","runtime"]');
	});

	it.each([
		[['runtime'], '["runtime"]'],
		[['files'], '["files"]'],
		[['files', 'runtime'], '["files","runtime"]'],
		[['runtime', 'files'], '["runtime","files"]']
	])('passes RUNTIME views %j to Playground', async (views, expected) => {
		const source = `:::RUNTIME ${JSON.stringify({ views })}\n\`\`\`vue\n<template />\n\`\`\`\n:::`;
		const wrapper = mount(Markdown, { props: { modelValue: source }, attachTo: document.body });
		await nextTick();
		expect(wrapper.find('.playground').text()).toContain(expected);
	});

	it('reports invalid multi-file declarations', () => {
		const missingName = MarkdownRenderer.render(':::RUNTIME\n```vue App.vue\n<template />\n```\n```ts\ncode\n```\n:::');
		const duplicateName = MarkdownRenderer.render(':::RUNTIME\n```vue App.vue\na\n```\n```vue App.vue\nb\n```\n:::');
		const missingEntry = MarkdownRenderer.render(':::RUNTIME {"entry":"main.js"}\n```vue App.vue\na\n```\n:::');

		expect(missingName).toContain('每个代码块都必须声明文件名');
		expect(duplicateName).toContain('文件名 App.vue 重复');
		expect(missingEntry).toContain('入口文件 main.js 不存在');
	});

	it('reports invalid RUNTIME views', () => {
		const render = (props: Record<string, unknown>) => MarkdownRenderer.render(
			`:::RUNTIME ${JSON.stringify(props)}\n\`\`\`vue\n<template />\n\`\`\`\n:::`
		);

		expect(render({ views: [] })).toContain('views 必须是非空数组');
		expect(render({ views: 'runtime' })).toContain('views 必须是非空数组');
		expect(render({ views: ['unknown'] })).toContain('views 不支持 unknown');
		expect(render({ views: ['runtime', 'runtime'] })).toContain('views 不能重复声明 runtime');
		expect(render({ view: 'files' })).toContain('不支持 view 参数');
	});

	it('supports empty input, malformed props and multiple markdown instances', async () => {
		const malformed = mount(Markdown, {
			props: { value: ':::RUNTIME not-json\n```vue\ndemo\n```\n:::' },
			attachTo: document.body
		});
		mount(Markdown, {
			props: { value: ':::RUNTIME\n```vue\nsecond\n```\n:::' },
			attachTo: document.body
		});
		await nextTick();
		expect(document.querySelectorAll('.playground')).toHaveLength(2);

		await malformed.setProps({ value: '' });
		expect(malformed.find('.docs-markdown-reset').text()).toBe('');
	});
});
