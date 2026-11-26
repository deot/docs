import { createApp, h, nextTick } from 'vue';
import type { App, DirectiveBinding } from 'vue';
import type { Language } from '@deot/docs-locale';
import type { PlaygroundFiles } from '@deot/docs-playground';
import { Markdown } from './markdown';
import {
	createHistoryTabQueryAdapter
} from './tab-query';
import type { MarkdownTabQueryAdapter } from './tab-query';
import TabsNav from './tabs-nav.vue';
import {
	getDocsCheck,
	markCheckRendered,
	registerCheckEntries,
	removeCheckEntries,
	waitForCheckedPreview
} from './check';
import type { DocsCheckEntry } from './check';
import { resolvePlaygroundProps } from './playground-props';
import { collectPlaygroundDefaultsWarnings } from './playground-warnings';
import type { MarkdownPlaygroundConfig, MarkdownPlaygroundDefaults, MarkdownPlaygroundMountProps } from './types';

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
	removeCheckEntries(el);
};

const parseSourceLine = (value: string | undefined) => {
	const line = Number(value);
	return Number.isInteger(line) && line > 0 ? line : undefined;
};

const resolveBlockLanguage = (block: Element) => {
	const languageClass = [...block.classList].find(className =>
		className.startsWith('language-')
	);
	return languageClass?.slice('language-'.length) || '';
};

interface MarkdownDirectiveValue {
	onRendered?: (source: string, sourceLines: number[]) => void;
	source?: string;
	locale: Language;
	/**
	 * 站点级 Playground 默认 props；块级 JSON5 会覆盖。`mobileDefaults` 只作用于 mobile 块。
	 */
	playground?: MarkdownPlaygroundDefaults;
	/**
	 * `?tab=` 读写适配器；缺省时用 history.replaceState。
	 */
	tabQuery?: MarkdownTabQueryAdapter;
	/**
	 * 在示例上方显示配置警告。警告总会输出到 `console.warn`。
	 */
	showPlaygroundWarnings?: boolean;
}

/** 已经输出过警告的站点默认值，避免每次渲染重复提示。 */
const warnedPlaygroundDefaults = new Set<string>();

const warnPlaygroundDefaults = (defaults: object) => {
	const key = JSON.stringify(defaults);
	if (warnedPlaygroundDefaults.has(key)) return;
	warnedPlaygroundDefaults.add(key);
	for (const message of collectPlaygroundDefaultsWarnings(defaults as Record<string, unknown>)) {
		console.warn(`PLAYGROUND: ${message}`);
	}
};

const parseWarnings = (value: string | undefined): string[] => {
	if (!value) return [];
	try {
		const parsed: unknown = JSON.parse(value);
		return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
	} catch {
		return [];
	}
};

/**
 * 输出单个示例的配置警告。
 * @param item 示例挂载点。
 * @param title 示例标题，便于在控制台里定位。
 * @param show 是否同时在示例上方显示。
 */
const reportPlaygroundWarnings = (item: HTMLElement, title: string | undefined, show: boolean) => {
	const warnings = parseWarnings(item.dataset.warnings);
	if (!warnings.length) return;
	const line = item.dataset.sourceLine ? Number(item.dataset.sourceLine) : undefined;
	for (const message of warnings) console.warn(`PLAYGROUND: ${message}`, { title, line });
	if (!show) return;
	const notice = document.createElement('div');
	notice.className = 'docs-playground-warning';
	notice.setAttribute('role', 'note');
	notice.textContent = warnings.map(message => `PLAYGROUND: ${message}`).join('\n');
	item.before(notice);
};

const serializePlaygroundDefaults = (value?: MarkdownPlaygroundDefaults) => (
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
	const env = {};
	const tokens = Markdown.parse(binding.value.source || '', env);
	el.innerHTML = Markdown.renderer.render(tokens, Markdown.options, env);
	const sourceLines = tokens.filter(token => token.level === 0 && token.map && !token.hidden && token.nesting !== -1)
		.flatMap((token) => {
			const line = token.map![0] + 1;
			if (token.type !== 'html_block') return [line];
			const template = document.createElement('template');
			template.innerHTML = token.content;
			return [...template.content.children].map(() => line);
		});

	const apps: App[] = [];
	mountedApps.set(el, apps);
	const adapter = binding.value.tabQuery || defaultTabQuery;
	mountTabs(el, apps, binding.value.locale, adapter);

	const blocks = el.querySelectorAll('pre code');
	const playgrounds = el.querySelectorAll<HTMLElement>('div[data-playground]');
	const check = getDocsCheck();
	const checkEntries: DocsCheckEntry[] = check
		? [...el.querySelectorAll<HTMLElement>('.docs-playground-error')].map(element => ({
				element,
				title: '',
				line: parseSourceLine(element.dataset.sourceLine),
				local: true,
				warnings: [],
				error: element.textContent?.trim() || ''
			}))
		: [];
	if (!blocks.length && !playgrounds.length) {
		await nextTick();
		if (renderVersions.get(el) !== version) return;
		if (check) {
			registerCheckEntries(el, checkEntries);
			markCheckRendered();
		}
		binding.value.onRendered?.(binding.value.source || '', sourceLines);
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
	if (playgrounds.length) warnPlaygroundDefaults(sitePlaygroundDefaults);
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
		reportPlaygroundWarnings(item, propsData?.title, !!binding.value.showPlaygroundWarnings);
		const runtimeProps: MarkdownPlaygroundMountProps = files
			? { files, entry: item.dataset.entry }
			: { modelValue: code };
		const playgroundProps = resolvePlaygroundProps(sitePlaygroundDefaults, propsData);
		const createPlayground = (overrides: Record<string, unknown> = {}) => createApp(() => h(DocsPlayground.Playground, {
			...playgroundProps,
			...overrides,
			...runtimeProps,
			locale: binding.value.locale
		}));
		if (!check) {
			const app = createPlayground();
			app.mount(item);
			apps.push(app);
			return;
		}
		// 检查模式：登记示例，由检查脚本逐个挂载。
		const declaredLocal = playgroundProps.local !== false;
		checkEntries.push({
			element: item,
			title: typeof propsData.title === 'string' ? propsData.title : '',
			line: parseSourceLine(item.dataset.sourceLine),
			local: declaredLocal,
			warnings: parseWarnings(item.dataset.warnings),
			mount: async (options) => {
				const local = options.local ?? declaredLocal;
				// views: ['files'] 的示例也要跑一次运行时。
				const app = createPlayground({ local, views: ['runtime'] });
				app.mount(item);
				try {
					return await waitForCheckedPreview(item, local, options);
				} finally {
					app.unmount();
				}
			}
		});
	});

	await nextTick();
	if (renderVersions.get(el) !== version) return;
	if (check) {
		registerCheckEntries(el, checkEntries);
		markCheckRendered();
	}
	binding.value.onRendered?.(binding.value.source || '', sourceLines);
};

const update = (el: HTMLElement, binding: DirectiveBinding<MarkdownDirectiveValue>) => {
	if (binding.value.source !== binding.oldValue?.source
		|| binding.value.locale !== binding.oldValue?.locale
		|| binding.value.tabQuery !== binding.oldValue?.tabQuery
		|| binding.value.showPlaygroundWarnings !== binding.oldValue?.showPlaygroundWarnings
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
