// @vitest-environment jsdom

import { defineComponent, nextTick } from 'vue';
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
	Playground: defineComponent({
		props: ['modelValue', 'theme'],
		template: '<div class="playground">{{ modelValue }}-{{ theme }}</div>'
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

	it('turns a RUNTIME fence into a playground placeholder', () => {
		const html = MarkdownRenderer.render(':::RUNTIME {"theme":"dark"}\n```vue\n<template>ok</template>\n```\n:::');

		expect(html).toContain('id="PG-1"');
		expect(html).toContain('data-code="&lt;template&gt;ok&lt;/template&gt;');
		expect(html).toContain('data-props="{&quot;theme&quot;:&quot;dark&quot;}"');
	});

	it('renders the wrapper, playgrounds, highlighting and clipboard controls', async () => {
		const source = '# Hello\n\n:::RUNTIME {"theme":"dark"}\n```vue\n<template>demo</template>\n```\n:::\n\n```js\n\tconst n = 1\n```';
		const wrapper = mount(Markdown, { props: { modelValue: source }, attachTo: document.body });
		await nextTick();

		expect(wrapper.find('h1').text()).toContain('Hello');
		expect(document.querySelector('.playground')?.textContent).toMatch(/<template>demo<\/template>\s+-dark/);
		expect(wrapper.find('code').classes()).toContain('hljs');
		expect(wrapper.find('.clipboard').exists()).toBe(true);
		expect(wrapper.find('code').text()).toMatch(/const\s+n\s+=\s+1/);
	});

	it('supports value, empty input and malformed playground props', async () => {
		const wrapper = mount(Markdown, {
			props: { value: ':::RUNTIME not-json\n```vue\ndemo\n```\n:::' },
			attachTo: document.body
		});
		await nextTick();
		expect(document.querySelector('.playground')?.textContent).toMatch(/demo\s+-/);

		await wrapper.setProps({ value: '' });
		expect(wrapper.find('.docs-markdown-reset').text()).toBe('');
	});

	it('uses empty props for a runtime block without configuration', async () => {
		mount(Markdown, {
			props: { value: ':::RUNTIME\n```vue\ndemo\n```\n:::' },
			attachTo: document.body
		});
		await nextTick();
		expect(document.querySelector('.playground')?.textContent).toMatch(/demo\s+-/);
	});
});
