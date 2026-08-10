import { createApp, h } from 'vue';
import type { App, DirectiveBinding } from 'vue';
import { Markdown } from './markdown';

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

const render = async (el: HTMLElement, binding: DirectiveBinding<string | undefined>) => {
	cleanup(el);
	const version = (renderVersions.get(el) || 0) + 1;
	renderVersions.set(el, version);
	el.innerHTML = binding.value ? Markdown.render(binding.value) : '';

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
			language: resolveBlockLanguage(block)
		}));
		app.mount(mountPoint);
		apps.push(app);
	});

	playgrounds.forEach((item) => {
		const code = item.dataset.code;
		let files;
		let propsData = {};
		try {
			propsData = JSON.parse(item.dataset.props || '{}');
		} catch { /* 忽略无效的属性配置 */ }
		try {
			files = item.dataset.files ? JSON.parse(item.dataset.files) : undefined;
		} catch { /* 忽略无效的文件配置 */ }
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
	if (binding.value !== binding.oldValue) void render(el, binding);
};

export const vMarkdown = {
	mounted: (el: HTMLElement, binding: DirectiveBinding<string | undefined>) => void render(el, binding),
	updated: update,
	beforeUnmount: (el: HTMLElement) => {
		renderVersions.set(el, (renderVersions.get(el) || 0) + 1);
		cleanup(el);
	}
};
