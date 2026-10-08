// @vitest-environment jsdom

import { encode, decode } from '@deot/helper-unicode';
import { createPreviewUrl, normalizePreviewConfig, readPreviewConfig } from '../src/modules/preview/config';

describe('renderer preview configuration', () => {
	it('round-trips Unicode, source URL delimiters and CSS commas under a deployment base', () => {
		const config = normalizePreviewConfig({
			url: 'https://example.com/主题.vue?name=中文&a=1#preview',
			styles: ['https://example.com/a.css?fonts=a,b', '/custom.css'],
			modules: { lodash: 'https://example.com/lodash.js' },
			lang: 'en-US',
			playground: { local: true, styleless: false, views: ['runtime', 'files'], viewport: [375, 640], previewInset: [8, 16], expandable: true }
		});
		const url = new URL(createPreviewUrl(config, 'https://docs.example.com/nested/'));
		expect(url.pathname).toBe('/nested/__docs/preview');
		expect(JSON.parse(decode(url.searchParams.get('raw')!))).toEqual(config);
		expect(readPreviewConfig({ raw: url.searchParams.get('raw')!, url: 'ignored.vue', styles: '/ignored.css' })).toEqual(config);
	});

	it('continues to parse existing query links', () => {
		expect(readPreviewConfig({ url: ' demo.vue ', styles: '/a.css,/b.css', lang: 'zh-CN' })).toEqual({
			url: 'demo.vue', styles: ['/a.css', '/b.css'], modules: {}, lang: 'zh-CN'
		});
		expect(readPreviewConfig({ styles: ['/a.css?fonts=a,b', '/b.css'] }).styles).toEqual(['/a.css?fonts=a,b', '/b.css']);
	});

	it.each(['', ['a', 'b'], 'not-base64!', encode('not json'), encode('[]'), encode('{}')])('rejects invalid raw input %j', (raw) => {
		expect(() => readPreviewConfig({ raw })).toThrow();
	});

	it.each([
		{ url: 1 }, { styles: '/a.css' }, { styles: [null] }, { modules: [] }, { modules: { lodash: 1 } },
		{ lang: [] }, { playground: [] }
	])('rejects malformed field values %j', (fields) => {
		expect(() => normalizePreviewConfig({ url: 'demo.vue', ...fields })).toThrow();
	});

	it('keeps Playground display props while excluding source data', () => {
		expect(normalizePreviewConfig({
			url: 'demo.vue', playground: { local: true, viewport: 375, files: { 'Other.vue': 'overridden' }, entry: 'Other.vue' }
		}).playground).toEqual({ local: true, viewport: 375 });
	});
});
