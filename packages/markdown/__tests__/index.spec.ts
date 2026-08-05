// @vitest-environment jsdom

import { defineComponent, h, nextTick } from 'vue';
import { mount } from '@vue/test-utils';
import { Markdown as MarkdownRenderer } from '../src/markdown';
import { Markdown } from '../src';

const { codePreviewUnmounted, playgroundUnmounted } = vi.hoisted(() => ({
	codePreviewUnmounted: vi.fn(),
	playgroundUnmounted: vi.fn()
}));

const runtimeWithConfig = (config: string, body: string) => [
	':::RUNTIME',
	'<!--',
	'<config lang="json5">',
	config,
	'</config>',
	'-->',
	body,
	':::'
].join('\n');

vi.mock('@deot/vc', () => ({
	Clipboard: defineComponent({
		name: 'Clipboard',
		props: ['value'],
		template: '<button class="clipboard"><slot /></button>'
	})
}));

vi.mock('@deot/docs-playground', async () => {
	const { default: RealCodePreview } = await import('../../playground/src/core/code-preview/code-preview.vue');
	return {
		CodePreview: defineComponent({
			props: ['code', 'filename', 'language', 'copyLabel'],
			unmounted: codePreviewUnmounted,
			setup(props, { attrs }) {
				return () => h(RealCodePreview, { ...attrs, ...props });
			}
		}),
		Playground: defineComponent({
			props: [
				'modelValue',
				'theme',
				'files',
				'entry',
				'views',
				'viewport',
				'viewportOptions'
			],
			unmounted: playgroundUnmounted,
			setup(props) {
				return () => h('div', { class: 'playground' }, [
					h('span', [
						props.modelValue || '',
						'-',
						props.entry || '',
						'-',
						JSON.stringify(props.files || {}),
						'-',
						props.theme || '',
						'-',
						JSON.stringify(props.views || []),
						'-',
						JSON.stringify(props.viewport),
						'-',
						JSON.stringify(props.viewportOptions)
					]),
					h('pre', { class: 'playground-code' }, [
						h('code', { class: 'hljs language-js' }, 'runtime preview')
					])
				]);
			}
		})
	};
});

