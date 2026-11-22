// @vitest-environment jsdom

import {
	isNarrowPlayground,
	LOCAL_MOBILE_VC_REM,
	resolvePlaygroundMobilePreviewWidth
} from '../src/core/runtime/mobile';
import {
	applyPreviewRootVars,
	normalizePreviewVariables,
	resolvePreviewRootVars
} from '../src/core/runtime/preview-variables';

describe('preview variables', () => {
	it('drops invalid variable declarations', () => {
		expect(normalizePreviewVariables([
			{ name: 'rem', values: ['0.5px'] },
			{ name: '--pad', values: [] },
			{ name: '--gap', values: ['8px', '8px', '12px'], default: 'missing', label: ' 间距 ' },
			{ name: '--gap', values: ['1px'] }
		])).toEqual([{
			name: '--gap',
			label: '间距',
			values: ['8px', '12px'],
			value: '8px'
		}]);
	});

	it('rewrites --vc-rem when --rem is set and clears both for iframe auto', () => {
		const active = resolvePreviewRootVars(
			[{ name: '--rem', value: '0.5px' }, { name: '--pad', value: '8px' }],
			{ local: false, mobile: true }
		);
		expect(active.set).toEqual({
			'--pad': '8px',
			'--rem': '0.5px',
			'--vc-rem': 'var(--rem)'
		});

		const auto = resolvePreviewRootVars(
			[{ name: '--rem', value: 'auto' }, { name: '--pad', value: 'auto' }],
			{ local: false, mobile: true }
		);
		expect(auto.set).toEqual({});
		expect(auto.remove).toEqual(expect.arrayContaining(['--rem', '--vc-rem', '--pad']));
	});

	it('keeps an explicit --vc-rem and uses the column width for local auto', () => {
		expect(resolvePreviewRootVars(
			[{ name: '--vc-rem', value: '1px' }, { name: '--rem', value: '0.5px' }],
			{ local: true, mobile: true }
		).set).toEqual({
			'--rem': '0.5px',
			'--vc-rem': '1px'
		});

		expect(resolvePreviewRootVars([], { local: true, mobile: true }).set['--vc-rem'])
			.toBe(LOCAL_MOBILE_VC_REM);
		expect(resolvePreviewRootVars([], { local: true, mobile: false }).set).toEqual({});
		expect(resolvePreviewRootVars(
			[{ name: '--rem', value: 'auto' }],
			{ local: false, mobile: false }
		).set).toEqual({});
	});

	it('writes and removes inline custom properties', () => {
		const element = document.createElement('div');
		applyPreviewRootVars(element, {
			set: { '--rem': '0.5px', '--vc-rem': 'var(--rem)' },
			remove: ['--pad']
		});
		element.style.setProperty('--pad', '8px');
		applyPreviewRootVars(element, {
			set: { '--vc-rem': LOCAL_MOBILE_VC_REM },
			remove: ['--rem', '--pad']
		});
		expect(element.style.getPropertyValue('--rem')).toBe('');
		expect(element.style.getPropertyValue('--pad')).toBe('');
		expect(element.style.getPropertyValue('--vc-rem')).toBe(LOCAL_MOBILE_VC_REM);
	});

	it('treats an unmeasured width as wide and falls back to 375', () => {
		expect(isNarrowPlayground(0)).toBe(false);
		expect(isNarrowPlayground(719)).toBe(true);
		expect(isNarrowPlayground(720)).toBe(false);
		expect(resolvePlaygroundMobilePreviewWidth('auto')).toBe(375);
		expect(resolvePlaygroundMobilePreviewWidth([320, 500])).toBe(320);
	});
});
