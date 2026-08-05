import Config from 'markdown-it-chain';
import anchor from 'markdown-it-anchor';
import mdContainer from 'markdown-it-container';
import markdownIt from 'markdown-it';
import JSON5 from 'json5';

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
		permalink: true,
		permalinkBefore: true,
		permalinkSymbol: '#'
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
const runtimeViews = ['runtime', 'files'];
const isRuntimeViewport = (viewport: unknown) => {
	if (viewport === 'auto') return true;
	if (typeof viewport === 'number') return Number.isFinite(viewport) && viewport > 0;
	return Array.isArray(viewport)
		&& viewport.length === 2
		&& viewport.every(value => typeof value === 'number' && Number.isFinite(value) && value > 0);
};
const getRuntimeViewportKey = (viewport: unknown) => Array.isArray(viewport)
	? `${viewport[0]}x${viewport[1]}`
	: String(viewport);
const validateRuntimeViews = (propsData: Record<string, unknown>) => {
	if ('view' in propsData) return '不支持 view 参数，请使用 views';
	if (!('views' in propsData)) return '';
	const views = propsData.views;
	if (!Array.isArray(views) || !views.length) {
		return 'views 必须是非空数组';
	}
	const invalidView = views.find(view => !runtimeViews.includes(view));
	if (invalidView !== undefined) return `views 不支持 ${String(invalidView)}`;
	const duplicateView = views.find((view, viewIndex) =>
		views.indexOf(view) !== viewIndex
	);
	if (duplicateView !== undefined) return `views 不能重复声明 ${String(duplicateView)}`;
	return '';
};
const validateRuntimeViewport = (propsData: Record<string, unknown>) => {
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
	const keys = options.map(getRuntimeViewportKey);
	const duplicateIndex = keys.findIndex((key, index) => keys.indexOf(key) !== index);
	if (duplicateIndex >= 0) {
		return `viewportOptions 不能重复声明 ${keys[duplicateIndex]}`;
	}
	return '';
};
const parseRuntimeProps = (tokens: Array<{ type: string; content?: string }>) => {
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
							return parsed as Record<string, unknown>;
						}
					} catch { /* malformed config remains empty */ }
				}
				commentMatch = htmlCommentRE.exec(source);
			}
		}
	}
	return {};
};
const renderPlaygroundAttrs = (propsData: Record<string, unknown>) => `data-props="${md.utils.escapeHtml(JSON.stringify(propsData))}"`;

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
		const propsError = validateRuntimeViews(propsData) || validateRuntimeViewport(propsData);
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
					const files = Object.fromEntries(fileEntries);
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
	if (token.type && !reg.test(token.type)) {
		token.attrPush([HTML_MD_SIGN, '']);
	}

	return renderAttrs(token);
};

export const Markdown = md;
