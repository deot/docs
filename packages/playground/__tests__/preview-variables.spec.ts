// @vitest-environment jsdom

import {
	isNarrowPlayground,
	LOCAL_MOBILE_VC_REM,
	resolvePlaygroundMobilePreviewWidth
} from '../src/core/runtime/mobile';
import {
	applyPreviewRootVars,
	DEFAULT_PREVIEW_VARIABLE_LINKS,
	normalizePreviewVariableLinks,
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
			options: [{ label: '8px', value: '8px' }, { label: '12px', value: '12px' }],
			value: '8px'
		}]);
	});

	it('keeps labelled values and matches default by value', () => {
		const [rem] = normalizePreviewVariables([{
			name: '--rem',
			values: ['auto', { label: '375', value: '0.5px' }, { label: ' ', value: '0.64px' }, { label: 'x', value: '0.5px' }, { value: '' }],
			default: '0.5px'
		}]);
		expect(rem.values).toEqual(['auto', '0.5px', '0.64px']);
		expect(rem.options).toEqual([
			{ label: 'auto', value: 'auto' },
			{ label: '375', value: '0.5px' },
			{ label: '0.64px', value: '0.64px' }
		]);
		expect(rem.value).toBe('0.5px');
	});

	it('follows configured links and can turn them off', () => {
		const links = normalizePreviewVariableLinks([
			{ source: '--unit', target: '--lib-unit', auto: 'calc(100cqw / 375)' },
			{ source: '--bad', target: 'nope' } as never,
			{ source: '--same', target: '--same' }
		]);
		expect(links).toEqual([{ source: '--unit', target: '--lib-unit', auto: 'calc(100cqw / 375)' }]);
		expect(normalizePreviewVariableLinks(undefined)).toBe(DEFAULT_PREVIEW_VARIABLE_LINKS);
		expect(normalizePreviewVariableLinks(false)).toEqual([]);

		expect(resolvePreviewRootVars([{ name: '--unit', value: '2px' }], { local: false, mobile: false, links }).set)
			.toEqual({ '--unit': '2px', '--lib-unit': 'var(--unit)' });
		expect(resolvePreviewRootVars([], { local: true, mobile: true, links }).set)
			.toEqual({ '--lib-unit': 'calc(100cqw / 375)' });
		// 自定义联动不再改写 --vc-rem。
		expect(resolvePreviewRootVars([{ name: '--rem', value: '0.5px' }], { local: true, mobile: true, links }).set)
			.toEqual({ '--rem': '0.5px', '--lib-unit': 'calc(100cqw / 375)' });
		expect(resolvePreviewRootVars([{ name: '--rem', value: '0.5px' }], { local: true, mobile: true, links: [] }).set)
			.toEqual({ '--rem': '0.5px' });
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
