// @vitest-environment jsdom

import { parse } from 'vue/compiler-sfc';
import { File as ReplFile } from '@vue/repl';
import { SASS_CDN_URL } from '../src/cdn';
import { DEFAULT_CDN_URL } from '../src/constants';
import { createRuntimeStore } from '../src/core/store';
import {
	applyStandaloneScss,
	compileScssSource,
	createPlaygroundImporter,
	filesNeedScss,
	formatScssError,
	isScssPartial,
	loadSass,
	resolvePlaygroundStylesheet,
	rewriteVueSfcStyles,
	setSassLoader,
	toPlaygroundFileMap,
	wrapCompiler,
	type SassCompiler
} from '../src/core/scss';

const createFakeSass = (): SassCompiler => ({
	compileString(source, options) {
		if (source.includes('INVALID')) throw new Error('expected sass error');
		const loadUses = (text: string): string => text.replace(
			/@use\s+['"]([^'"]+)['"][^;]*;?/gu,
			(_match, spec: string) => {
				const importer = options?.importer;
				if (!importer) throw new Error(`Can't find stylesheet to import: ${spec}`);
				const url = importer.canonicalize(spec, {
					fromImport: false,
					containingUrl: options?.url ?? null
				});
				if (!url) throw new Error(`Can't find stylesheet to import: ${spec}`);
				const loaded = importer.load(url);
				if (!loaded) throw new Error(`Can't find stylesheet to import: ${spec}`);
				return loadUses(loaded.contents);
			}
		);
		let next = loadUses(source);
		const vars = new Map<string, string>();
		next = next.replace(/\$([\w-]+)\s*:\s*([^;]+);/gu, (_match, name: string, value: string) => {
			vars.set(name, value.trim());
			return '';
		});
		next = next.replace(/\$([\w-]+)/gu, (_match, name: string) => vars.get(name) || `$${name}`);
		return { css: next.replace(/\n{2,}/gu, '\n').trim() };
	}
});

const vueWithScss = `<template>
	<p class="box">hi</p>
</template>
<style lang="scss">
$color: red;
.box { color: $color; }
</style>
`;

