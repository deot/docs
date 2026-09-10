import Config from 'markdown-it-chain';
import anchor from 'markdown-it-anchor';
import mdContainer from 'markdown-it-container';
import markdownIt from 'markdown-it';
import JSON5 from 'json5';
import type { PlaygroundFiles, PlaygroundView, PlaygroundViewport } from '@deot/docs-playground';
import type { MarkdownPlaygroundConfig } from './types';

const HTML_MD_SIGN = 'md';
const PLAYGROUND = 'playground';
const TABS = 'tabs';
const TIP = 'tip';
const WARNING = 'warning';
const CALLOUT_FILLED_RE = /(^|\s)filled(\s|$)/;
const TAB_MARKDOWN_INFO_RE = /^markdown(?:\s+(.*))?$/i;
const CALLOUT_INFO_ICON = [
	'<svg width="22" height="28" viewBox="0 0 22 28" fill="none" aria-hidden="true">',
	'<circle class="docs-markdown-callout-icon__fill" cx="11" cy="14" r="11"></circle>',
	'<circle class="docs-markdown-callout-icon__ring" cx="11" cy="14" r="10.5"></circle>',
	'<path class="docs-markdown-callout-icon__mark"',
	' d="m12.5 19-1.011.337a1 1 0 0 1-1.253-1.3l1.528-4.074a1 1 0 0 0-1.253-1.3L9.5 13"',
	' stroke-width="1.5" stroke-linecap="round"></path>',
	'<path class="docs-markdown-callout-icon__mark" d="M12 9a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0Z" stroke-width="1.5"></path>',
	'</svg>'
].join('');
const CALLOUT_WARNING_ICON = [
	'<svg width="22" height="28" viewBox="0 0 22 28" fill="none" aria-hidden="true">',
	'<circle class="docs-markdown-callout-icon__fill" cx="11" cy="14" r="11"></circle>',
	'<circle class="docs-markdown-callout-icon__ring" cx="11" cy="14" r="10.5"></circle>',
	'<path class="docs-markdown-callout-icon__mark" d="M11 10v5.5" stroke-width="1.5" stroke-linecap="round"></path>',
	'<path class="docs-markdown-callout-icon__mark" d="M11.5 18.5a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0Z" stroke-width="1.5"></path>',
	'</svg>'
].join('');
const renderCallout = (name: string, icon: string) => (
	tokens: { info: string; nesting: number }[],
	idx: number
) => {
	if (tokens[idx].nesting === 1) {
		const className = CALLOUT_FILLED_RE.test(tokens[idx].info)
			? `${name} ${name}--filled`
			: name;
		return [
			`<div class="${className}" md>`,
			'<span class="docs-markdown-callout-icon" aria-hidden="true">',
			icon,
			'</span><div class="docs-markdown-callout-body">\n'
		].join('');
	}
	return '</div></div>\n';
};
const config = new Config();

config
	.options
	.html(true)
	.typographer(true)
	.linkify(true)
	.end()

	.plugin('anchor')
	.use(anchor, [{
		permalink: anchor.permalink.linkInsideHeader({
			placement: 'before',
			symbol: '#'
		})
	}])
	.end()

	.plugin('container')
	.use(($md) => {
		const playgroundReg = new RegExp(`^${PLAYGROUND}\\s*(.*)$`);
		$md.use(mdContainer, PLAYGROUND, {
			validate(params) {
				return params.trim().match(playgroundReg);
			}
		});
		const tabsReg = new RegExp(`^${TABS}\\s*$`);
		$md.use(mdContainer, TABS, {
			validate(params) {
				return tabsReg.test(params.trim());
			}
		});

		$md.use(mdContainer, TIP, {
			render: renderCallout(TIP, CALLOUT_INFO_ICON)
		});
		$md.use(mdContainer, WARNING, {
			render: renderCallout(WARNING, CALLOUT_WARNING_ICON)
		});
	})
	.end();

const md = config.toMd(markdownIt);

