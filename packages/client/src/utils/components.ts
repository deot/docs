import type { MarkdownIndicatorConfig, MarkdownTheme } from '@deot/docs-markdown';
import type { RendererFit } from '@deot/docs-renderer';
import type {
	DocsComponentsOptions,
	DocsConfig,
	DocsMarkdownComponentOptions,
	DocsPlaygroundComponentOptions,
	DocsRendererComponentOptions
} from '../types';

const isPlainObject = (value: unknown): value is Record<string, unknown> => (
	Boolean(value) && typeof value === 'object' && !Array.isArray(value)
);

/**
 * 归一化站点 Markdown 排版皮肤；非法值回退 `default`。
 * @param value `components.markdown.theme`。
 * @returns `'default'` 或 `'traditional'`。
 */
export const resolveDocsMarkdownTheme = (value: unknown): MarkdownTheme => (
	value === 'traditional' ? 'traditional' : 'default'
);

/**
 * 读取站点 Markdown 组件默认配置。
 * @param config 站点配置。
 * @returns 归一化后的 markdown 默认 props。
 */
export const resolveDocsMarkdownComponent = (
	config: Pick<DocsConfig, 'components'>
): DocsMarkdownComponentOptions => {
	const markdown = config.components?.markdown;
	if (!isPlainObject(markdown)) return { theme: 'default' };
	const options: DocsMarkdownComponentOptions = {
		theme: resolveDocsMarkdownTheme(markdown.theme)
	};
	if ('indicator' in markdown) {
		options.indicator = markdown.indicator as MarkdownIndicatorConfig;
	}
	return options;
};

/**
 * 读取站点 Playground 组件默认配置（浅拷贝，便于与块级 / 实例 props 合并）。
 * @param config 站点配置。
 * @returns 站点 playground 默认 props。
 */
export const resolveDocsPlaygroundComponent = (
	config: Pick<DocsConfig, 'components'>
): DocsPlaygroundComponentOptions => {
	const playground = config.components?.playground;
	if (!isPlainObject(playground)) return {};
	return { ...playground } as DocsPlaygroundComponentOptions;
};

const RENDERER_FITS = new Set<RendererFit>(['none', 'width', 'contain']);

/**
 * 读取站点 Renderer 组件默认配置。
 * @param config 站点配置。
 * @returns 归一化后的 renderer 默认 props。
 */
export const resolveDocsRendererComponent = (
	config: Pick<DocsConfig, 'components'>
): DocsRendererComponentOptions => {
	const renderer = config.components?.renderer;
	if (!isPlainObject(renderer)) return {};
	const options: DocsRendererComponentOptions = {};
	if (typeof renderer.fit === 'string' && RENDERER_FITS.has(renderer.fit as RendererFit)) {
		options.fit = renderer.fit as RendererFit;
	}
	return options;
};

/**
 * 读取完整的站点 components 默认配置。
 * @param config 站点配置。
 * @returns markdown / playground / renderer 默认集合。
 */
export const resolveDocsComponents = (
	config: Pick<DocsConfig, 'components'>
): DocsComponentsOptions => ({
	markdown: resolveDocsMarkdownComponent(config),
	playground: resolveDocsPlaygroundComponent(config),
	renderer: resolveDocsRendererComponent(config)
});
