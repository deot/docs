// @vitest-environment jsdom

import { enableAutoUnmount, mount } from '@vue/test-utils';
import { reactive } from 'vue';
import type { LocationQuery } from 'vue-router';
import { encode } from '@deot/helper-unicode';
import PreviewConfigGenerate from '../src/pages/preview-config-generate/index.vue';
import { readPreviewConfig } from '../src/modules/preview/config';

const { route: state } = vi.hoisted(() => ({ route: { query: {} as LocationQuery } }));
const route = reactive(state);
enableAutoUnmount(afterEach);
vi.mock('vue-router', () => ({ useRoute: () => route }));
vi.mock('@deot/vc', async () => ({
	Select: (await import('vue')).defineComponent({
		name: 'Select', props: ['modelValue', 'data', 'nullValue'],
		emits: ['update:modelValue'],
		setup: () => () => <div />
	}),
	Clipboard: (await import('vue')).defineComponent({
		name: 'Clipboard', props: ['value', 'tag'],
		setup: (_, { attrs, slots }) => () => <button {...attrs}>{slots.default?.()}</button>
	})
}));

const config = {
	url: 'https://example.com/主题.vue?name=中文#preview',
	styles: ['/a.css?fonts=a,b'],
	modules: { lodash: 'https://example.com/lodash.js' },
	playground: { local: true, viewport: 375 },
	lang: 'en-US'
};

describe('preview configuration generator', () => {
	beforeEach(() => {
		route.query = {};
		window.$docs = { locales: { 'zh-CN': { label: '中文' }, 'en-US': { label: 'English' } }, routes: {} };
	});

	it('fills raw query values and regenerates the copy and preview links live', async () => {
		route.query = { raw: encode(JSON.stringify(config)) };
		const wrapper = mount(PreviewConfigGenerate);
		expect((wrapper.find('#preview-url').element as HTMLInputElement).value).toBe(config.url);
		expect(JSON.parse((wrapper.find('#preview-playground').element as HTMLTextAreaElement).value)).toEqual(config.playground);
		await wrapper.find('#preview-url').setValue('https://example.com/next.vue');
		const href = (wrapper.find('#preview-link').element as HTMLTextAreaElement).value;
		expect(new URL(href).pathname).toBe('/__docs/preview');
		const raw = new URL(href).searchParams.get('raw')!;
		expect(readPreviewConfig({ raw })).toEqual({ ...config, url: 'https://example.com/next.vue' });
		expect(wrapper.findComponent({ name: 'Clipboard' }).props('value')).toBe(href);
		expect(wrapper.find('a[target="_blank"]').attributes('href')).toBe(href);
		await wrapper.find('#preview-modules').setValue('[]');
		expect(wrapper.find('[role="alert"]').text()).toContain('modules');
		expect((wrapper.find('#preview-link').element as HTMLTextAreaElement).value).toBe('');
		expect(wrapper.findComponent({ name: 'Clipboard' }).attributes('disabled')).toBeDefined();
	});

	it('parses a pasted legacy link and encoded link while retaining edits on malformed input', async () => {
		const wrapper = mount(PreviewConfigGenerate);
		await wrapper.find('#preview-import').setValue('/__docs/preview?url=demo.vue&styles=%2Fa.css%3Ffonts%3Da%2Cb&styles=%2Fb.css');
		await wrapper.find('.docs-preview-config-generate__import button').trigger('click');
		expect(JSON.parse((wrapper.find('#preview-styles').element as HTMLTextAreaElement).value)).toEqual(['/a.css?fonts=a,b', '/b.css']);
		await wrapper.find('#preview-import').setValue(`/__docs/preview?${new URLSearchParams({ raw: encode(JSON.stringify(config)) })}`);
		await wrapper.find('.docs-preview-config-generate__import button').trigger('click');
		expect((wrapper.find('#preview-url').element as HTMLInputElement).value).toBe(config.url);
		await wrapper.find('#preview-import').setValue('/__docs/preview?raw=broken');
		await wrapper.find('.docs-preview-config-generate__import button').trigger('click');
		expect(wrapper.find('[role="alert"]').exists()).toBe(true);
		expect((wrapper.find('#preview-url').element as HTMLInputElement).value).toBe(config.url);
	});
});
