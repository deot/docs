import hljs from 'highlight.js';
import type { HLJSApi, LanguageFn } from 'highlight.js';

export const vueHighlight: LanguageFn = api => ({
	subLanguage: 'xml',
	contains: [
		api.COMMENT('<!--', '-->', {
			relevance: 10,
		}),
		{
			begin: /^(\s*)(<script>)/gm,
			end: /^(\s*)(<\/script>)/gm,
			subLanguage: 'javascript',
			excludeBegin: true,
			excludeEnd: true,
		},
		{
			begin: /^(?:\s*)(?:<script\s+lang=(["'])ts\1>)/gm,
			end: /^(\s*)(<\/script>)/gm,
			subLanguage: 'typescript',
			excludeBegin: true,
			excludeEnd: true,
		},
		{
			begin: /^(\s*)(<style(\s+scoped)?>)/gm,
			end: /^(\s*)(<\/style>)/gm,
			subLanguage: 'css',
			excludeBegin: true,
			excludeEnd: true,
		},
		{
			begin: /^(?:\s*)(?:<style(?:\s+scoped)?\s+lang=(["'])(?:s[ca]ss)\1(?:\s+scoped)?>)/gm,
			end: /^(\s*)(<\/style>)/gm,
			subLanguage: 'scss',
			excludeBegin: true,
			excludeEnd: true,
		},
		{
			begin: /^(?:\s*)(?:<style(?:\s+scoped)?\s+lang=(["'])stylus\1(?:\s+scoped)?>)/gm,
			end: /^(\s*)(<\/style>)/gm,
			subLanguage: 'stylus',
			excludeBegin: true,
			excludeEnd: true,
		}
	],
});

export const registerVueHighlight = (api: HLJSApi = hljs) => {
	if (!api.getLanguage('vue')) api.registerLanguage('vue', vueHighlight);
	return api;
};

export const resolveHighlightLanguage = (filename: string) => {
	if (/\.vue$/i.test(filename)) return 'vue';
	if (/\.tsx?$/i.test(filename)) return 'typescript';
	if (/\.jsx?$/i.test(filename)) return 'javascript';
	if (/\.html$/i.test(filename)) return 'xml';
	if (/\.css$/i.test(filename)) return 'css';
	if (/\.json$/i.test(filename)) return 'json';
	return 'plaintext';
};

const escapeHTML = (code: string) => code
	.replace(/&/g, '&amp;')
	.replace(/</g, '&lt;')
	.replace(/>/g, '&gt;')
	.replace(/"/g, '&quot;')
	.replace(/'/g, '&#039;');

export const highlightCode = (code: string, filename: string) => {
	try {
		return registerVueHighlight().highlight(code, {
			language: resolveHighlightLanguage(filename),
			ignoreIllegals: true
		}).value;
	} catch {
		return escapeHTML(code);
	}
};