const playgroundOpen = `container_${PLAYGROUND}_open`;
const playgroundClose = `container_${PLAYGROUND}_close`;
const tabsOpen = `container_${TABS}_open`;
const tabsClose = `container_${TABS}_close`;
const htmlCommentRE = /<!--([\s\S]*?)-->/g;
const runtimeConfigRE = /<config\s+lang\s*=\s*["']json5["']\s*>([\s\S]*?)<\/config>/i;
const renderPlaygroundError = (message: string) =>
	`<div class="docs-playground-error">PLAYGROUND: ${md.utils.escapeHtml(message)}</div>\n`;
const renderTabsError = (message: string) =>
	`<div class="docs-markdown-tabs-error">TABS: ${md.utils.escapeHtml(message)}</div>\n`;
/**
 * 从 fence info 解析 Tab 显示名：去掉可选的 `markdown` 语言前缀。
 * @param info fence 的 info 字符串，如 `markdown Linux` 或 `Android`。
 * @returns 显示标题（可能为空）。
 */
const parseTabFenceTitle = (info: string) => {
	const trimmed = info.trim();
	const match = trimmed.match(TAB_MARKDOWN_INFO_RE);
	if (match) return (match[1] || '').trim();
	return trimmed;
};
/**
 * 生成 `?tab=` 使用的 id：小写、空白变 `-`；含非 ASCII 时与标题锚点一致做 encodeURIComponent。
 * @param title Tab 显示名。
 * @returns 可写入 query 的 id；标题为空时返回空串。
 */
export const toMarkdownTabId = (title: string) => {
	const normalized = title.trim().toLowerCase().replace(/\s+/gu, '-');
	if (!normalized) return '';
	return /[^\x20-\x7E]/u.test(normalized)
		? encodeURIComponent(normalized)
		: normalized;
};
const PLAYGROUND_VIEWS = ['runtime', 'files'] as const satisfies readonly PlaygroundView[];
const isPlaygroundView = (value: unknown): value is PlaygroundView => (
	typeof value === 'string' && (PLAYGROUND_VIEWS as readonly string[]).includes(value)
);
const isRuntimeViewport = (viewport: unknown): viewport is PlaygroundViewport => {
	if (viewport === 'auto') return true;
	if (typeof viewport === 'number') return Number.isFinite(viewport) && viewport > 0;
	return Array.isArray(viewport)
		&& viewport.length === 2
		&& viewport.every(value => typeof value === 'number' && Number.isFinite(value) && value > 0);
};
const getRuntimeViewportKey = (viewport: PlaygroundViewport) => Array.isArray(viewport)
	? `${viewport[0]}x${viewport[1]}`
	: String(viewport);
const validateRuntimeViews = (propsData: MarkdownPlaygroundConfig) => {
	if ('view' in propsData) return '不支持 view 参数，请使用 views';
	if (!('views' in propsData)) return '';
	const views = propsData.views;
	if (!Array.isArray(views) || !views.length) {
		return 'views 必须是非空数组';
	}
	const invalidView = views.find(view => !isPlaygroundView(view));
	if (invalidView !== undefined) return `views 不支持 ${String(invalidView)}`;
	const duplicateView = views.find((view, viewIndex) =>
		views.indexOf(view) !== viewIndex
	);
	if (duplicateView !== undefined) return `views 不能重复声明 ${String(duplicateView)}`;
	return '';
};
const validateRuntimeViewport = (propsData: MarkdownPlaygroundConfig) => {
	if ('viewport' in propsData && !isRuntimeViewport(propsData.viewport)) {
		return 'viewport 必须是 auto、正数宽度或 [宽,高]';
	}
	if (!('viewportOptions' in propsData)) return '';
	const options = propsData.viewportOptions;
	if (!Array.isArray(options)) return 'viewportOptions 必须是数组';
	const invalidIndex = options.findIndex(option => !isRuntimeViewport(option));
	if (invalidIndex >= 0) {
		return `viewportOptions[${invalidIndex}] 必须是 auto、正数宽度或 [宽,高]`;
	}
	const keys = options.filter(isRuntimeViewport).map(getRuntimeViewportKey);
	const duplicateIndex = keys.findIndex((key, index) => keys.indexOf(key) !== index);
	if (duplicateIndex >= 0) {
		return `viewportOptions 不能重复声明 ${keys[duplicateIndex]}`;
	}
	return '';
};
const isPreviewInsetValue = (value: unknown) => (
	typeof value === 'number' && Number.isFinite(value) && value >= 0
);
const validatePreviewInset = (propsData: MarkdownPlaygroundConfig) => {
	if (!('previewInset' in propsData)) return '';
	const inset = propsData.previewInset;
	if (isPreviewInsetValue(inset)) return '';
	if (Array.isArray(inset)
		&& inset.length === 2
		&& inset.every(isPreviewInsetValue)) return '';
	return 'previewInset 必须是非负数或 [垂直,水平] 非负数数组';
};
const validateExpandable = (propsData: MarkdownPlaygroundConfig) => {
	if (!('expandable' in propsData)) return '';
	const expandable = propsData.expandable;
	if (expandable === true) return '';
	if (typeof expandable === 'number' && Number.isFinite(expandable) && expandable > 0) return '';
	return 'expandable 必须是 true 或正数';
};
const validateTitle = (propsData: MarkdownPlaygroundConfig) => {
	if (!('title' in propsData)) return '';
	if (typeof propsData.title === 'string') return '';
	return 'title 必须是字符串';
};
const validateTitleId = (propsData: MarkdownPlaygroundConfig) => {
	if (!('id' in propsData)) return '';
	if (typeof propsData.id === 'string') return '';
	return 'id 必须是字符串';
};
const validatePreviewScroller = (propsData: MarkdownPlaygroundConfig) => {
	if (!('previewScroller' in propsData)) return '';
	if (typeof propsData.previewScroller === 'boolean') return '';
	return 'previewScroller 必须是布尔值';
};
const parseRuntimeProps = (tokens: Array<{ type: string; content?: string }>): MarkdownPlaygroundConfig => {
	for (const token of tokens) {
		const sources: string[] = [];
		if (token.type === 'html_block' && token.content) sources.push(token.content);
		if (token.type === 'inline' && token.content) sources.push(token.content);
		for (const source of sources) {
			htmlCommentRE.lastIndex = 0;
			let commentMatch = htmlCommentRE.exec(source);
			while (commentMatch) {
				const configMatch = commentMatch[1].match(runtimeConfigRE);
				if (configMatch) {
					try {
						const parsed = JSON5.parse(configMatch[1]);
						if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
							return parsed as MarkdownPlaygroundConfig;
						}
					} catch { /* 配置格式异常时保持为空 */ }
				}
				commentMatch = htmlCommentRE.exec(source);
			}
		}
	}
	return {};
};
const renderPlaygroundAttrs = (propsData: MarkdownPlaygroundConfig) => `data-props="${md.utils.escapeHtml(JSON.stringify(propsData))}"`;