describe('playground scss', () => {
	let loads = 0;

	beforeEach(() => {
		loads = 0;
		setSassLoader(async () => {
			loads += 1;
			return createFakeSass();
		});
	});

	afterEach(() => {
		setSassLoader();
	});

	it('loads Sass from jsDelivr +esm, not the playground cdn origin', () => {
		expect(SASS_CDN_URL).toBe(`${DEFAULT_CDN_URL}/sass/+esm`);
	});

	it('detects vue lang=scss and standalone scss files', () => {
		expect(filesNeedScss({ 'App.vue': '<template />' })).toBe(false);
		expect(filesNeedScss({ 'App.vue': vueWithScss })).toBe(true);
		expect(filesNeedScss({ 'theme.scss': '.a { color: red; }' })).toBe(true);
		expect(isScssPartial('src/_variables.scss')).toBe(true);
		expect(isScssPartial('src/theme.scss')).toBe(false);
	});

	it('resolves partials and omitted extensions', () => {
		const files = {
			'src/_variables.scss': '$accent: #c00;',
			'src/theme.scss': '.box { color: red; }'
		};
		expect(resolvePlaygroundStylesheet(files, 'src/variables')).toBe('src/_variables.scss');
		expect(resolvePlaygroundStylesheet(files, 'src/theme')).toBe('src/theme.scss');
		expect(resolvePlaygroundStylesheet(files, 'missing')).toBeNull();
	});

	it('rewrites vue style lang=scss into plain css', () => {
		const sass = createFakeSass();
		const { code, errors } = rewriteVueSfcStyles(
			vueWithScss,
			'src/App.vue',
			parse,
			sass,
			{ 'src/App.vue': vueWithScss }
		);
		expect(errors).toEqual([]);
		expect(code).not.toContain('lang="scss"');
		expect(code).toContain('color: red');
		expect(parse(code, { filename: 'src/App.vue' }).descriptor.styles[0].lang).toBeFalsy();
	});

	it('rewrites vue style lang=sass using indented syntax', () => {
		const source = `<template><p class="box">hi</p></template>
<style lang="sass">
$color: red
.box
	color: $color
</style>
`;
		const sass: SassCompiler = {
			compileString(_text, options) {
				expect(options?.syntax).toBe('indented');
				return { css: '.box { color: red; }' };
			}
		};
		const { code, errors } = rewriteVueSfcStyles(
			source,
			'src/App.vue',
			parse,
			sass,
			{ 'src/App.vue': source }
		);
		expect(errors).toEqual([]);
		expect(code).not.toContain('lang="sass"');
		expect(code).toContain('color: red');
	});

	it('compiles @use of a playground partial', () => {
		const files = {
			'src/App.vue': [
				'<style lang="scss">@use \'./_variables.scss\' as *; .box { color: $accent; }</style>',
				'<template><div class="box" /></template>'
			].join(''),
			'src/_variables.scss': '$accent: #c00;'
		};
		const css = compileScssSource(
			`@use './_variables.scss' as *; .box { color: $accent; }`,
			'src/App.vue',
			createFakeSass(),
			files
		);
		expect(css).toContain('color: #c00');
		expect(css).not.toContain('$accent');
	});

	it('surfaces sass compile errors', () => {
		const { code, errors } = rewriteVueSfcStyles(
			`<template><div /></template>\n<style lang="scss">INVALID</style>`,
			'src/App.vue',
			parse,
			createFakeSass(),
			{}
		);
		expect(code).toContain('lang="scss"');
		expect(errors[0]).toContain(formatScssError('src/App.vue', 'expected sass error'));
	});

	it('injects standalone scss into the entry compiled css and skips partials', () => {
		const store = {
			mainFile: 'src/App.vue',
			errors: [] as Array<string | Error>,
			files: {
				'src/App.vue': Object.assign(new ReplFile('src/App.vue', '<template><div class="box" /></template>'), {
					compiled: { js: '', css: '/* vue */', ssr: '', clientMap: '', ssrMap: '' }
				}),
				'src/theme.scss': Object.assign(new ReplFile('src/theme.scss', '$color: blue; .box { color: $color; }'), {
					compiled: { js: '', css: '', ssr: '', clientMap: '', ssrMap: '' }
				}),
				'src/_variables.scss': Object.assign(new ReplFile('src/_variables.scss', '$accent: #c00;'), {
					compiled: { js: '', css: '', ssr: '', clientMap: '', ssrMap: '' }
				})
			}
		};
		applyStandaloneScss(store, createFakeSass());
		expect(store.files['src/theme.scss'].compiled.css).toContain('color: blue');
		expect(store.files['src/theme.scss'].compiled.js).toContain('export default');
		expect(store.files['src/App.vue'].compiled.css).toContain('color: blue');
		expect(store.files['src/App.vue'].compiled.css).toContain('docs-playground-scss-start');
		expect(store.files['src/_variables.scss'].compiled.css).not.toContain('#c00');
		expect(store.files['src/App.vue'].compiled.css).not.toContain('#c00');
	});

	it('does not load sass when playground files have no scss', () => {
		createRuntimeStore({ 'App.vue': '<template><div /></template>' }, 'App.vue', {});
		expect(loads).toBe(0);
	});

	it('loads sass and compiles vue lang=scss without mutating source', async () => {
		const store = createRuntimeStore({ 'App.vue': vueWithScss }, 'App.vue', {});
		await vi.waitFor(() => {
			expect(loads).toBe(1);
			expect(store.files['src/App.vue'].compiled.css).toContain('color: red');
		});
		expect(store.files['src/App.vue'].code).toContain('lang="scss"');
		expect(store.errors).toEqual([]);
	});

	it('loads sass for standalone scss and keeps partials out of the entry', async () => {
		const store = createRuntimeStore({
			'App.vue': `<template><p class="box">hi</p></template>`,
			'theme.scss': '$color: green; .box { color: $color; }',
			'_variables.scss': '$accent: #c00;'
		}, 'App.vue', {});
		await vi.waitFor(() => {
			expect(store.files['src/theme.scss'].compiled.css).toContain('color: green');
			expect(store.files['src/App.vue'].compiled.css).toContain('color: green');
		});
		expect(store.files['src/App.vue'].compiled.css).not.toContain('#c00');
	});

	it('puts invalid standalone scss into store errors', async () => {
		const store = createRuntimeStore({
			'App.vue': '<template><div /></template>',
			'theme.scss': 'INVALID'
		}, 'App.vue', {});
		await vi.waitFor(() => {
			expect(store.errors.map(String).join('\n')).toContain('expected sass error');
		});
	});

	it('creates an importer that loads relative playground files', () => {
		const importer = createPlaygroundImporter(() => ({
			'src/_variables.scss': '$accent: #c00;',
			'src/vars.scss': '$a: 1;'
		}));
		const url = importer.canonicalize('./_variables.scss', {
			fromImport: false,
			containingUrl: new URL('docs-playground:///src/App.vue')
		});
		expect(url?.href).toContain('_variables.scss');
		expect(importer.load(url!)?.contents).toContain('$accent');
		expect(importer.canonicalize('https://cdn.example/a.scss', {
			fromImport: false,
			containingUrl: null
		})).toBeNull();
		expect(importer.load(new URL('docs-playground:///src/missing.scss'))).toBeNull();
		const parent = importer.canonicalize('../vars.scss', {
			fromImport: false,
			containingUrl: new URL('docs-playground:///src/nested/App.vue')
		});
		expect(parent?.pathname).toContain('vars.scss');
	});

	it('maps object file records and index stylesheets', () => {
		expect(filesNeedScss({ 'App.vue': { code: vueWithScss } })).toBe(true);
		expect(toPlaygroundFileMap({ 'theme.scss': { code: '.a{}' } })).toEqual({
			'theme.scss': '.a{}'
		});
		expect(resolvePlaygroundStylesheet(
			{ 'src/tokens/index.scss': '$a: 1;' },
			'src/tokens'
		)).toBe('src/tokens/index.scss');
		expect(() => resolvePlaygroundStylesheet({
			'src/foo.scss': '',
			'src/foo.sass': ''
		}, 'src/foo')).toThrow(/Ambiguous/);
	});

	it('skips standalone compile when sass is not loaded', () => {
		setSassLoader();
		expect(applyStandaloneScss({
			mainFile: 'src/App.vue',
			errors: [],
			files: {}
		})).toEqual([]);
	});

	it('wraps vue compiler parse for scss style blocks', async () => {
		await loadSass();
		const wrapped = wrapCompiler(
			{ parse } as never,
			() => ({ 'src/App.vue': vueWithScss })
		);
		const rewritten = wrapped.parse(vueWithScss, { filename: 'src/App.vue' });
		expect(rewritten.errors).toEqual([]);
		expect(rewritten.descriptor.styles[0].lang).toBeFalsy();
		expect(wrapped.parse(vueWithScss).descriptor.styles[0].lang).toBeFalsy();
		expect(wrapCompiler(wrapped, () => ({}))).toBe(wrapped);

		const failed = wrapped.parse(
			'<template><div /></template>\n<style lang="scss">INVALID</style>',
			{ filename: 'src/App.vue' }
		);
		expect(String(failed.errors[0])).toContain('expected sass error');
	});

	it('reports a missing sass compiler from wrapped parse', () => {
		setSassLoader();
		const wrapped = wrapCompiler({ parse } as never, () => ({}));
		const result = wrapped.parse(vueWithScss, { filename: 'src/App.vue' });
		expect(String(result.errors.at(-1))).toContain('compiler is not loaded');
	});

	it('ignores invalid importer urls and missing style tags', () => {
		const importer = createPlaygroundImporter(() => ({ 'src/theme.scss': '.a{}' }));
		expect(importer.canonicalize('docs-playground://[', {
			fromImport: false,
			containingUrl: null
		})).toBeNull();
		const { errors } = rewriteVueSfcStyles(
			'<style lang="scss">.a{}</style>',
			'src/App.vue',
			() => ({
				descriptor: {
					styles: [{
						lang: 'scss',
						content: '.a{}',
						loc: { start: { offset: 0 }, end: { offset: 0 } }
					}]
				},
				errors: []
			}),
			createFakeSass(),
			{}
		);
		expect(errors[0]).toContain('unable to locate <style> opening tag');
	});

	it('loads sass when setFiles later adds scss', async () => {
		const store = createRuntimeStore(
			{ 'App.vue': '<template><div class="box" /></template>' },
			'App.vue',
			{}
		);
		expect(loads).toBe(0);
		await store.setFiles({
			'App.vue': '<template><p class="box">x</p></template>',
			'theme.scss': '$c: navy; .box { color: $c; }'
		}, 'App.vue');
		expect(loads).toBe(1);
		await vi.waitFor(() => {
			expect(store.files['src/theme.scss'].compiled.css).toContain('color: navy');
		});
	});
});
