// @vitest-environment jsdom

import {
	applyPlaygroundImportMapOverride,
	applyPlaygroundStyleOverride,
	clearPlaygroundMaps,
	getPlaygroundImportMapOverrides,
	getPlaygroundSiteModules,
	getPlaygroundSiteStyles,
	getPlaygroundStyleOverrides,
	setPlaygroundSiteStyles,
	removePlaygroundImportMapOverride,
	removePlaygroundStyleOverride,
	setPlaygroundImportMapOverrides,
	setPlaygroundSiteModules
} from '../src/import-map';

describe('playground import map overrides', () => {
	beforeEach(() => {
		clearPlaygroundMaps();
	});

	it('normalizes blank aliases and urls when applying overrides', () => {
		expect(applyPlaygroundImportMapOverride('  ', 'https://cdn.example.com/vue.js')).toEqual({});
		expect(applyPlaygroundImportMapOverride('vue', '  ')).toEqual({});
		applyPlaygroundImportMapOverride(' vue ', ' https://cdn.example.com/vue.js ');
		expect(getPlaygroundImportMapOverrides()).toEqual({
			vue: 'https://cdn.example.com/vue.js'
		});
		expect(removePlaygroundImportMapOverride('missing')).toEqual({
			vue: 'https://cdn.example.com/vue.js'
		});
		expect(removePlaygroundImportMapOverride(' vue ')).toEqual({});
	});

	it('drops unsafe hrefs from memory overrides', () => {
		applyPlaygroundImportMapOverride('vue', 'https://cdn.example.com/vue.js');
		expect(applyPlaygroundImportMapOverride('vue', 'javascript:alert(1)')).toEqual({});
		setPlaygroundImportMapOverrides({
			vue: 'javascript:alert(1)',
			lib: 'https://cdn.example.com/lib.js'
		});
		expect(getPlaygroundImportMapOverrides()).toEqual({
			lib: 'https://cdn.example.com/lib.js'
		});
	});

	it('filters blank entries when replacing the whole override map', () => {
		setPlaygroundImportMapOverrides({
			'vue': 'https://cdn.example.com/vue.js',
			'': 'https://cdn.example.com/empty.js',
			'lodash': '  '
		});
		expect(getPlaygroundImportMapOverrides()).toEqual({
			vue: 'https://cdn.example.com/vue.js'
		});
	});

	it('keeps style overrides and site modules isolated from import overrides', () => {
		setPlaygroundSiteModules({ 'site-lib': 'https://cdn.example.com/site-lib.js' });
		setPlaygroundSiteStyles({
			'@my/ui/dist/index.css': 'https://cdn.example.com/ui.css'
		});
		applyPlaygroundStyleOverride(
			'@deot/style/dist/index.css',
			'https://cdn.example.com/index.css'
		);
		applyPlaygroundImportMapOverride('vue', 'https://cdn.example.com/vue.js');
		expect(getPlaygroundSiteModules()).toEqual({
			'site-lib': 'https://cdn.example.com/site-lib.js'
		});
		expect(getPlaygroundSiteStyles()).toEqual({
			'@my/ui/dist/index.css': 'https://cdn.example.com/ui.css'
		});
		expect(getPlaygroundStyleOverrides()).toEqual({
			'@deot/style/dist/index.css': 'https://cdn.example.com/index.css'
		});
		expect(getPlaygroundImportMapOverrides()).toEqual({
			vue: 'https://cdn.example.com/vue.js'
		});
		expect(removePlaygroundStyleOverride('@deot/style/dist/index.css')).toEqual({});
		expect(getPlaygroundImportMapOverrides().vue).toBe('https://cdn.example.com/vue.js');
		expect(getPlaygroundSiteModules()['site-lib']).toBe('https://cdn.example.com/site-lib.js');
		expect(getPlaygroundSiteStyles()['@my/ui/dist/index.css'])
			.toBe('https://cdn.example.com/ui.css');
	});
});
