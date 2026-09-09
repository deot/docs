import { createApp, h } from 'vue';
import type { App, DirectiveBinding } from 'vue';
import type { Language } from '@deot/docs-locale';
import type { PlaygroundFiles } from '@deot/docs-playground';
import { Markdown } from './markdown';
import {
	createHistoryTabQueryAdapter
} from './tab-query';
import type { MarkdownTabQueryAdapter } from './tab-query';
import TabsNav from './tabs-nav.vue';
import type { MarkdownPlaygroundConfig, MarkdownPlaygroundMountProps } from './types';

const mountedApps = new WeakMap<HTMLElement, App[]>();
const renderVersions = new WeakMap<HTMLElement, number>();
let playgroundModule: Promise<typeof import('@deot/docs-playground')> | undefined;
const loadPlayground = () => (
	playgroundModule ||= import('@deot/docs-playground')
);
const defaultTabQuery = createHistoryTabQueryAdapter();

const cleanup = (el: HTMLElement) => {
	for (const app of mountedApps.get(el) || []) app.unmount();
	mountedApps.delete(el);
};

const resolveBlockLanguage = (block: Element) => {
	const languageClass = [...block.classList].find(className =>
		className.startsWith('language-')
	);
	return languageClass?.slice('language-'.length) || '';
};

interface MarkdownDirectiveValue {
	source?: string;
	locale: Language;
	/**
	 * 站点级 Playground 默认 props；块级 JSON5 会覆盖。
	 */
	playground?: MarkdownPlaygroundConfig;
	/**
	 * `?tab=` 读写适配器；缺省时用 history.replaceState。
	 */
	tabQuery?: MarkdownTabQueryAdapter;
}

const serializePlaygroundDefaults = (value?: MarkdownPlaygroundConfig) => (
	JSON.stringify(value || {})
);

const mountTabs = (
	el: HTMLElement,
	apps: App[],
	locale: Language,
	adapter: MarkdownTabQueryAdapter
) => {
	const label = locale.markdown?.tabs?.label || 'Tabs';
	el.querySelectorAll<HTMLElement>('[data-tabs]').forEach((root, index) => {
		const nav = root.querySelector<HTMLElement>('[data-tabs-nav]');
		if (!nav) return;
		const panels = [...root.querySelectorAll<HTMLElement>('.docs-markdown-tabs__panel')];
		const items = panels.map(panel => ({
			id: panel.dataset.tab || '',
			title: panel.dataset.tabTitle || panel.dataset.tab || ''
		})).filter(item => item.id && item.title);
		if (!items.length) return;
		const groupId = `docs-markdown-tabs-${index}`;
		const app = createApp({
			render: () => h(TabsNav, {
				items,
				label,
				adapter,
				root,
				groupId
			})
		});
		app.mount(nav);
		apps.push(app);
	});
};

const render = async (el: HTMLElement, binding: DirectiveBinding<MarkdownDirectiveValue>) => {
	cleanup(el);
	const version = (renderVersions.get(el) || 0) + 1;
	renderVersions.set(el, version);
	el.innerHTML = binding.value.source ? Markdown.render(binding.value.source) : '';

	const apps: App[] = [];
	const adapter = binding.value.tabQuery || defaultTabQuery;
	mountTabs(el, apps, binding.value.locale, adapter);

	const blocks = el.querySelectorAll('pre code');
	const playgrounds = el.querySelectorAll<HTMLElement>('div[data-playground]');
	if (!blocks.length && !playgrounds.length) {
		mountedApps.set(el, apps);
		return;
	}
	const DocsPlayground = await loadPlayground();
	if (renderVersions.get(el) !== version) return;
	blocks.forEach((block) => {
		const pre = block.parentElement;
		if (!pre) return;
		const mountPoint = document.createElement('div');
		mountPoint.className = 'docs-markdown-code-preview';
		pre.replaceWith(mountPoint);
		const app = createApp(() => h(DocsPlayground.CodePreview, {
			code: block.textContent || '',
			language: resolveBlockLanguage(block),
			locale: binding.value.locale
		}));
		app.mount(mountPoint);
		apps.push(app);
	});

	const sitePlaygroundDefaults = binding.value.playground && typeof binding.value.playground === 'object'
		? binding.value.playground
		: {};
	playgrounds.forEach((item) => {
		const code = item.dataset.code;
		let files: PlaygroundFiles | undefined;
		let propsData: MarkdownPlaygroundConfig = {};
		try {
			propsData = JSON.parse(item.dataset.props || '{}') as MarkdownPlaygroundConfig;
		} catch { /* 忽略无效的属性配置 */ }
		try {
			files = item.dataset.files ? JSON.parse(item.dataset.files) as PlaygroundFiles : undefined;
		} catch { /* 忽略无效的文件配置 */ }
		const runtimeProps: MarkdownPlaygroundMountProps = files
			? { files, entry: item.dataset.entry }
			: { modelValue: code };
		const app = createApp(() => h(DocsPlayground.Playground, {
			...sitePlaygroundDefaults,
			...(typeof propsData === 'object' ? propsData : {}),
			...runtimeProps,
			locale: binding.value.locale
		}));
		app.mount(item);
		apps.push(app);
	});

	mountedApps.set(el, apps);
};

const update = (el: HTMLElement, binding: DirectiveBinding<MarkdownDirectiveValue>) => {
	if (binding.value.source !== binding.oldValue?.source
		|| binding.value.locale !== binding.oldValue?.locale
		|| binding.value.tabQuery !== binding.oldValue?.tabQuery
		|| serializePlaygroundDefaults(binding.value.playground)
		!== serializePlaygroundDefaults(binding.oldValue?.playground)
	) {
		void render(el, binding);
	}
};

export const vMarkdown = {
	mounted: (el: HTMLElement, binding: DirectiveBinding<MarkdownDirectiveValue>) => void render(el, binding),
	updated: update,
	beforeUnmount: (el: HTMLElement) => {
		renderVersions.set(el, (renderVersions.get(el) || 0) + 1);
		cleanup(el);
	}
};