const renderTabsHtml = (
	panels: Array<{ id: string; title: string; content: string }>
) => {
	const parts = [
		'<div class="docs-markdown-tabs" md data-tabs>',
		'<div class="docs-markdown-tabs__nav" data-tabs-nav></div>'
	];
	panels.forEach((panel, index) => {
		const hidden = index === 0 ? '' : ' hidden';
		const id = md.utils.escapeHtml(panel.id);
		const title = md.utils.escapeHtml(panel.title);
		parts.push(
			`<div class="docs-markdown-tabs__panel" role="tabpanel" data-tab="${id}" data-tab-title="${title}"${hidden}>`,
			md.render(panel.content),
			'</div>'
		);
	});
	parts.push('</div>\n');
	return parts.join('');
};

md.core.ruler.after('block', 'markdown-tabs', (state) => {
	const panelSources = Array.isArray(state.env?.tabsPanelSources)
		? state.env.tabsPanelSources as string[]
		: undefined;

	for (let index = 0; index < state.tokens.length; index++) {
		const openToken = state.tokens[index];
		if (openToken.type !== tabsOpen) continue;

		let depth = 1;
		let closeIndex = index + 1;
		for (; closeIndex < state.tokens.length; closeIndex++) {
			if (state.tokens[closeIndex].type === tabsOpen) depth++;
			if (state.tokens[closeIndex].type === tabsClose) depth--;
			if (depth === 0) break;
		}

		const innerTokens = state.tokens.slice(index + 1, closeIndex);
		const fences = innerTokens.filter(token => token.type === 'fence');
		const placeholder = new state.Token('html_block', '', 0);
		placeholder.block = true;

		if (!fences.length) {
			placeholder.content = renderTabsError('至少需要声明一个分栏');
		} else {
			const panels: Array<{ id: string; title: string; content: string }> = [];
			const seen = new Set<string>();
			let error = '';
			for (const fence of fences) {
				const title = parseTabFenceTitle(fence.info);
				const id = toMarkdownTabId(title);
				if (!title || !id) {
					error = '每个分栏都必须声明标题';
					break;
				}
				if (seen.has(id)) {
					error = `分栏 ${title} 的 id 重复`;
					break;
				}
				seen.add(id);
				panels.push({ id, title, content: fence.content });
				panelSources?.push(fence.content);
			}
			placeholder.content = error
				? renderTabsError(error)
				: renderTabsHtml(panels);
		}

		state.tokens.splice(index, closeIndex - index + 1, placeholder);
	}
});

