// @vitest-environment jsdom

import {
	buildOutlineTree,
	capOutlineMaxHeight,
	collectOutlineHeadings,
	findActiveOutlineId,
	getOutlineHeadingTitle,
	matchOutlineHeadingId,
	OUTLINE_CHROME,
	resolveOutlineScrollerHeight
} from '../src/utils/outline';

const heading = (html: string) => {
	const root = document.createElement('div');
	root.innerHTML = html;
	return root.firstElementChild as HTMLElement;
};

describe('page outline helpers', () => {
	it('strips header anchors from heading titles', () => {
		expect(getOutlineHeadingTitle(heading(
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
		expect(collectOutlineHeadings(root).map(item => item.id)).toEqual(['pseudo', 'hover']);
		expect(collectOutlineHeadings(null)).toEqual([]);
	});

	it('omits the page h1 when section headings exist', () => {
		const root = document.createElement('div');
		root.innerHTML = `
			<h1 id="title">Title</h1>
			<h2 id="one">One</h2>
			<h3 id="two">Two</h3>
		`;
		expect(collectOutlineHeadings(root).map(item => item.id)).toEqual(['one', 'two']);
		const onlyTitle = document.createElement('div');
		onlyTitle.innerHTML = '<h1 id="title">Title</h1>';
		expect(collectOutlineHeadings(onlyTitle).map(item => item.id)).toEqual(['title']);
	});

	it('builds a nested outline tree by heading level', () => {
		expect(buildOutlineTree([
			{ id: 'a', level: 2, text: 'A' },
			{ id: 'b', level: 3, text: 'B' },
			{ id: 'c', level: 3, text: 'C' },
			{ id: 'd', level: 2, text: 'D' }
		])).toEqual([
			{
				id: 'a',
				level: 2,
				text: 'A',
				children: [
					{ id: 'b', level: 3, text: 'B', children: [] },
					{ id: 'c', level: 3, text: 'C', children: [] }
				]
			},
			{ id: 'd', level: 2, text: 'D', children: [] }
		]);
	});

	it('matches encoded hashes to heading ids', () => {
		expect(matchOutlineHeadingId('#%E5%9F%BA%E6%9C%AC', ['%E5%9F%BA%E6%9C%AC']))
			.toBe('%E5%9F%BA%E6%9C%AC');
		expect(matchOutlineHeadingId('#details', ['details'])).toBe('details');
		expect(matchOutlineHeadingId('#missing', ['details'])).toBe('');
	});

	it('picks the last heading above the scroll threshold', () => {
		const first = heading('<h2 id="one">One</h2>');
		const second = heading('<h3 id="two">Two</h3>');
		vi.spyOn(first, 'getBoundingClientRect').mockReturnValue({ top: 10 } as DOMRect);
		vi.spyOn(second, 'getBoundingClientRect').mockReturnValue({ top: 120 } as DOMRect);
		const headings = [
			{ id: 'one', element: first },
			{ id: 'two', element: second }
		];
		expect(findActiveOutlineId(headings, { threshold: 80 })).toBe('one');
		expect(findActiveOutlineId(headings, { threshold: 80, isScrollEnd: true })).toBe('two');
		expect(findActiveOutlineId([], { threshold: 80 })).toBe('');
	});

	it('caps outline height to the shorter of article and content viewport', () => {
		expect(capOutlineMaxHeight(400, 800)).toBe(400);
		expect(capOutlineMaxHeight(4000, 800)).toBe(800);
		expect(capOutlineMaxHeight(0, 800)).toBe(800);
		expect(capOutlineMaxHeight(400, 0)).toBe(400);
	});

	it('resolves outline scroller height without exceeding the chrome-free track', () => {
		expect(OUTLINE_CHROME).toBe(172);
		expect(resolveOutlineScrollerHeight(800, 200)).toBe(200);
		expect(resolveOutlineScrollerHeight(800, 900)).toBe(628);
		expect(resolveOutlineScrollerHeight(100, 200)).toBe(0);
		expect(resolveOutlineScrollerHeight(200, 0)).toBe(28);
		expect(resolveOutlineScrollerHeight(800, 0)).toBe(48);
	});
});
