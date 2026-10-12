// @vitest-environment jsdom

import { enableAutoUnmount, mount } from '@vue/test-utils';
import { reactive } from 'vue';
import type { LocationQuery } from 'vue-router';
import { encode } from '@deot/helper-unicode';
import RawEditor from '../src/pages/raw-editor/index.vue';
import { createRawUrl, readRaw } from '../src/modules/preview/raw';

const { state } = vi.hoisted(() => ({ state: { query: {} as LocationQuery } }));
const route = reactive(state);
enableAutoUnmount(afterEach);
vi.mock('vue-router', () => ({ useRoute: () => route }));
vi.mock('../src/pages/raw-editor/components/json-editor.vue', async () => ({
	default: (await import('vue')).defineComponent({
		props: ['modelValue'], emits: ['update:modelValue'],
		setup: (props, { emit }) => () => (
			<textarea
				value={props.modelValue}
				onInput={event => emit('update:modelValue', (event.target as HTMLTextAreaElement).value)}
			/>
		)
	})
}));
vi.mock('@deot/vc', async () => {
	const { defineComponent } = await import('vue');
	return {
		Clipboard: defineComponent({
			name: 'Clipboard', props: ['value', 'tag'], setup: (_, { attrs, slots }) => () => <button {...attrs}>{slots.default?.()}</button>
		}),
		Scroller: defineComponent({ setup: (_, { slots }) => () => <div>{slots.default?.()}</div> })
	};
});

describe('raw editor', () => {
	beforeEach(() => {
		route.query = {};
		window.$docs = { locales: { 'zh-CN': { label: '中文' } }, routes: {} };
	});
	it.each([{ arbitrary: ['中文', 1, false] }, ['数组'], null, 12, '文字'])('accepts arbitrary JSON %j and preserves target query and hash', (value) => {
		const url = new URL(createRawUrl(value, '/tools?keep=a%26b&raw=old#result', 'https://docs.test/site/'));
		expect(readRaw(url.searchParams.get('raw')!)).toEqual(value);
		expect(url.pathname).toBe('/tools');
		expect(url.searchParams.get('keep')).toBe('a&b');
		expect(url.searchParams.getAll('raw')).toHaveLength(1);
		expect(url.hash).toBe('#result');
	});
	it('fills raw input and regenerates links live without PreviewConfig restrictions', async () => {
		route.query = { raw: encode(JSON.stringify({ custom: '中文' })), target: '__docs/markdown-editor?keep=1#title' };
		const wrapper = mount(RawEditor);
		expect(JSON.parse((wrapper.find('textarea').element as HTMLTextAreaElement).value)).toEqual({ custom: '中文' });
		await wrapper.find('textarea').setValue('[1, "next"]');
		const href = wrapper.find('#raw-link').text();
		expect(new URL(href).pathname).toBe('/__docs/markdown-editor');
		expect(readRaw(new URL(href).searchParams.get('raw')!)).toEqual([1, 'next']);
		expect(wrapper.findComponent({ name: 'Clipboard' }).props('value')).toBe(href);
		await wrapper.find('textarea').setValue('{ broken');
		expect(wrapper.find('[role="alert"]').exists()).toBe(true);
		expect(wrapper.find('#raw-link').text()).toBe('');
		expect(wrapper.find('a[target="_blank"]').exists()).toBe(false);
		expect(wrapper.findComponent({ name: 'Clipboard' }).attributes('disabled')).toBeDefined();
	});
	it('parses legacy links and retains edits on malformed raw input', async () => {
		const wrapper = mount(RawEditor);
		await wrapper.find('#raw-import').setValue('/__docs/preview?url=demo.vue&styles=%2Fa.css%3Ffonts%3Da%2Cb&styles=%2Fb.css');
		await wrapper.find('.docs-raw-editor__import button').trigger('click');
		const getValue = () => JSON.parse((wrapper.find('textarea').element as HTMLTextAreaElement).value);
		expect(getValue().styles).toEqual(['/a.css?fonts=a,b', '/b.css']);
		await wrapper.find('#raw-import').setValue('/__docs/preview?raw=broken');
		await wrapper.find('.docs-raw-editor__import button').trigger('click');
		expect(wrapper.find('[role="alert"]').exists()).toBe(true);
		expect(getValue().url).toBe('demo.vue');
		await wrapper.find('#raw-target').setValue('javascript:alert(1)');
		expect(wrapper.find('#raw-link').text()).toBe('');
	});
});