md.core.ruler.after('markdown-tabs', 'runtime-files', (state) => {
	for (let index = 0; index < state.tokens.length; index++) {
		const openToken = state.tokens[index];
		if (openToken.type !== playgroundOpen) continue;

		let depth = 1;
		let closeIndex = index + 1;
		for (; closeIndex < state.tokens.length; closeIndex++) {
			if (state.tokens[closeIndex].type === playgroundOpen) depth++;
			if (state.tokens[closeIndex].type === playgroundClose) depth--;
			if (depth === 0) break;
		}

		const innerTokens = state.tokens.slice(index + 1, closeIndex);
		const fences = innerTokens.filter(token => token.type === 'fence');
		const placeholder = new state.Token('html_block', '', 0);
		placeholder.block = true;
		const propsData = parseRuntimeProps(innerTokens);
		const propsError = validateRuntimeViews(propsData)
			|| validateRuntimeViewport(propsData)
			|| validatePreviewInset(propsData)
			|| validateExpandable(propsData)
			|| validateTitle(propsData)
			|| validateTitleId(propsData)
			|| validatePreviewScroller(propsData);
		const propsAttr = renderPlaygroundAttrs(propsData);

		if (!fences.length) {
			placeholder.content = renderPlaygroundError('至少需要声明一个代码文件');
		} else if (propsError) {
			placeholder.content = renderPlaygroundError(propsError);
		} else {
			const fileEntries = fences.map((token) => {
				const [, filename = ''] = token.info.trim().split(/\s+/, 2);
				return [filename, token.content] as const;
			});
			const isLegacy = fences.length === 1 && !fileEntries[0][0];

			if (isLegacy) {
				placeholder.content = [
					'<div data-playground',
					`data-code="${md.utils.escapeHtml(fences[0].content)}"`,
					`${propsAttr}></div>\n`
				].join(' ');
			} else {
				const missingFilename = fileEntries.some(([filename]) => !filename);
				const filenames = fileEntries.map(([filename]) => filename);
				const duplicateFilename = filenames.find((filename, fileIndex) =>
					filenames.indexOf(filename) !== fileIndex
				);
				const configuredEntry = typeof propsData.entry === 'string'
					? propsData.entry
					: '';
				const entry = configuredEntry || filenames[0];

				if (missingFilename) {
					placeholder.content = renderPlaygroundError('多文件模式下每个代码块都必须声明文件名');
				} else if (duplicateFilename) {
					placeholder.content = renderPlaygroundError(`文件名 ${duplicateFilename} 重复`);
				} else if (!filenames.includes(entry)) {
					placeholder.content = renderPlaygroundError(`入口文件 ${entry} 不存在`);
				} else {
					const files: PlaygroundFiles = Object.fromEntries(fileEntries);
					placeholder.content = [
						'<div data-playground',
						`data-files="${md.utils.escapeHtml(JSON.stringify(files))}"`,
						`data-entry="${md.utils.escapeHtml(entry)}"`,
						`${propsAttr}></div>\n`
					].join(' ');
				}
			}
		}

		state.tokens.splice(index, closeIndex - index + 1, placeholder);
	}
});

