import type { RendererDocument } from '@deot/docs-renderer';
import { getDefaultLanguage } from './resolver';
import { findLanguageValue } from './sidebar';
import type {
	DocsConfig,
	DocsContent,
	DocsLocalized,
	DocsRoute,
	DocsRouteConfig
} from '../types';

export const isRendererDocument = (value: unknown): value is RendererDocument => (
	Boolean(value && typeof value === 'object' && 'schemaVersion' in value)
);

export const isPageJsonSource = (value: unknown): value is string => (
	typeof value === 'string' && /\.page\.json(?:$|[?#])/i.test(value)
);

export const isContentLocaleMap = (
	value: unknown
): value is Record<string, DocsContent> => (
	Boolean(
		value
		&& typeof value === 'object'
		&& !Array.isArray(value)
		&& !('schemaVersion' in value)
	)
);

export const isHomeLikeContent = (content: unknown): boolean => {
	if (isRendererDocument(content) || isPageJsonSource(content)) return true;
	if (!isContentLocaleMap(content)) return false;
	return Object.values(content).some(item => (
		isRendererDocument(item) || isPageJsonSource(item)
	));
};

export const isHomeLikeRoute = (routeConfig: DocsRouteConfig | undefined): boolean => {
	if (!routeConfig || typeof routeConfig === 'string' || typeof routeConfig === 'function') {
		return false;
	}
	return isHomeLikeContent(routeConfig.content);
};

export const resolveLocalizedContent = (
	content: DocsLocalized<DocsContent> | undefined,
	lang: string,
	fallbackLang: string
): DocsContent | undefined => {
	if (content === undefined) return undefined;
	if (!isContentLocaleMap(content)) return content;
	return findLanguageValue(content, lang)
		?? findLanguageValue(content, fallbackLang);
};

export const resolveHomeContent = (
	config: DocsConfig,
	lang: string
): DocsContent | undefined => {
	const root = config.routes['/'];
	if (!root || typeof root !== 'object') return undefined;
	return resolveLocalizedContent(root.content, lang, 'en-US');
};

export const resolveRouteContent = (
	content: DocsLocalized<DocsContent> | undefined,
	lang: string,
	config: DocsConfig,
	pathname = ''
): DocsContent | undefined => (
	resolveLocalizedContent(
		content,
		lang,
		pathname === '/' ? 'en-US' : getDefaultLanguage(config)
	)
);

export const writeHomeContent = (
	config: DocsConfig,
	lang: string,
	value: DocsContent
) => {
	const current = config.routes['/'];
	const route: DocsRoute = current && typeof current === 'object' ? current : {};
	config.routes['/'] = route;
	const content = route.content;
	if (isContentLocaleMap(content) || content === undefined) {
		route.content = {
			...(isContentLocaleMap(content) ? content : {}),
			[lang]: value
		};
		return;
	}
	route.content = value;
};
