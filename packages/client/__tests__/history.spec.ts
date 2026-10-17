// @vitest-environment jsdom

import { getDocsHistoryMode } from '../src/utils/history';
import { getDocsBase, resolveResource } from '../src/utils/resolver';
import type { DocsConfig } from '../src/types';

describe('history mode selection', () => {
	it.each(['http:', 'https:'])('defaults %s to HTML5 history', (protocol) => {
		expect(getDocsHistoryMode({}, protocol)).toBe('html5');
	});

	it.each(['file:', 'app:', 'chrome-extension:', 'blob:', 'about:', 'data:'])('defaults %s to hash history', (protocol) => {
		expect(getDocsHistoryMode({}, protocol)).toBe('hash');
	});

	it.each(['http:', 'https:', 'file:', 'app:'])('honors both explicit modes on %s', (protocol) => {
		expect(getDocsHistoryMode({ history: 'hash' }, protocol)).toBe('hash');
		expect(getDocsHistoryMode({ history: 'html5' }, protocol)).toBe('html5');
	});

	it('defaults file entries to hash mode and keeps their resource directory', async () => {
		const previous = location.href;
		const environment = globalThis as typeof globalThis & { jsdom: { reconfigure: (options: { url: string }) => void } };
		environment.jsdom.reconfigure({ url: 'file:///workspace/en-US/index.html?embed=1' });
		expect(location.protocol).toBe('file:');
		const config: DocsConfig = {
			locales: { 'zh-CN': { label: '简体中文' }, 'en-US': { label: 'English' } },
			routes: { '/': { content: null }, '/guide': { content: null } }
		};
		try {
			expect(getDocsHistoryMode(config)).toBe('hash');
			expect(getDocsBase(config)).toBe('file:///workspace/en-US/');
			expect(await resolveResource(config, { type: 'markdown', lang: 'zh-CN', source: './guide.md' }))
				.toBe('file:///workspace/en-US/zh-CN/guide.md');
		} finally {
			environment.jsdom.reconfigure({ url: previous });
		}
	});
});
