import { createApp, h } from 'vue';
import type { App, DirectiveBinding } from 'vue';
import type { Language } from '@deot/docs-locale';
import type { PlaygroundFiles } from '@deot/docs-playground';
import { Markdown } from './markdown';
import type { MarkdownPlaygroundConfig, MarkdownPlaygroundMountProps } from './types';

const mountedApps = new WeakMap<HTMLElement, App[]>();
const renderVersions = new WeakMap<HTMLElement, number>();
let playgroundModule: Promise<typeof import('@deot/docs-playground')> | undefined;
const loadPlayground = () => (
	playgroundModule ||= import('@deot/docs-playground')
);

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
}

const render = async (el: HTMLElement, binding: DirectiveBinding<MarkdownDirectiveValue>) => {
	cleanup(el);
	const version = (renderVersions.get(el) || 0) + 1;
	renderVersions.set(el, version);
	el.innerHTML = binding.value.source ? Markdown.render(binding.value.source) : '';

	const apps: App[] = [];
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
		|| binding.value.locale !== binding.oldValue?.locale) void render(el, binding);
};

export const vMarkdown = {
	mounted: (el: HTMLElement, binding: DirectiveBinding<MarkdownDirectiveValue>) => void render(el, binding),
	updated: update,
	beforeUnmount: (el: HTMLElement) => {
		renderVersions.set(el, (renderVersions.get(el) || 0) + 1);
		cleanup(el);
	}
};
