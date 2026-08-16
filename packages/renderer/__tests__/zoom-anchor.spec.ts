// @vitest-environment jsdom

import { captureZoomAnchor, restoreZoomAnchor } from '../src/frame/shared/zoom-anchor';

const rect = (left: number, top: number, width: number, height: number): DOMRect => ({
	left,
	top,
	width,
	height,
	right: left + width,
	bottom: top + height,
	x: left,
	y: top,
	toJSON: () => ({})
});

describe('zoom anchor', () => {
	it('keeps the selected node at the same screen position', () => {
		const wrapper = document.createElement('div');
		const canvas = document.createElement('div');
		const selected = document.createElement('div');
		document.body.appendChild(wrapper);
		wrapper.appendChild(canvas);
		canvas.appendChild(selected);
		wrapper.scrollLeft = 120;
		wrapper.scrollTop = 80;
		vi.spyOn(wrapper, 'getBoundingClientRect').mockReturnValue(rect(0, 0, 600, 400));
		vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue(rect(50, 40, 800, 600));
		const selectedRect = vi.spyOn(selected, 'getBoundingClientRect')
			.mockReturnValue(rect(140, 120, 200, 100));
		const anchor = captureZoomAnchor(wrapper, canvas, selected);

		selectedRect.mockReturnValue(rect(260, 210, 300, 150));
		restoreZoomAnchor(wrapper, anchor);
		expect(wrapper.scrollLeft).toBe(290);
		expect(wrapper.scrollTop).toBe(195);
		wrapper.remove();
	});

	it('keeps the viewport-center canvas point stable without a selection', () => {
		const wrapper = document.createElement('div');
		const canvas = document.createElement('div');
		document.body.appendChild(wrapper);
		wrapper.appendChild(canvas);
		wrapper.scrollLeft = 300;
		wrapper.scrollTop = 200;
		vi.spyOn(wrapper, 'getBoundingClientRect').mockReturnValue(rect(0, 0, 600, 400));
		const canvasRect = vi.spyOn(canvas, 'getBoundingClientRect')
			.mockReturnValue(rect(100, 50, 1000, 800));
		const anchor = captureZoomAnchor(wrapper, canvas, null);

		canvasRect.mockReturnValue(rect(80, 40, 500, 400));
		restoreZoomAnchor(wrapper, anchor);
		expect(wrapper.scrollLeft).toBe(180);
		expect(wrapper.scrollTop).toBe(115);
		wrapper.remove();
	});

	it('ignores missing and detached anchors', () => {
		const wrapper = document.createElement('div');
		const canvas = document.createElement('div');
		expect(captureZoomAnchor(null, canvas, null)).toBeNull();
		expect(captureZoomAnchor(wrapper, null, null)).toBeNull();
		restoreZoomAnchor(wrapper, null);
		expect(wrapper.scrollTop).toBe(0);
	});
});
