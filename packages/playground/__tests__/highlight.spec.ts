import hljs from 'highlight.js';
import {
	highlightCode,
	highlightCodeByLanguage,
	registerVueHighlight,
	resolveHighlightLanguage
} from '../src/highlight';

describe('playground highlight', () => {
	it.each([
		['App.vue', 'vue'],
		['main.js', 'javascript'],
		['main.jsx', 'javascript'],
		['main.ts', 'typescript'],
		['main.tsx', 'typescript'],
		['index.html', 'xml'],
		['style.css', 'css'],
		['style.scss', 'scss'],
		['theme.sass', 'scss'],
		['data.json', 'json'],
		['README.txt', 'plaintext']
	])('maps %s to %s', (filename, language) => {
		expect(resolveHighlightLanguage(filename)).toBe(language);
	});

	it('registers Vue on independent highlight instances', () => {
		const instance = hljs.newInstance();
		expect(instance.getLanguage('vue')).toBeUndefined();
		registerVueHighlight(instance);
		expect(instance.getLanguage('vue')).toBeDefined();
		registerVueHighlight(instance);
		expect(instance.getLanguage('vue')).toBeDefined();
	});

	it('highlights and safely escapes source code', () => {
		const result = highlightCode('<template><script>alert(1)</script></template>', 'App.vue');
		expect(result).toContain('hljs-tag');
		expect(result).toContain('&lt;');
		expect(result).toContain('&gt;');
		expect(result).not.toContain('<script>');
	});

	it('highlights explicit languages and normalizes indentation tabs', () => {
		const result = highlightCodeByLanguage('\tconst value: number = 1', 'typescript');
		expect(result).toContain('    ');
		expect(result).not.toContain('\t');
		expect(result).toContain('hljs-keyword');
	});

	it('falls back to escaped text when highlighting fails', () => {
		const spy = vi.spyOn(hljs, 'highlight').mockImplementationOnce(() => {
			throw new Error('highlight failed');
		});
		expect(highlightCode('<script>"unsafe"</script>', 'main.js'))
			.toBe('&lt;script&gt;&quot;unsafe&quot;&lt;/script&gt;');
		spy.mockRestore();
	});
});
