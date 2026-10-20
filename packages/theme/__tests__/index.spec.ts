// @vitest-environment node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { compile, compileString } from 'sass';
import { DOCS_THEMES, DOCS_THEME_COLOR_KEYS, isDocsTheme } from '../src';

const themeRoot = resolve(process.cwd(), 'packages/theme/src');

describe('docs theme protocol', () => {
	it('recognizes the two public themes', () => {
		expect(DOCS_THEMES).toEqual(['light', 'dark']);
		expect(isDocsTheme('light')).toBe(true);
		expect(isDocsTheme('dark')).toBe(true);
		expect(isDocsTheme('system')).toBe(false);
	});

	it('keeps the public color keys in sync with the SCSS theme', () => {
		const source = readFileSync(resolve(themeRoot, 'theme.scss'), 'utf8');
		const keys = [...source.matchAll(/^\t([a-z-]+):/gm)].map(match => match[1]);
		expect(new Set(DOCS_THEME_COLOR_KEYS).size).toBe(24);
		expect([...DOCS_THEME_COLOR_KEYS].sort()).toEqual(keys.sort());
	});

	it('compiles system and explicit theme scopes with configurable color fallbacks', () => {
		const css = compile(resolve(themeRoot, 'variables.scss')).css;
		expect(css).toContain('@media (prefers-color-scheme: light)');
		expect(css).toContain('@media (prefers-color-scheme: dark)');
		expect(css).toContain('[data-doc-theme=light]');
		expect(css).toContain('[data-vc-theme=dark]');
		expect(css).toContain('color-scheme: light');
		expect(css).toContain('color-scheme: dark');
		expect(css).toContain('--docs-background-color: var(--docs-theme-light-background-color, #fff)');
		expect(css).toContain('--docs-background-color: var(--docs-theme-dark-background-color, #171b24)');
		expect(css).toContain('--docs-background-color-lightest: var(--docs-theme-light-background-color-lightest, #fff)');
		expect(css).toContain('--docs-background-color-lightest: var(--docs-theme-dark-background-color-lightest, #171b24)');
		expect(css).toContain('--docs-color-contrast-light: var(--docs-theme-dark-color-contrast-light, #fff)');
		expect(css).toContain('--docs-color-secondary: var(--docs-theme-dark-color-secondary, var(--docs-color-link))');
		const legacyKeys = [
			'primary-color', 'background-color-page', 'background-color-soft', 'background-color-mute',
			'background-color-deep', 'background-color-deeper', 'foreground-color-mute',
			'foreground-color-lighter', 'foreground-color-on-primary', 'color-shadow', 'border-color-light'
		];
		legacyKeys.forEach(key => expect(css).not.toContain(`--docs-${key}:`));
	});

	it('preserves the existing light and dark visual palette after renaming', () => {
		const palette = JSON.parse(readFileSync(resolve(__dirname, 'fixtures/palette.json'), 'utf8')) as Record<string, [string, string]>;
		const css = compile(resolve(themeRoot, 'variables.scss')).css;
		expect(Object.keys(palette).sort()).toEqual([...DOCS_THEME_COLOR_KEYS].sort());
		Object.entries(palette).forEach(([key, values]) => {
			DOCS_THEMES.forEach((mode, index) => {
				expect(css).toContain(`--docs-${key}: var(--docs-theme-${mode}-${key}, ${values[index]})`);
			});
		});
	});

	it('preserves light-only SCSS theme customization in dark mode', () => {
		const css = compileString(`
			@use 'theme' with ($theme: (color-primary: (light: #15803d)));
			@use 'variables';
		`, { loadPaths: [themeRoot] }).css;
		expect(css).toContain('--docs-color-primary: var(--docs-theme-dark-color-primary, #15803d)');
	});
});
