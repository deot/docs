import {
	rendererSortableAssignedWidth,
	rendererSortableContentCssWidth,
	rendererSortableContentWidth,
	rendererSortableFillsCanvas,
	rendererSortableItemStyle,
	rendererSortableMaxWidth,
	rendererSortableSectionStyle
} from '../src';

describe('sortable width helpers', () => {
	it('lets the instance override the module fill default', () => {
		expect(rendererSortableFillsCanvas()).toBe(false);
		expect(rendererSortableFillsCanvas({ fullWidth: true })).toBe(true);
		expect(rendererSortableFillsCanvas({ fullWidth: true }, { fullWidth: false })).toBe(false);
		expect(rendererSortableFillsCanvas({ fullWidth: false }, { fullWidth: true })).toBe(true);
	});

	it('only constrains modules when the instance sets a max width', () => {
		expect(rendererSortableAssignedWidth()).toBeUndefined();
		expect(rendererSortableAssignedWidth({ maxWidth: 720 })).toBe(720);
		expect(rendererSortableAssignedWidth({ maxWidth: 0 })).toBeUndefined();
		expect(rendererSortableContentWidth({ fullWidth: true, maxWidth: 960 })).toBeUndefined();
		expect(rendererSortableContentWidth({ fullWidth: true, maxWidth: 960 }, { maxWidth: 720 })).toBe(720);
		expect(rendererSortableContentWidth({ maxWidth: 960 })).toBeUndefined();
		expect(rendererSortableContentWidth()).toBeUndefined();
		expect(rendererSortableContentWidth({ maxWidth: 960 }, { maxWidth: 0 })).toBeUndefined();
		expect(rendererSortableContentWidth({ fullWidth: true }, { maxWidth: 0 })).toBeUndefined();
		expect(rendererSortableContentCssWidth({ fullWidth: true })).toBe('100%');
		expect(rendererSortableContentCssWidth({ fullWidth: true }, { maxWidth: 1200 })).toBe('1200px');
		expect(rendererSortableContentCssWidth({ maxWidth: 960 }, { maxWidth: 0 })).toBe('100%');
		expect(rendererSortableMaxWidth({ fullWidth: true }, { maxWidth: 720 })).toBeUndefined();
		expect(rendererSortableMaxWidth({ maxWidth: 960 })).toBeUndefined();
		expect(rendererSortableMaxWidth({ maxWidth: 960 }, { maxWidth: 0 })).toBeUndefined();
		expect(rendererSortableMaxWidth({ maxWidth: 960 }, { maxWidth: 720 })).toBe(720);
	});

	it('puts vertical margins on the combo item and stretches full-width modules', () => {
		const appearance = { marginTop: 16, marginBottom: 24, paddingTop: 0, paddingBottom: 0 };
		expect(rendererSortableItemStyle({ fullWidth: true }, appearance)).toEqual({
			'marginTop': '16px',
			'marginBottom': '24px',
			'marginLeft': '0px',
			'marginRight': '0px',
			'--docs-renderer-content-width': '100%',
			'width': '100%',
			'maxWidth': 'none'
		});
		expect(rendererSortableItemStyle({ fullWidth: true }, { ...appearance, maxWidth: 1200 })).toEqual({
			'marginTop': '16px',
			'marginBottom': '24px',
			'marginLeft': '0px',
			'marginRight': '0px',
			'--docs-renderer-content-width': '1200px',
			'width': '100%',
			'maxWidth': 'none'
		});
		expect(rendererSortableItemStyle({ maxWidth: 720 }, appearance)).toEqual({
			'marginTop': '16px',
			'marginBottom': '24px',
			'marginLeft': 'auto',
			'marginRight': 'auto',
			'--docs-renderer-content-width': '100%',
			'width': '100%',
			'maxWidth': 'none'
		});
		expect(rendererSortableItemStyle({}, appearance)).toEqual({
			'marginTop': '16px',
			'marginBottom': '24px',
			'marginLeft': 'auto',
			'marginRight': 'auto',
			'--docs-renderer-content-width': '100%',
			'width': '100%',
			'maxWidth': 'none'
		});
		expect(rendererSortableItemStyle({ maxWidth: 720 }, { ...appearance, maxWidth: 0 })).toEqual({
			'marginTop': '16px',
			'marginBottom': '24px',
			'marginLeft': 'auto',
			'marginRight': 'auto',
			'--docs-renderer-content-width': '100%',
			'width': '100%',
			'maxWidth': 'none'
		});
		expect(rendererSortableItemStyle({ maxWidth: 720 }, { ...appearance, maxWidth: 720 })).toEqual({
			'marginTop': '16px',
			'marginBottom': '24px',
			'marginLeft': 'auto',
			'marginRight': 'auto',
			'--docs-renderer-content-width': '720px',
			'maxWidth': '720px'
		});
	});

	it('pins section content to the inherited max width variable', () => {
		expect(rendererSortableSectionStyle()).toEqual({
			width: '100%',
			maxWidth: 'var(--docs-renderer-content-width, 100%)',
			marginInline: 'auto'
		});
		expect(rendererSortableSectionStyle('#873bf4')).toEqual({
			'width': '100%',
			'maxWidth': 'var(--docs-renderer-content-width, 100%)',
			'marginInline': 'auto',
			'--docs-renderer-accent': '#873bf4'
		});
	});
});
