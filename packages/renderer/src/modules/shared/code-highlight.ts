import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import json from 'highlight.js/lib/languages/json';
import xml from 'highlight.js/lib/languages/xml';
import css from 'highlight.js/lib/languages/css';
import bash from 'highlight.js/lib/languages/bash';

Object.entries({ javascript, typescript, json, xml, css, bash }).forEach(([name, language]) => hljs.registerLanguage(name, language));

export const highlightCode = (content: string, language: string) => (
	language && hljs.getLanguage(language)
		? hljs.highlight(content, { language, ignoreIllegals: true }).value
		: content.replace(/[&<>"']/gu, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' })[character]!)
);

/**
 * 保留多行注释、字符串和 HTML 内嵌脚本的高亮上下文，同时生成独立闭合的行。
 * @param content 完整源码。
 * @param language 高亮语言，未知语言按纯文本处理。
 * @returns 可独立渲染的安全 HTML 行。
 */
export const highlightCodeLines = (content: string, language: string): string[] => {
	const html = highlightCode(content.replace(/\r\n/gu, '\n'), language);
	const lines: string[] = [];
	const spans: string[] = [];
	let line = '';
	let offset = 0;
	for (const match of html.matchAll(/<span\b[^>]*>|<\/span>|\n/gu)) {
		line += html.slice(offset, match.index);
		const token = match[0];
		if (token === '\n') {
			lines.push(line + '</span>'.repeat(spans.length));
			line = spans.join('');
		} else {
			if (token === '</span>') spans.pop();
			else spans.push(token);
			line += token;
		}
		offset = match.index! + token.length;
	}
	lines.push(line + html.slice(offset));
	return lines;
};
