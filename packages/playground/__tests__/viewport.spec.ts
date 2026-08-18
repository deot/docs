import {
	DEFAULT_VIEWPORT_OPTIONS,
	formatViewportLabel,
	includeActiveViewport,
	isValidViewport,
	normalizeViewportOptions,
	resolveInitialViewport
} from '../src/core/runtime/viewport';

describe('playground viewport', () => {
	it('validates supported viewport values', () => {
		expect(isValidViewport('auto')).toBe(true);
		expect(isValidViewport(375)).toBe(true);
		expect(isValidViewport([375, 667])).toBe(true);
		expect(isValidViewport('mobile')).toBe(false);
		expect(isValidViewport(0)).toBe(false);
		expect(isValidViewport([375])).toBe(false);
		expect(isValidViewport([375, 0])).toBe(false);
	});

	it('normalizes defaults, invalid values, duplicates and empty options', () => {
		expect(normalizeViewportOptions()).toEqual(DEFAULT_VIEWPORT_OPTIONS);
		expect(normalizeViewportOptions([
			'auto', 0, 375, 375, [375, 667], [375, 667], 'mobile'
		])).toEqual(['auto', 375, [375, 667]]);
		expect(normalizeViewportOptions([])).toEqual([]);
	});

	it('resolves and includes the active viewport', () => {
		expect(resolveInitialViewport(undefined, ['auto', 375])).toBe('auto');
		expect(resolveInitialViewport([390, 700], ['auto', 375])).toEqual([390, 700]);
		expect(includeActiveViewport(['auto', 375], 390)).toEqual(['auto', 375, 390]);
		expect(includeActiveViewport([], 390)).toEqual([]);
	});

	it('formats menu labels', () => {
		expect(formatViewportLabel('auto')).toBe('Auto');
		expect(formatViewportLabel('auto', '自适应')).toBe('自适应');
		expect(formatViewportLabel(375)).toBe('375px');
		expect(formatViewportLabel([375, 667])).toBe('375 × 667px');
	});
});
