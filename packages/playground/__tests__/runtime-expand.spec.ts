// @vitest-environment jsdom

import { MIN_RUNTIME_HEIGHT } from '../src/core/runtime/auto-height';
import {
	PLAYGROUND_EXPAND_VIEWPORT_GAP,
	findScrollableAncestor,
	getVisibleViewportRect,
	getWindowInnerHeight,
	isPlaygroundExpandEnabled,
	resolveExpandedPreviewHeight,
	resolveRemainingPreviewHeight,
	scrollPlaygroundToViewportStart
} from '../src/core/runtime/expand';

const mockRect = (top: number, height: number): DOMRect => ({
	x: 0,
	y: top,
	top,
	left: 0,
	right: 0,
	bottom: top + height,
	width: 0,
	height,
	toJSON: () => ({})
});

describe('runtime preview expand', () => {
	it('enables expand only for true or a positive number', () => {
		expect(isPlaygroundExpandEnabled(undefined)).toBe(false);
		expect(isPlaygroundExpandEnabled(false)).toBe(false);
		expect(isPlaygroundExpandEnabled(0)).toBe(false);
		expect(isPlaygroundExpandEnabled(-1)).toBe(false);
		expect(isPlaygroundExpandEnabled('auto')).toBe(false);
		expect(isPlaygroundExpandEnabled(true)).toBe(true);
		expect(isPlaygroundExpandEnabled(600)).toBe(true);
	});

	it('resolves remaining viewport height and expanded targets', () => {
		expect(resolveRemainingPreviewHeight({
			viewportHeight: 800,
			chromeHeight: 72
		})).toBe(800 - 72 - PLAYGROUND_EXPAND_VIEWPORT_GAP);
		expect(resolveRemainingPreviewHeight({
			viewportHeight: 800,
			chromeHeight: 44
		})).toBe(800 - 44 - PLAYGROUND_EXPAND_VIEWPORT_GAP);
		expect(resolveRemainingPreviewHeight({
			viewportHeight: Number.NaN,
			chromeHeight: Number.NaN,
			gap: Number.NaN
		})).toBe(0);

		expect(resolveExpandedPreviewHeight(true, 540)).toBe(540);
		expect(resolveExpandedPreviewHeight(true, 20)).toBe(MIN_RUNTIME_HEIGHT);
		expect(resolveExpandedPreviewHeight(true, 0)).toBe(MIN_RUNTIME_HEIGHT);
		expect(resolveExpandedPreviewHeight(true, 2000)).toBe(2000);
		expect(resolveExpandedPreviewHeight(600, 400)).toBe(600);
		expect(resolveExpandedPreviewHeight(10, 400)).toBe(MIN_RUNTIME_HEIGHT);
	});

	it('caps expand:true to the available viewport instead of content height', () => {
		expect(resolveExpandedPreviewHeight(true, 960)).toBe(960);
	});

	it('reads the current window height', () => {
		Object.defineProperty(window, 'innerHeight', { configurable: true, value: 880 });
		expect(getWindowInnerHeight()).toBe(880);
	});

	it('uses nested scrollports instead of the window when the page does not scroll', () => {
		Object.defineProperty(window, 'innerHeight', { configurable: true, value: 1080 });
		const scroller = document.createElement('div');
		const playground = document.createElement('div');
		playground.className = 'docs-playground';
		scroller.append(playground);
		document.body.append(scroller);
		Object.defineProperty(scroller, 'scrollHeight', { configurable: true, value: 2000 });
		Object.defineProperty(scroller, 'clientHeight', { configurable: true, value: 1020 });
		vi.spyOn(window, 'getComputedStyle').mockImplementation((el) => {
			if (el === scroller) {
				return { overflowY: 'auto' } as CSSStyleDeclaration;
			}
			return { overflowY: 'visible' } as CSSStyleDeclaration;
		});
		vi.spyOn(scroller, 'getBoundingClientRect').mockReturnValue(mockRect(60, 1020));

		expect(getVisibleViewportRect(playground)).toEqual({
			top: 60,
			bottom: 1080,
			height: 1020
		});
		expect(findScrollableAncestor(playground)).toBe(scroller);
		scroller.remove();
		vi.restoreAllMocks();
	});

	it('scrolls the nested scroller so the playground sits at the top', () => {
		const scroller = document.createElement('div');
		const playground = document.createElement('div');
		playground.className = 'docs-playground';
		scroller.append(playground);
		document.body.append(scroller);
		scroller.scrollTop = 400;
		Object.defineProperty(scroller, 'scrollHeight', { configurable: true, value: 2000 });
		Object.defineProperty(scroller, 'clientHeight', { configurable: true, value: 1020 });
		vi.spyOn(window, 'getComputedStyle').mockImplementation((el) => {
			if (el === scroller) {
				return { overflowY: 'auto' } as CSSStyleDeclaration;
			}
			return { overflowY: 'visible' } as CSSStyleDeclaration;
		});
		vi.spyOn(scroller, 'getBoundingClientRect').mockReturnValue(mockRect(60, 1020));
		vi.spyOn(playground, 'getBoundingClientRect').mockReturnValue(mockRect(200, 80));

		scrollPlaygroundToViewportStart(playground);
		expect(scroller.scrollTop).toBe(540);
		scroller.remove();
		vi.restoreAllMocks();
	});

	it('falls back to scrollIntoView when there is no scroll parent', () => {
		const playground = document.createElement('div');
		playground.className = 'docs-playground';
		const scrollIntoView = vi.fn();
		playground.scrollIntoView = scrollIntoView;
		document.body.append(playground);
		vi.spyOn(window, 'getComputedStyle').mockReturnValue({ overflowY: 'visible' } as CSSStyleDeclaration);

		scrollPlaygroundToViewportStart(playground);
		expect(scrollIntoView).toHaveBeenCalledWith({ block: 'start', behavior: 'auto' });
		playground.remove();
		vi.restoreAllMocks();
	});
});