const renderAttrs = md.renderer.renderAttrs;
md.renderer.renderAttrs = (token) => {
	const reg = new RegExp(`container_${PLAYGROUND}|container_${TABS}|fence|text`);
	// 结束标记会复用 renderAttrs，但语法上不能携带属性。
	if (token.nesting !== -1 && token.type && !reg.test(token.type)) {
		token.attrPush([HTML_MD_SIGN, '']);
	}

	return renderAttrs(token);
};

export const Markdown = md;

export interface MarkdownSearchSection {
	title: string;
	/**
	 * 标题锚点，不含 `#`。
	 */
	anchor: string;
	/**
	 * Markdown 标题级别，1～6。
	 */
	level: number;
	text: string;
}

export interface MarkdownSearchDocument {
	title: string;
	/**
	 * 去掉标题后的全文可搜索文本。
	 */
	text: string;
	sections: MarkdownSearchSection[];
}

const normalizeSearchText = (value: string) => value.replace(/\s+/gu, ' ').trim();

/**
 * 从 inline token 中提取用户可见文本。HTML token 不进入索引，避免标签、
 * 注释或嵌入代码污染搜索结果；链接仍保留其可见标题。
 * @param token Markdown-It inline token。
 * @returns 规范化后的可搜索文本。
 */
const getInlineSearchText = (token: ReturnType<typeof md.parse>[number]) => {
	if (!token.children) return normalizeSearchText(token.content);
	return normalizeSearchText(token.children.map((child) => {
		if (child.type === 'html_inline') return '';
		if (child.type === 'softbreak' || child.type === 'hardbreak') return ' ';
		return ['text', 'code_inline'].includes(child.type) ? child.content : '';
	}).join(' '));
};

/**
 * 使用页面渲染共用的 Markdown Engine 生成搜索文档。heading ID 直接读取
 * markdown-it-anchor 处理后的 token，确保重复标题和中文标题的跳转地址
 * 与实际页面一致。
 * @param content Markdown 原文。
 * @returns 文档标题、正文和按标题划分的小节。
 */
export const parseMarkdownSearchSections = (content: string): MarkdownSearchDocument => {
	const sections: MarkdownSearchSection[] = [];
	const documentParts: string[] = [];
	let activeSection: MarkdownSearchSection | undefined;

	const consumeInline = (text: string) => {
		if (!text) return;
		documentParts.push(text);
		if (activeSection) {
			activeSection.text = normalizeSearchText(`${activeSection.text} ${text}`);
		}
	};

	const walk = (source: string, withHeadings: boolean) => {
		const tabsPanelSources: string[] = [];
		const tokens = md.parse(source, { tabsPanelSources });
		for (let index = 0; index < tokens.length; index++) {
			const token = tokens[index];
			if (withHeadings && token.type === 'heading_open') {
				const inline = tokens[index + 1];
				if (inline?.type !== 'inline') continue;
				const title = getInlineSearchText(inline);
				if (!title) continue;
				activeSection = {
					title,
					anchor: token.attrGet('id') || '',
					level: Number(token.tag.slice(1)) || 1,
					text: ''
				};
				sections.push(activeSection);
				continue;
			}
			if (token.type !== 'inline' || tokens[index - 1]?.type === 'heading_open') continue;
			consumeInline(getInlineSearchText(token));
		}
		for (const panelSource of tabsPanelSources) walk(panelSource, false);
	};

	walk(content, true);

	return {
		title: sections.find(section => section.level === 1)?.title || sections[0]?.title || '',
		text: normalizeSearchText(documentParts.join(' ')),
		sections
	};
};
