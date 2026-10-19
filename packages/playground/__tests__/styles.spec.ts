// @vitest-environment jsdom

import { createRuntimePreviewOptions } from '../src/core/store';
import { acquireRuntimeStyles, createRuntimeStyleUrls } from '../src/core/styles';
import {
	applyPlaygroundStyleOverride,
	clearPlaygroundMaps,
	getPlaygroundSiteStyles,
	setPlaygroundSiteStyles
} from '../src/import-map';

describe('runtime styles', () => {
	afterEach(() => {
		clearPlaygroundMaps();
		delete (window as Partial<Window>).$docs;
	});

	it('fills builtin styles and shares the same ordered overrides with iframe previews', () => {
		setPlaygroundSiteStyles({
			'@deot/style/dist/index.normalize-only.css': '/local/normalize.css',
			'@deot/style/dist/index.css': '/local/style.css',
			'custom': '/extra.css',
			'duplicate': '/extra.css'
		});
		applyPlaygroundStyleOverride('@deot/style/dist/index.css', '/managed.css');
		const urls = createRuntimeStyleUrls('https://cdn.example.test/npm');
		expect(urls).toEqual([
			'/local/normalize.css',
			'https://cdn.example.test/npm/@deot/vc-components/dist/index.style.css',
			'/managed.css',
			'/extra.css'
		]);
		const head = document.createElement('div');
		head.innerHTML = createRuntimePreviewOptions('https://cdn.example.test/npm').headHTML!;
		expect([...head.querySelectorAll('link')].map(link => link.getAttribute('href'))).toEqual(urls);
		clearPlaygroundMaps();
		expect(createRuntimeStyleUrls()).toEqual([
			'https://cdn.jsdelivr.net/npm/@deot/style/dist/index.normalize-only.css',
			'https://cdn.jsdelivr.net/npm/@deot/vc-components/dist/index.style.css',
			'https://cdn.jsdelivr.net/npm/@deot/style/dist/index.css'
		]);
	});

	it('uses the selected CDN and final hook before deduplicating without changing configuration', () => {
		const cdn = vi.fn(({ url }: { url: string }) => url.includes('custom-') ? '/shared.css' : `${url}?signed=1`);
		window.$docs = { locales: {}, routes: {}, runtime: { mode: 'production', cdn: 'https://esm.unpkg.com' }, resolve: { cdn } };
		const styles = { first: '/custom-a.css', second: '/custom-b.css' };
		setPlaygroundSiteStyles(styles);
		expect(createRuntimeStyleUrls()).toEqual([
			'https://esm.unpkg.com/@deot/style/dist/index.normalize-only.css?signed=1',
			'https://esm.unpkg.com/@deot/vc-components/dist/index.style.css?signed=1',
			'https://esm.unpkg.com/@deot/style/dist/index.css?signed=1',
			'/shared.css'
		]);
		expect(cdn).toHaveBeenCalledTimes(5);
		expect(getPlaygroundSiteStyles()).toEqual(styles);
	});

	it('normalizes URLs and does not reuse a disabled stylesheet or release another reference twice', () => {
		const host = document.createElement('link');
		host.rel = 'stylesheet';
		host.href = '/disabled.css';
		host.disabled = true;
		document.head.appendChild(host);
		const release = acquireRuntimeStyles(['/disabled.css', host.href]);
		const releaseOther = acquireRuntimeStyles([host.href]);
		const owned = document.querySelector('link[data-playground-style]')!;
		try {
			expect(document.querySelectorAll('link[data-playground-style]')).toHaveLength(1);
			expect(owned).not.toBe(host);
			release();
			release();
			expect(owned.isConnected).toBe(true);
			releaseOther();
			expect(owned.isConnected).toBe(false);
			expect(host.isConnected).toBe(true);
		} finally {
			release();
			releaseOther();
			host.remove();
		}
	});
});
