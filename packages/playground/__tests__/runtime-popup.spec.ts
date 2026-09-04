// @vitest-environment jsdom

import {
	PLAYGROUND_POPUP_HEADER_HEIGHT,
	PLAYGROUND_POPUP_SCREEN_GAP,
	getWindowInnerSize,
	resolvePopupLayout,
	resolvePopupRequestedSize
} from '../src/core/runtime/alone/layout';

describe('runtime popup layout', () => {
	it('uses a tunable screen gap for unset viewport edges', () => {
		expect(PLAYGROUND_POPUP_SCREEN_GAP).toBe(40);
		expect(getWindowInnerSize()).toEqual({
			width: window.innerWidth,
			height: window.innerHeight
		});
		expect(resolvePopupRequestedSize('auto', { width: 1200, height: 800 })).toEqual({
			width: 1160,
			height: 760,
			maxWidth: 1160,
			maxHeight: 760
		});
		expect(resolvePopupRequestedSize('auto', { width: 1200, height: 800 }, 24)).toEqual({
			width: 1176,
			height: 776,
			maxWidth: 1176,
			maxHeight: 776
		});
	});

	it('prefers explicit viewport width and height when present', () => {
		expect(resolvePopupRequestedSize(375, { width: 1200, height: 800 })).toEqual({
			width: 375,
			height: 760,
			maxWidth: 1160,
			maxHeight: 760
		});
		expect(resolvePopupRequestedSize([375, 667], { width: 1200, height: 800 })).toEqual({
			width: 375,
			height: 667,
			maxWidth: 1160,
			maxHeight: 760
		});
	});

	it('caps the shell and keeps an oversized canvas for scrolling', () => {
		const layout = resolvePopupLayout([1400, 900], { width: 1000, height: 700 });
		expect(layout).toEqual({
			shellWidth: 960,
			shellHeight: 660,
			bodyHeight: 660 - PLAYGROUND_POPUP_HEADER_HEIGHT,
			canvasWidth: 1400,
			canvasHeight: 900,
			needsScrollX: true,
			needsScrollY: true
		});
	});

	it('fills the popup body when viewport size is unset', () => {
		const layout = resolvePopupLayout('auto', { width: 1200, height: 800 });
		expect(layout.shellWidth).toBe(1160);
		expect(layout.shellHeight).toBe(760);
		expect(layout.canvasWidth).toBe(1160);
		expect(layout.canvasHeight).toBe(760 - PLAYGROUND_POPUP_HEADER_HEIGHT);
		expect(layout.needsScrollX).toBe(false);
		expect(layout.needsScrollY).toBe(false);
	});

	it('keeps a width-only viewport filled to the remaining popup height', () => {
		const layout = resolvePopupLayout(375, { width: 1200, height: 800 });
		expect(layout.shellWidth).toBe(375);
		expect(layout.shellHeight).toBe(760);
		expect(layout.canvasWidth).toBe(375);
		expect(layout.canvasHeight).toBe(760 - PLAYGROUND_POPUP_HEADER_HEIGHT);
		expect(layout.needsScrollX).toBe(false);
		expect(layout.needsScrollY).toBe(false);
	});

	it('scrolls when a fixed canvas is taller than the popup body', () => {
		const layout = resolvePopupLayout([375, 667], { width: 1200, height: 800 });
		expect(layout.shellWidth).toBe(375);
		expect(layout.shellHeight).toBe(667);
		expect(layout.canvasWidth).toBe(375);
		expect(layout.canvasHeight).toBe(667);
		expect(layout.needsScrollX).toBe(false);
		expect(layout.needsScrollY).toBe(true);
	});
});
