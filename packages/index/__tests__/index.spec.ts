// @vitest-environment jsdom

import { Dever, Locale, Renderer, Theme } from '../src';

describe('index.ts', () => {
	it('exports server and browser package namespaces', () => {
		expect(Dever.run).toBeTypeOf('function');
		expect(Locale.resolveLocale('zh-CN').name).toBe('zh-CN');
		expect(Renderer.Combo).toBeDefined();
		expect(Renderer.Renderer).toBeDefined();
		expect(Theme.DOCS_THEMES).toEqual(['light', 'dark']);
	});
});
