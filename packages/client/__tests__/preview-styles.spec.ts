// @vitest-environment jsdom

import { acquirePreviewStyles, parsePreviewStyleUrls } from '../src/modules/preview/styles';

describe('preview styles', () => {
	it('parses comma lists and keeps commas inside repeated URL parameters', () => {
		const base = 'https://docs.example.com/__docs/preview';
		expect(parsePreviewStyleUrls(' /a.css,https://cdn.example.com/b.css,/a.css ', base)).toEqual([
			'https://docs.example.com/a.css', 'https://cdn.example.com/b.css'
		]);
		expect(parsePreviewStyleUrls(['https://cdn.example.com/a.css?fonts=a,b', '/b.css'], base)).toEqual([
			'https://cdn.example.com/a.css?fonts=a,b', 'https://docs.example.com/b.css'
		]);
		expect(parsePreviewStyleUrls(undefined, base)).toEqual([]);
		expect(parsePreviewStyleUrls('', base)).toEqual([]);
	});

	it.each(['javascript:alert(1)', 'data:text/css,body{}', '//cdn.example.com/a.css', './a.css', '/\\cdn.example.com/a.css'])(
		'rejects unsupported stylesheet address %s',
		(value) => {
			expect(() => parsePreviewStyleUrls(value, location.href)).toThrow();
		}
	);

	it('loads in order, shares URLs and releases only the last reference', () => {
		const urls = ['https://cdn.example.com/a.css', 'https://cdn.example.com/b.css'];
		const error = vi.fn();
		const release = acquirePreviewStyles([...urls, urls[0]], error);
		const second = acquirePreviewStyles([urls[0]], error);
		const links = [...document.querySelectorAll<HTMLLinkElement>('link[data-docs-preview-style]')];
		expect(links.map(link => link.href)).toEqual(urls);
		release();
		expect(links[0].isConnected).toBe(true);
		expect(links[1].isConnected).toBe(false);
		links[0].dispatchEvent(new Event('error'));
		expect(error).toHaveBeenCalledTimes(1);
		expect(error).toHaveBeenCalledWith(urls[0]);
		second();
		second();
		expect(links[0].isConnected).toBe(false);
		links[0].dispatchEvent(new Event('error'));
		expect(error).toHaveBeenCalledTimes(1);
	});

	it('reuses a host stylesheet and keeps it after preview cleanup', () => {
		const link = document.createElement('link');
		link.rel = 'stylesheet';
		link.href = 'https://cdn.example.com/host.css';
		document.head.appendChild(link);
		const release = acquirePreviewStyles([link.href], vi.fn());
		expect(document.querySelectorAll('link[href="https://cdn.example.com/host.css"]')).toHaveLength(1);
		release();
		expect(link.isConnected).toBe(true);
		link.remove();
	});
});