describe('markdown', () => {
	beforeEach(() => {
		codePreviewUnmounted.mockReset();
		playgroundUnmounted.mockReset();
	});

	afterEach(() => {
		document.body.innerHTML = '';
		document.getElementById('docs-code-preview-style')?.remove();
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

	it('keeps an unnamed single-file RUNTIME block', () => {
		const html = MarkdownRenderer.render(runtimeWithConfig(
			'{ views: [\'runtime\'] }',
			'```vue\n<template>ok</template>\n```'
		));

		expect(html).toContain('data-playground');
		expect(html).toContain('data-code="&lt;template&gt;ok&lt;/template&gt;');
		expect(html).toContain('data-props="{&quot;views&quot;:[&quot;runtime&quot;]}"');
		expect(html).not.toContain('data-files=');
		expect(html).not.toContain('<config');
	});

	it('collects named fences into one multi-file playground', () => {
		const source = runtimeWithConfig(
			'{ entry: \'main.js\', views: [\'files\'] }',
			[
				'```js main.js',
				'import App from "./App.vue";',
				'```',
				'```vue App.vue',
				'<template>multi</template>',
				'```'
			].join('\n')
		);
		const html = MarkdownRenderer.render(source);

		expect(html.match(/data-playground/g)).toHaveLength(1);
		expect(html).toContain('data-entry="main.js"');
		expect(html).toContain('&quot;main.js&quot;');
		expect(html).toContain('&quot;App.vue&quot;');
		expect(html).not.toContain('<pre>');
	});

	it('renders the wrapper, playgrounds and shared code previews', async () => {
		const source = [
			'# Hello',
			'',
			runtimeWithConfig(
				'{ views: [\'runtime\'] }',
				'```vue\n<template>demo</template>\n```'
			),
			'',
			'```js',
			'\tconst n = 1',
			'```'
		].join('\n');
		const wrapper = mount(Markdown, { props: { modelValue: source }, attachTo: document.body });
		await nextTick();

		expect(wrapper.find('h1').text()).toContain('Hello');
		expect(document.querySelector('.playground')?.textContent).toContain('<template>demo</template>');
		expect(document.querySelector('.playground')?.textContent).toContain('["runtime"]');
		expect(wrapper.find('.docs-code-preview code').classes()).toContain('hljs');
		expect(wrapper.find('.docs-code-preview code').html()).toContain('hljs-keyword');
		expect(wrapper.find('.docs-code-preview__copy').exists()).toBe(true);
		expect(wrapper.find('.docs-code-preview__language').text()).toBe('js');
		expect(wrapper.find('.docs-code-preview code').text()).toMatch(/const\s+n\s+=\s+1/);
		expect(wrapper.findAll('.docs-code-preview')).toHaveLength(1);
		expect(wrapper.findAll('.docs-markdown-code-preview')).toHaveLength(1);
		expect(wrapper.find('.playground .playground-code').exists()).toBe(true);
		expect(wrapper.find('.playground .docs-code-preview').exists()).toBe(false);
	});

	it('passes Vue, JavaScript and unnamed fences to shared code previews', async () => {
		const source = [
			'```vue',
			'<template />',
			'```',
			'',
			'```js',
			'const value = 1',
			'```',
			'',
			'```',
			'plain',
			'```'
		].join('\n');
		const wrapper = mount(Markdown, { props: { modelValue: source } });
		await nextTick();

		expect(wrapper.findAll('.docs-code-preview')).toHaveLength(3);
		expect(wrapper.findAll('.docs-code-preview__language').map(item => item.text())).toEqual(['vue', 'js']);
		expect(wrapper.findAll('.docs-code-preview code')[0].html()).toContain('hljs-tag');
		expect(wrapper.findAll('.docs-code-preview code')[1].html()).toContain('hljs-keyword');
		expect(wrapper.findAll('.docs-code-preview code')[2].text()).toBe('plain');
		expect(document.querySelectorAll('#docs-code-preview-style')).toHaveLength(1);
	});

	it('cleans up mounted previews when source changes and the wrapper unmounts', async () => {
		const source = (language: string, value: number) => [
			':::RUNTIME',
			'```vue',
			`<template>${value}</template>`,
			'```',
			':::',
			'',
			`\`\`\`${language}`,
			`const value = ${value}`,
			'```'
		].join('\n');
		const wrapper = mount(Markdown, { props: { modelValue: source('js', 1) } });
		await nextTick();
		expect(wrapper.findAll('.docs-code-preview')).toHaveLength(1);
		expect(wrapper.findAll('.playground')).toHaveLength(1);
		const previewElement = wrapper.find('.docs-code-preview').element;

		await wrapper.setProps({ value: 'unrelated' });
		await nextTick();
		expect(wrapper.find('.docs-code-preview').element).toBe(previewElement);
		expect(codePreviewUnmounted).not.toHaveBeenCalled();
		expect(playgroundUnmounted).not.toHaveBeenCalled();

		await wrapper.setProps({ modelValue: source('ts', 2) });
		await nextTick();
		expect(wrapper.findAll('.docs-code-preview')).toHaveLength(1);
		expect(wrapper.findAll('.playground')).toHaveLength(1);
		expect(wrapper.find('.docs-code-preview__language').text()).toBe('ts');
		expect(codePreviewUnmounted).toHaveBeenCalledTimes(1);
		expect(playgroundUnmounted).toHaveBeenCalledTimes(1);

		wrapper.unmount();
		expect(codePreviewUnmounted).toHaveBeenCalledTimes(2);
		expect(playgroundUnmounted).toHaveBeenCalledTimes(2);
	});

	it('mounts multi-file props through the directive', async () => {
		const source = runtimeWithConfig(
			'{ entry: \'App.vue\', views: [\'files\', \'runtime\'] }',
			[
				'```vue App.vue',
				'<template>app</template>',
				'```',
				'```ts util.ts',
				'export const value = 1',
				'```'
			].join('\n')
		);
		mount(Markdown, { props: { modelValue: source }, attachTo: document.body });
		await nextTick();

		const text = document.querySelector('.playground')?.textContent || '';
		expect(text).toContain('-App.vue-');
		expect(text).toContain('"App.vue":"<template>app</template>\\n"');
		expect(text).toContain('"util.ts":"export const value = 1\\n"');
		expect(text).toContain('["files","runtime"]');
	});

	it.each([
		[['runtime'], '["runtime"]'],
		[['files'], '["files"]'],
		[['files', 'runtime'], '["files","runtime"]'],
		[['runtime', 'files'], '["runtime","files"]']
	])('passes RUNTIME views %j to Playground', async (views, expected) => {
		const source = runtimeWithConfig(
			`{ views: ${JSON.stringify(views)} }`,
			'```vue\n<template />\n```'
		);
		const wrapper = mount(Markdown, { props: { modelValue: source }, attachTo: document.body });
		await nextTick();
		expect(wrapper.find('.playground').text()).toContain(expected);
	});

	it('passes RUNTIME viewport props to Playground', async () => {
		const source = runtimeWithConfig(
			`{
				viewport: [375, 667],
				viewportOptions: ['auto', 375, [375, 667], 768],
			}`,
			'```vue\n<template />\n```'
		);
		const wrapper = mount(Markdown, { props: { modelValue: source }, attachTo: document.body });
		await nextTick();

		const text = wrapper.find('.playground').text();
		expect(text).toContain('[375,667]');
		expect(text).toContain('["auto",375,[375,667],768]');
	});

	it('ignores inline RUNTIME props on the opening line', () => {
		const html = MarkdownRenderer.render([
			':::RUNTIME { "views": ["files"], "entry": "missing.js" }',
			'```vue',
			'<template />',
			'```',
			':::'
		].join('\n'));

		expect(html).toContain('data-playground');
		expect(html).toContain('data-props="{}"');
		expect(html).not.toContain('files');
	});

	it('ignores plain HTML comments without a json5 config', () => {
		const html = MarkdownRenderer.render([
			':::RUNTIME',
			'<!-- note only -->',
			'```vue',
			'<template />',
			'```',
			':::'
		].join('\n'));

		expect(html).toContain('data-playground');
		expect(html).toContain('data-props="{}"');
	});

	it('reports invalid multi-file declarations', () => {
		const missingName = MarkdownRenderer.render(':::RUNTIME\n```vue App.vue\n<template />\n```\n```ts\ncode\n```\n:::');
		const duplicateName = MarkdownRenderer.render(':::RUNTIME\n```vue App.vue\na\n```\n```vue App.vue\nb\n```\n:::');
		const missingEntry = MarkdownRenderer.render(runtimeWithConfig(
			'{ entry: \'main.js\' }',
			'```vue App.vue\na\n```'
		));

		expect(missingName).toContain('每个代码块都必须声明文件名');
		expect(duplicateName).toContain('文件名 App.vue 重复');
		expect(missingEntry).toContain('入口文件 main.js 不存在');
	});

	it('reports invalid RUNTIME views', () => {
		const render = (config: string) => MarkdownRenderer.render(
			runtimeWithConfig(config, '```vue\n<template />\n```')
		);

		expect(render('{ views: [] }')).toContain('views 必须是非空数组');
		expect(render('{ views: \'runtime\' }')).toContain('views 必须是非空数组');
		expect(render('{ views: [\'unknown\'] }')).toContain('views 不支持 unknown');
		expect(render('{ views: [\'runtime\', \'runtime\'] }')).toContain('views 不能重复声明 runtime');
		expect(render('{ view: \'files\' }')).toContain('不支持 view 参数');
	});

	it('reports invalid RUNTIME viewport declarations', () => {
		const render = (config: string) => MarkdownRenderer.render(
			runtimeWithConfig(config, '```vue\n<template />\n```')
		);

		expect(render('{ viewport: \'mobile\' }')).toContain('viewport 必须是 auto、正数宽度或 [宽,高]');
		expect(render('{ viewport: 0 }')).toContain('viewport 必须是 auto、正数宽度或 [宽,高]');
		expect(render('{ viewport: [375] }')).toContain('viewport 必须是 auto、正数宽度或 [宽,高]');
		expect(render('{ viewportOptions: \'auto\' }')).toContain('viewportOptions 必须是数组');
		expect(render('{ viewportOptions: [\'auto\', 0] }'))
			.toContain('viewportOptions[1] 必须是 auto、正数宽度或 [宽,高]');
		expect(render('{ viewportOptions: [\'auto\', \'auto\'] }'))
			.toContain('viewportOptions 不能重复声明 auto');
		expect(render('{ viewportOptions: [] }')).toContain('data-playground');
	});

	it('supports empty input, malformed config and multiple markdown instances', async () => {
		const malformed = mount(Markdown, {
			props: {
				value: runtimeWithConfig('{ views: [', '```vue\ndemo\n```')
			},
			attachTo: document.body
		});
		mount(Markdown, {
			props: { value: ':::RUNTIME\n```vue\nsecond\n```\n:::' },
			attachTo: document.body
		});
		await nextTick();
		expect(document.querySelectorAll('.playground')).toHaveLength(2);
		expect(document.body.innerHTML).toContain('data-props="{}"');

		await malformed.setProps({ value: '' });
		expect(malformed.find('.docs-markdown-reset').text()).toBe('');
	});
});
