import { createApp, h } from 'vue';
import type { App, DirectiveBinding } from 'vue';
import * as DocsPlayground from '@deot/docs-playground';
import { Markdown } from './markdown';

const mountedApps = new WeakMap<HTMLElement, App[]>();

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

const render = (el: HTMLElement, binding: DirectiveBinding<string | undefined>) => {
	cleanup(el);
	el.innerHTML = binding.value ? Markdown.render(binding.value) : '';

	const apps: App[] = [];
	const blocks = el.querySelectorAll('pre code');
	blocks.forEach((block) => {
		const pre = block.parentElement;
		if (!pre) return;
		const mountPoint = document.createElement('div');
		mountPoint.className = 'docs-markdown-code-preview';
		pre.replaceWith(mountPoint);
		const app = createApp(() => h(DocsPlayground.CodePreview, {
			code: block.textContent || '',
			language: resolveBlockLanguage(block)
		}));
		app.mount(mountPoint);
		apps.push(app);
	});

	const playgrounds = el.querySelectorAll<HTMLElement>('div[data-playground]');
	playgrounds.forEach((item) => {
		const code = item.dataset.code;
		let files;
		let propsData = {};
		try {
			propsData = JSON.parse(item.dataset.props || '{}');
		} catch { /* empty */ }
		try {
			files = item.dataset.files ? JSON.parse(item.dataset.files) : undefined;
		} catch { /* empty */ }
		const runtimeProps = files
			? { files, entry: item.dataset.entry }
			: { modelValue: code };
		const app = createApp(() => h(DocsPlayground.Playground, {
			...(typeof propsData === 'object' ? propsData : {}),
			...runtimeProps
		}));
		app.mount(item);
		apps.push(app);
	});

	mountedApps.set(el, apps);
};

const update = (el: HTMLElement, binding: DirectiveBinding<string | undefined>) => {
	if (binding.value !== binding.oldValue) render(el, binding);
};

export const vMarkdown = {
	mounted: render,
	updated: update,
	beforeUnmount: cleanup
};
