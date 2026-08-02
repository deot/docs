// @vitest-environment jsdom

import { defineComponent } from 'vue';
import { mount } from '@vue/test-utils';
import CodePreview from '../src/core/code-preview/code-preview.vue';
import { CODE_PREVIEW_STYLE_ID } from '../src/core/code-preview/style';

vi.mock('@deot/vc', () => ({
	Clipboard: defineComponent({
		name: 'Clipboard',
		props: ['value'],
		template: '<button class="clipboard"><slot /></button>'
	})
}));

describe('CodePreview', () => {
	beforeEach(() => {
		document.getElementById(CODE_PREVIEW_STYLE_ID)?.remove();
	});

	afterEach(() => {
		document.body.innerHTML = '';
		document.getElementById(CODE_PREVIEW_STYLE_ID)?.remove();
	});

	it('uses an explicit language before the filename extension', () => {
		const wrapper = mount(CodePreview, {
			props: {
				code: '<template><strong>Vue</strong></template>',
				filename: 'main.js',
				language: 'vue',
				copyLabel: '复制示例'
			}
		});

		expect(wrapper.find('.docs-code-preview__language').text()).toBe('vue');
		expect(wrapper.find('code.hljs').html()).toContain('hljs-tag');
		expect(wrapper.find('.clipboard').attributes('aria-label')).toBe('复制示例');
		expect(wrapper.find('.clipboard').attributes('title')).toBe('复制示例');
	});

	it('installs the shared highlight and preview styles only once', () => {
		const first = mount(CodePreview, { props: { code: 'const first = 1', language: 'js' } });
		const second = mount(CodePreview, { props: { code: 'const second = 2', language: 'js' } });
		const style = document.getElementById(CODE_PREVIEW_STYLE_ID);

		expect(style).not.toBeNull();
		expect(document.querySelectorAll(`#${CODE_PREVIEW_STYLE_ID}`)).toHaveLength(1);

		first.unmount();
		second.unmount();
	});

	it('reacts to source and filename changes', async () => {
		const wrapper = mount(CodePreview, {
			props: { code: 'const value = 1', filename: 'main.js' }
		});
		expect(wrapper.find('.docs-code-preview__language').text()).toBe('js');
		expect(wrapper.find('code.hljs').html()).toContain('hljs-keyword');

		await wrapper.setProps({ code: 'export const value: number = 2', filename: 'main.ts' });
		expect(wrapper.find('.docs-code-preview__language').text()).toBe('ts');
		expect(wrapper.find('code.hljs').text()).toContain('value: number');
	});

	it('safely renders an unnamed plaintext block', () => {
		const wrapper = mount(CodePreview, { props: { code: '<script>alert(1)</script>' } });
		expect(wrapper.find('.docs-code-preview__language').exists()).toBe(false);
		expect(wrapper.find('code.hljs').html()).toContain('&lt;script&gt;');
		expect(wrapper.find('code.hljs').html()).not.toContain('<script>');
		expect(wrapper.find('pre').element.childNodes).toHaveLength(1);
	});
});
