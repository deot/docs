import {
	hasIndependentRendererCorners,
	pickRendererCornerRadii,
	rendererBorderRadiusStyle,
	resolveRendererCornerRadii
} from '../src/utils/radius';

describe('renderer corner radius', () => {
	it('resolves uniform and independent corners into CSS', () => {
		expect(hasIndependentRendererCorners({ borderRadius: 8 })).toBe(false);
		expect(resolveRendererCornerRadii({ borderRadius: 8 })).toEqual({
			topLeft: 8,
			topRight: 8,
			bottomRight: 8,
			bottomLeft: 8
		});
		expect(rendererBorderRadiusStyle({ borderRadius: 0 })).toEqual({});
		expect(rendererBorderRadiusStyle({ borderRadius: 8 })).toEqual({
			borderRadius: '8px',
			overflow: 'hidden'
		});
		expect(rendererBorderRadiusStyle({
			borderRadiusTopLeft: 4,
			borderRadiusTopRight: 8,
			borderRadiusBottomRight: 12,
			borderRadiusBottomLeft: 2
		})).toEqual({
			borderRadius: '4px 8px 12px 2px',
			overflow: 'hidden'
		});
		expect(pickRendererCornerRadii({
			borderRadius: 8,
			marginTop: 1
		})).toEqual({ borderRadius: 8 });
	});
});
