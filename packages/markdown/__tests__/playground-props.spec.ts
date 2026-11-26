import { mergePreviewVariablesByName, resolvePlaygroundProps } from '../src/playground-props';
import type { PlaygroundPreviewVariable } from '@deot/docs-playground';

const rem: PlaygroundPreviewVariable = { name: '--rem', values: ['auto', '0.5px'], default: '0.5px' };
const gap: PlaygroundPreviewVariable = { name: '--gap', values: ['8px', '16px'] };

describe('playground props', () => {
	const site = {
		previewInset: 16,
		views: ['runtime', 'files'],
		mobileDefaults: {
			previewInset: [12, 0],
			previewVariables: [rem]
		}
	} as const;

	it('keeps the shallow site merge for desktop blocks', () => {
		expect(resolvePlaygroundProps(site as never, { title: 'desktop' })).toEqual({
			previewInset: 16,
			views: ['runtime', 'files'],
			title: 'desktop'
		});
		expect(resolvePlaygroundProps(undefined, { previewInset: 4 })).toEqual({ previewInset: 4 });
		expect(resolvePlaygroundProps(site as never, [] as never)).not.toHaveProperty('mobileDefaults');
	});

	it('applies mobileDefaults only to mobile blocks and lets the block win', () => {
		expect(resolvePlaygroundProps(site as never, { mobile: true })).toEqual({
			previewInset: [12, 0],
			views: ['runtime', 'files'],
			previewVariables: [rem],
			mobile: true
		});
		expect(resolvePlaygroundProps(site as never, { mobile: 480, previewInset: 0 }).previewInset).toBe(0);
		expect(resolvePlaygroundProps({ ...site, mobile: true } as never, {}).previewVariables).toEqual([rem]);
		expect(resolvePlaygroundProps(site as never, { mobile: true, styleless: true }).previewInset).toBe(16);
	});

	it('merges previewVariables by name and clears them with an empty array', () => {
		const custom = { name: '--rem', values: ['1px'] };
		expect(resolvePlaygroundProps(site as never, { mobile: true, previewVariables: [gap] }).previewVariables)
			.toEqual([rem, gap]);
		expect(resolvePlaygroundProps(site as never, { mobile: true, previewVariables: [gap, custom] as never }).previewVariables)
			.toEqual([custom, gap]);
		expect(resolvePlaygroundProps(site as never, { mobile: true, previewVariables: [] }).previewVariables)
			.toEqual([]);
		// 普通站点默认值与块之间仍整体替换。
		expect(resolvePlaygroundProps({ previewVariables: [rem] } as never, { previewVariables: [gap] }).previewVariables)
			.toEqual([gap]);
	});

	it('falls back to site previewVariables as the mobile base', () => {
		expect(resolvePlaygroundProps({
			previewVariables: [rem],
			mobileDefaults: { previewInset: [12, 0] }
		} as never, { mobile: true, previewVariables: [gap] }).previewVariables).toEqual([rem, gap]);
		expect(mergePreviewVariablesByName(undefined, [gap])).toEqual([gap]);
	});
});
