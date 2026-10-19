// @vitest-environment jsdom

import { syncDocumentFavicon } from '../src/utils/favicon';
import { createDocsConfig } from './fixtures/docs';

describe('document favicon', () => {
	afterEach(() => document.head.querySelectorAll('link').forEach(link => link.remove()));

	it('prefers the explicit favicon over the brand logo', () => {
		syncDocumentFavicon(createDocsConfig({
			favicon: '/favicon.ico',
			layout: { header: { brand: { logo: '/logo.svg' } } }
		}), 'zh-CN');
		const link = document.head.querySelector('link')!;
		expect(link.getAttribute('href')).toBe('/favicon.ico');
		expect(link.rel).toBe('icon');
		expect(link.type).toBe('image/x-icon');
	});

	it.each([
		['/logo.SVG?v=1#icon', 'image/svg+xml'],
		['/logo.png', 'image/png'],
		['/logo.jpeg', 'image/jpeg'],
		['data:image/svg+xml,%3Csvg%3E%3C/svg%3E', 'image/svg+xml'],
		['data:image/png;base64,iVBORw0KGgo=', 'image/png']
	])('infers the type of %s', (logo, type) => {
		syncDocumentFavicon(createDocsConfig({ layout: { header: { brand: { logo } } } }), 'zh-CN');
		expect(document.head.querySelector('link')?.type).toBe(type);
	});

	it('follows the localized logo and falls back to the default language without duplicate links', () => {
		const config = createDocsConfig({
			layout: { header: { brand: { logo: { 'zh-CN': '/zh.svg', 'en-US': '/en.png' } } } }
		});
		syncDocumentFavicon(config, 'en_us');
		expect(document.head.querySelector('link')?.getAttribute('href')).toBe('/en.png');
		syncDocumentFavicon(config, 'fr-FR');
		expect(document.head.querySelectorAll('link')).toHaveLength(1);
		expect(document.head.querySelector('link')?.getAttribute('href')).toBe('/zh.svg');
		expect(document.head.querySelector('link')?.type).toBe('image/svg+xml');
	});

	it('updates its own favicon and removes a stale type for an unknown format', () => {
		syncDocumentFavicon(createDocsConfig({ favicon: '/old.png' }), 'zh-CN');
		syncDocumentFavicon(createDocsConfig({ favicon: '/image?id=icon.svg' }), 'zh-CN');
		const links = document.head.querySelectorAll('link');
		expect(links).toHaveLength(1);
		expect(links[0].rel).toBe('icon');
		expect(links[0].getAttribute('href')).toBe('/image?id=icon.svg');
		expect(links[0].hasAttribute('type')).toBe(false);
	});

	it.each(['icon', 'shortcut icon'])('leaves an existing %s untouched even with an explicit favicon', (rel) => {
		const original = `<link rel="${rel}" type="image/png" href="/manual.png">`;
		document.head.innerHTML += original;
		syncDocumentFavicon(createDocsConfig({ favicon: '/configured.svg' }), 'zh-CN');
		expect(document.head.querySelectorAll('link')).toHaveLength(1);
		expect(document.head.querySelector('link')?.outerHTML).toBe(original);
	});

	it('preserves an existing icon when neither favicon nor logo is configured', () => {
		syncDocumentFavicon(createDocsConfig(), 'zh-CN');
		expect(document.head.querySelector('link')).toBeNull();
		document.head.innerHTML += '<link rel="icon" href="/manual.ico">';
		syncDocumentFavicon(createDocsConfig(), 'zh-CN');
		expect(document.head.querySelector('link')?.getAttribute('href')).toBe('/manual.ico');
	});
});
