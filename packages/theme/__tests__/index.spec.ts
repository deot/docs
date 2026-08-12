import { DOCS_THEMES, isDocsTheme } from '../src';

describe('docs theme protocol', () => {
	it('recognizes the two public themes', () => {
		expect(DOCS_THEMES).toEqual(['light', 'dark']);
		expect(isDocsTheme('light')).toBe(true);
		expect(isDocsTheme('dark')).toBe(true);
		expect(isDocsTheme('system')).toBe(false);
	});
});
