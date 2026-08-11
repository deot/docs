// @vitest-environment jsdom

import { computed, defineComponent, h, ref } from 'vue';
import type { App } from 'vue';
import { mount } from '@vue/test-utils';
import {
	buildTranslator,
	buildLocaleContext,
	createLocale,
	enUS,
	provideLocale,
	resolveLocale,
	useLocale,
	zhCN
} from '../src';
import type { Language } from '../src';

describe('docs locale', () => {
	it('translates namespaced keys and preserves missing placeholders', () => {
		const t = buildTranslator(enUS);
		expect(t('client.database.records', { count: 2 })).toBe('2 records');
		expect(t('client.database.records')).toBe('{count} records');
		expect(t('client.missing')).toBe('client.missing');
		expect(t('client.search')).toBe('client.search');
		expect(t('client.search.placeholder.extra')).toBe('client.search.placeholder.extra');
		expect(t('invalid.path' as any)).toBe('invalid.path');
	});

	it('normalizes aliases, merges overrides and falls back to English', () => {
		const locale = resolveLocale('ZH_cn', {
			'zh-CN': { label: '中文', client: { search: { placeholder: '查找' } } }
		});
		expect(locale.name).toBe('zh-CN');
		expect(locale.client.search.placeholder).toBe('查找');
		expect(locale.playground.editor.createFile).toBe(zhCN.playground.editor.createFile);
		expect(resolveLocale('zh-TW').name).toBe('en-US');
		expect(resolveLocale('missing').client.search.placeholder).toBe(enUS.client.search.placeholder);
		expect(resolveLocale('en').name).toBe('en-US');
		expect(resolveLocale('zh', {
			'zh-CN': { label: '中文', client: { search: { placeholder: '短别名覆盖' } } }
		}).client.search.placeholder).toBe('短别名覆盖');
		expect(resolveLocale('en-US', {
			en: { label: 'English', client: { search: { placeholder: 'Alias override' } } }
		}).client.search.placeholder).toBe('Alias override');
		expect(resolveLocale('fr-FR', {
			'fr-FR': { label: 'Français', client: { common: { close: 'Fermer' } } }
		}).client.common.close).toBe('Fermer');
	});

	it('creates immutable custom locales', () => {
		const source = { client: { common: { close: 'Fermer' } } };
		const locale = createLocale('fr_FR', source);
		expect(locale.name).toBe('fr-FR');
		expect(locale.client.common.close).toBe('Fermer');
		expect(locale.client.common.loading).toBe(enUS.client.common.loading);
		expect(source).toEqual({ client: { common: { close: 'Fermer' } } });
		expect(createLocale('en').client.common.close).toBe('Close');
		const context = buildLocaleContext(enUS);
		expect(context.lang.value).toBe('en-US');
		expect(context.t('markdown.indicator.document')).toBe('Document');
		const app = { provide: vi.fn() } as unknown as App;
		const provided = provideLocale(zhCN, app);
		expect(app.provide).toHaveBeenCalled();
		expect(provided.value).toEqual(zhCN);
	});

	it('supports provider, reactive updates, override and English fallback', async () => {
		const current = ref<Language>(enUS);
		const Child = defineComponent({
			props: { override: Object },
			setup: props => () => {
				const { t } = useLocale(computed(() => props.override as any));
				return h('span', t('client.search.placeholder'));
			}
		});
		const Parent = defineComponent({
			setup() {
				provideLocale(current);
				return () => h(Child);
			}
		});
		const wrapper = mount(Parent);
		expect(wrapper.text()).toBe('Search docs');
		current.value = zhCN;
		await wrapper.vm.$nextTick();
		expect(wrapper.text()).toBe('搜索文档');
		expect(mount(Child, { props: { override: zhCN } }).text()).toBe('搜索文档');
		expect(mount(Child).text()).toBe('Search docs');
	});
});
