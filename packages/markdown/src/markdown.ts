import Config from 'markdown-it-chain';
import anchor from 'markdown-it-anchor';
import mdContainer from 'markdown-it-container';
import markdownIt from 'markdown-it';
import JSON5 from 'json5';
import type { PlaygroundFiles, PlaygroundView, PlaygroundViewport } from '@deot/docs-playground';
import type { MarkdownPlaygroundConfig } from './types';

const HTML_MD_SIGN = 'md';
const PLAYGROUND = 'playground';
const TIP = 'tip';
const WARNING = 'warning';
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
		const reg = new RegExp(`^${PLAYGROUND}\\s*(.*)$`);
		$md.use(mdContainer, PLAYGROUND, {
			validate(params) {
				return params.trim().match(reg);
			}
		});

		$md.use(mdContainer, TIP);
		$md.use(mdContainer, WARNING);
	})
	.end();

const md = config.toMd(markdownIt);

const playgroundOpen = `container_${PLAYGROUND}_open`;
const playgroundClose = `container_${PLAYGROUND}_close`;
const htmlCommentRE = /<!--([\s\S]*?)-->/g;
const runtimeConfigRE = /<config\s+lang\s*=\s*["']json5["']\s*>([\s\S]*?)<\/config>/i;
const renderPlaygroundError = (message: string) =>
	`<div class="docs-playground-error">PLAYGROUND: ${md.utils.escapeHtml(message)}</div>\n`;
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

md.core.ruler.after('block', 'runtime-files', (state) => {
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
			|| validateExpandable(propsData);
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
	const reg = new RegExp(`container_${PLAYGROUND}|fence|text`);
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
	const tokens = md.parse(content, {});
	const sections: MarkdownSearchSection[] = [];
	const documentParts: string[] = [];
	let activeSection: MarkdownSearchSection | undefined;

	for (let index = 0; index < tokens.length; index++) {
		const token = tokens[index];
		if (token.type === 'heading_open') {
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
		// 除标题外的 inline token 都是可见正文，包含段落、列表和表格单元格。
		if (token.type !== 'inline' || tokens[index - 1]?.type === 'heading_open') continue;
		const text = getInlineSearchText(token);
		if (!text) continue;
		documentParts.push(text);
		if (activeSection) {
			activeSection.text = normalizeSearchText(`${activeSection.text} ${text}`);
		}
	}

	return {
		title: sections.find(section => section.level === 1)?.title || sections[0]?.title || '',
		text: normalizeSearchText(documentParts.join(' ')),
		sections
	};
};
