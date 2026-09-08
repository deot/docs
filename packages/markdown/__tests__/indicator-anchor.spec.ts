import {
	capIndicatorMaxHeight,
	capStickyAvailableHeight,
	findActiveMinimapIndex,
	getIndicatorInlineOffset,
	getMinimapPointerRatio,
	getMinimapWindow,
	isMinimapMarkerInView
} from '../src/indicator-anchor';

describe('indicator rail anchor', () => {
	it('pins the left indicator beside the start rail with a gap', () => {
		expect(getIndicatorInlineOffset(
			{ left: 200, right: 800, width: 600, height: 0 },
			{ left: 40, right: 80, width: 40, height: 800 },
			'left',
			40
		)).toBe(-112);
	});

	it('pins the right indicator beside the end rail with a gap', () => {
		expect(getIndicatorInlineOffset(
			{ left: 200, right: 800, width: 600, height: 0 },
			{ left: 840, right: 880, width: 40, height: 800 },
			'right',
			40
		)).toBe(592);
	});

	it('falls back when the layout rail is missing or hidden', () => {
		expect(getIndicatorInlineOffset(
			{ left: 200, right: 800, width: 600, height: 0 },
			undefined,
			'left',
			40
		)).toBeUndefined();
		expect(getIndicatorInlineOffset(
			{ left: 200, right: 800, width: 600, height: 0 },
			{ left: 0, right: 0, width: 0, height: 0 },
			'right',
			40
		)).toBeUndefined();
	});

	it('caps indicator height like the page outline', () => {
		expect(capIndicatorMaxHeight(500, 800)).toBe(500);
		expect(capIndicatorMaxHeight(1200, 900)).toBe(900);
		expect(capIndicatorMaxHeight(0, 720)).toBe(720);
		expect(capIndicatorMaxHeight(640, 0)).toBe(640);
	});

	it('shrinks sticky height so the minimap stays above the parent bottom', () => {
		expect(capStickyAvailableHeight(900, 420)).toBe(420);
		expect(capStickyAvailableHeight(900, Number.POSITIVE_INFINITY)).toBe(900);
		expect(capStickyAvailableHeight(900, -80)).toBe(0);
		expect(capStickyAvailableHeight(200, 800)).toBe(200);
	});

	it('maps the main scroller to a minimap window', () => {
		expect(getMinimapWindow(0, 600, 1200)).toEqual({ height: 0.5, top: 0 });
		expect(getMinimapWindow(300, 600, 1200)).toEqual({ height: 0.5, top: 0.25 });
		expect(getMinimapWindow(600, 600, 1200)).toEqual({ height: 0.5, top: 0.5 });
		expect(getMinimapWindow(0, 800, 400)).toEqual({ height: 1, top: 0 });
		expect(getMinimapWindow(10, 0, 0)).toEqual({ height: 1, top: 0 });
	});

	it('maps pointer Y onto the minimap track', () => {
		expect(getMinimapPointerRatio(150, 100, 200)).toBe(0.25);
		expect(getMinimapPointerRatio(50, 100, 200)).toBe(0);
		expect(getMinimapPointerRatio(400, 100, 200)).toBe(1);
		expect(getMinimapPointerRatio(120, 100, 0)).toBe(0);
	});

	it('picks the current minimap tick from the visible window', () => {
		const ratios = [0, 0.1, 0.5, 0.8];
		expect(findActiveMinimapIndex(ratios, 0, 0.5)).toBe(0);
		expect(findActiveMinimapIndex(ratios, 0.12, 0.5)).toBe(1);
		expect(findActiveMinimapIndex(ratios, 0.5, 0.5)).toBe(3);
		expect(findActiveMinimapIndex([], 0, 1)).toBe(-1);
		expect(isMinimapMarkerInView(0.2, 0, 0.5)).toBe(true);
		expect(isMinimapMarkerInView(0.8, 0, 0.5)).toBe(false);
	});
});
