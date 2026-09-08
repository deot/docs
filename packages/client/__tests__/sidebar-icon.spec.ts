import {
	pickSidebarIconValue,
	resolveSidebarIconKind,
	toSidebarIconSrc
} from '../src/utils/sidebar-icon';

describe('sidebar icon helpers', () => {
	it('classifies url, path, base64 and type icons', () => {
		expect(resolveSidebarIconKind('https://example.com/a.svg')).toBe('url');
		expect(resolveSidebarIconKind('./icons/a.svg')).toBe('url');
		expect(resolveSidebarIconKind('/icons/a.svg')).toBe('url');
		expect(resolveSidebarIconKind('data:image/png;base64,abc')).toBe('url');
		expect(resolveSidebarIconKind('iVBORw0KGgoAAA')).toBe('url');
		expect(resolveSidebarIconKind('folder')).toBe('type');
		expect(resolveSidebarIconKind('')).toBe('none');
	});

	it('picks normal or selected values from tuples', () => {
		expect(pickSidebarIconValue('folder', false)).toBe('folder');
		expect(pickSidebarIconValue(['a', 'b'], false)).toBe('a');
		expect(pickSidebarIconValue(['a', 'b'], true)).toBe('b');
		expect(pickSidebarIconValue(['a', ''], true)).toBe('a');
	});

	it('normalizes raw base64 into a data URL', () => {
		expect(toSidebarIconSrc('iVBORw0KGgoAAA')).toBe('data:image/png;base64,iVBORw0KGgoAAA');
		expect(toSidebarIconSrc('https://example.com/a.svg')).toBe('https://example.com/a.svg');
	});
});
