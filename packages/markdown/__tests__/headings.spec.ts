// @vitest-environment jsdom

import { collectMarkdownHeadings, getMarkdownHeadingTitle } from '../src/headings';

const heading = (html: string) => {
	const root = document.createElement('div');
	root.innerHTML = html;
	return root.firstElementChild as HTMLElement;
};

describe('markdown headings', () => {
	it('strips header anchors from heading titles', () => {
		expect(getMarkdownHeadingTitle(heading(
			'<h2 id="one"><a class="header-anchor" href="#one">#</a> Hover states</h2>'
		))).toBe('Hover states');
	});

	it('collects nested headings and skips playground or code titles', () => {
		const root = document.createElement('div');
		root.innerHTML = `
			<h2 id="pseudo"><a class="header-anchor" href="#pseudo">#</a> Pseudo-classes</h2>
			<h3 id="hover">:hover</h3>
			<pre><h4 id="code">Code title</h4></pre>
			<div data-playground data-code="x"><h3 id="play">Playground</h3></div>
			<h2 id="empty"><a class="header-anchor" href="#empty">#</a></h2>
		`;
		expect(collectMarkdownHeadings(root).map(item => item.id)).toEqual(['pseudo', 'hover']);
		expect(collectMarkdownHeadings(null)).toEqual([]);
	});

	it('omits the page h1 when section headings exist', () => {
		const root = document.createElement('div');
		root.innerHTML = `
			<h1 id="title">Title</h1>
			<h2 id="one">One</h2>
			<h3 id="two">Two</h3>
		`;
		expect(collectMarkdownHeadings(root).map(item => item.id)).toEqual(['one', 'two']);
		const onlyTitle = document.createElement('div');
		onlyTitle.innerHTML = '<h1 id="title">Title</h1>';
		expect(collectMarkdownHeadings(onlyTitle).map(item => item.id)).toEqual(['title']);
	});
});
