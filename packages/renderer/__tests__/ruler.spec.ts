// @vitest-environment jsdom

import { flushPromises, mount } from '@vue/test-utils';
import {
	RULER_SIZE,
	computeRulerCanvasLength,
	computeRulerInterval,
	paintRulerX,
	paintRulerY
} from '../src/frame/draggable/ruler-paint';
import * as RulerPaint from '../src/frame/draggable/ruler-paint';
import Ruler from '../src/frame/draggable/ruler.vue';
import GridLines from '../src/frame/draggable/grid-lines.vue';

const mockCanvas = () => {
	const texts: string[] = [];
	const ctx = {
		beginPath: vi.fn(),
		fillRect: vi.fn(),
		translate: vi.fn(),
		save: vi.fn(),
		restore: vi.fn(),
		fillText: (value: string) => texts.push(value),
		fillStyle: '',
		font: ''
	};
	let width = 0;
	let height = 0;
	const canvas = {
		get width() { return width; },
		set width(value: number) { width = value; },
		get height() { return height; },
		set height(value: number) { height = value; },
		getContext: (id: string) => id === '2d' ? ctx : null
	} as unknown as HTMLCanvasElement;
	return { canvas, ctx, texts };
};

describe('draggable ruler and grid', () => {
	it('computes tick interval and canvas length like vm-ruler', () => {
		expect(computeRulerInterval(0)).toBe(100);
		expect(computeRulerInterval(1)).toBe(100);
		expect(computeRulerInterval(0.1)).toBeGreaterThanOrEqual(60);
		expect(computeRulerInterval(0.1)).toBeLessThanOrEqual(100);
		expect(computeRulerInterval(2)).toBeGreaterThanOrEqual(60);
		expect(computeRulerInterval(2)).toBeLessThanOrEqual(100);
		expect(computeRulerCanvasLength({
			frameSize: 1200,
			scale: 1,
			clientSize: 400,
			scroll: 0,
			placeholder: RULER_SIZE
		})).toBe(5000);
	});

	it('paints both axes and ignores missing canvases', () => {
		paintRulerX(null, { length: 800, size: 20, placeholder: 20, interval: 100, scale: 1 });
		paintRulerY(null, { length: 800, size: 20, placeholder: 20, interval: 100, scale: 1 });
		const missing = { getContext: () => null } as unknown as HTMLCanvasElement;
		paintRulerX(missing, { length: 800, size: 20, placeholder: 20, interval: 100, scale: 1 });
		paintRulerY(missing, { length: 800, size: 20, placeholder: 20, interval: 100, scale: 1 });

		const x = mockCanvas();
		paintRulerX(x.canvas, {
			length: 800,
			size: 20,
			placeholder: 20,
			interval: 100,
			scale: 1,
			dark: true
		});
		expect(x.texts[0]).toBe('0');
		expect(x.ctx.fillRect).toHaveBeenCalled();

		const y = mockCanvas();
		paintRulerY(y.canvas, {
			length: 600,
			size: 20,
			placeholder: 20,
			interval: 80,
			scale: 2,
			dark: true
		});
		expect(y.texts.length).toBeGreaterThan(0);
	});

	it('renders ruler chrome and grid lines', async () => {
		const wrapper = mount(Ruler, {
			props: {
				scrollLeft: 12,
				scrollTop: 8,
				frameW: 1200,
				frameH: 800,
				clientW: 400,
				clientH: 300,
				scale: 1,
				originTitle: 'toggle'
			}
		});
		expect(wrapper.get('.docs-renderer-ruler__origin').attributes('title')).toBe('toggle');
		await wrapper.get('.docs-renderer-ruler__origin').trigger('click');
		expect(wrapper.emitted('toggle-guides')).toHaveLength(1);
		await wrapper.get('.docs-renderer-ruler--top').trigger('pointerdown');
		expect(wrapper.emitted('axis-pointerdown')?.[0]?.[1]).toBe('x');
		await wrapper.get('.docs-renderer-ruler--left').trigger('mousemove');
		expect(wrapper.emitted('axis-move')?.[0]?.[1]).toBe('y');
		await wrapper.get('.docs-renderer-ruler--left').trigger('mouseleave');
		expect(wrapper.emitted('axis-leave')).toHaveLength(1);
		await wrapper.setProps({
			scale: 1.5,
			scrollLeft: 40,
			showGuides: true,
			guideX: [120],
			guideY: [80],
			preview: { axis: 'x', value: 200 },
			deleteTitle: 'remove'
		});
		expect(wrapper.get('.docs-renderer-guide--vertical.is-user').text()).toBe('120');
		expect(wrapper.get('.docs-renderer-guide--horizontal.is-user').text()).toBe('80');
		expect(wrapper.get('.docs-renderer-guide.is-preview').text()).toBe('200');
		await wrapper.get('.docs-renderer-guide--vertical.is-user').trigger('pointerdown');
		expect(wrapper.emitted('guide-pointerdown')?.[0]?.slice(1)).toEqual(['x', 0]);
		await wrapper.get('.docs-renderer-guide--horizontal.is-user').trigger('dblclick');
		expect(wrapper.emitted('guide-dblclick')?.[0]).toEqual(['y', 0]);
		const paintSpy = vi.spyOn(RulerPaint, 'paintRulerX');
		paintSpy.mockClear();
		await wrapper.setProps({ dark: true });
		await flushPromises();
		expect(paintSpy).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({ dark: true })
		);
		paintSpy.mockRestore();
		await wrapper.setProps({ hidden: true });
		expect(wrapper.find('.docs-renderer-ruler__origin').exists()).toBe(false);
		expect(wrapper.find('.docs-renderer-ruler__slot').exists()).toBe(true);
		wrapper.unmount();

		const grid = mount(GridLines, { props: { width: 100, height: 50 } });
		expect(grid.findAll('.docs-renderer-grid-lines__x')).toHaveLength(10);
		expect(grid.findAll('.docs-renderer-grid-lines__y')).toHaveLength(5);
		await grid.setProps({ grid: [0, 0], width: 30, height: 30 });
		expect(grid.findAll('.docs-renderer-grid-lines__x')).toHaveLength(3);
		grid.unmount();
	});
});
