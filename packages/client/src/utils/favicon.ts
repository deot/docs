import { getDefaultLanguage } from './resolver';
import { findLanguageValue } from './sidebar';
import type { DocsConfig } from '../types';

const IMAGE_TYPES: Record<string, string> = {
	svg: 'image/svg+xml',
	ico: 'image/x-icon',
	png: 'image/png',
	jpg: 'image/jpeg',
	jpeg: 'image/jpeg',
	gif: 'image/gif',
	webp: 'image/webp',
	avif: 'image/avif',
	bmp: 'image/bmp'
};

export const syncDocumentFavicon = (config: DocsConfig, lang: string) => {
	if (document.head.querySelector('link[rel~="icon"]:not([data-docs-favicon])')) return;
	const logo = config.layout?.header?.brand?.logo;
	const href = config.favicon || (typeof logo === 'string'
		? logo
		: logo && (findLanguageValue(logo, lang) ?? findLanguageValue(logo, getDefaultLanguage(config))));
	if (!href) return;
	const type = /^data:([^;,]+)/i.exec(href)?.[1]
		|| IMAGE_TYPES[href.split(/[?#]/)[0].split('.').pop()!.toLowerCase()];
	const link = document.head.querySelector<HTMLLinkElement>('link[data-docs-favicon]')
		|| document.createElement('link');
	link.setAttribute('data-docs-favicon', '');
	link.rel = 'icon';
	link.href = href;
	if (type) link.type = type;
	else link.removeAttribute('type');
	if (!link.parentNode) document.head.appendChild(link);
};
