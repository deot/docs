import {
	containGroupTranslation,
	containRotatedPlacement,
	resizeRotatedPlacement,
	rotatedBounds,
	snapPlacementToGuides,
	transformPoint
} from '../src/frame/draggable/geometry';
import { invalid } from './fixtures';

const placement = { x: 100, y: 80, width: 240, height: 120, rotate: 37, zIndex: 1 };

describe('draggable geometry', () => {
	it('computes arbitrary-angle bounds', () => {
		const bounds = rotatedBounds(placement);
		expect(bounds.right).toBeGreaterThan(bounds.left);
		expect(bounds.bottom).toBeGreaterThan(bounds.top);
	});

	it('keeps the opposite anchor stable for all eight handles', () => {
		for (const handle of ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'] as const) {
			const next = resizeRotatedPlacement(placement, handle, { x: 410, y: 260 }, { minWidth: 20, minHeight: 20 });
			expect(next.width).toBeGreaterThanOrEqual(20);
			expect(next.height).toBeGreaterThanOrEqual(20);
			expect(next.rotate).toBe(37);
		}
	});

	it('transforms points using DOMMatrix-compatible math', () => {
		vi.stubGlobal('DOMPoint', class {
			x: number;
			y: number;
			constructor(x: number, y: number) {
				this.x = x;
				this.y = y;
			}

			matrixTransform(matrix: { x: number; y: number }) {
				return { x: this.x + matrix.x, y: this.y + matrix.y };
			}
		});
		const matrix = invalid<DOMMatrixReadOnly>({ inverse: () => ({ x: 10, y: 20 }) });
		expect(transformPoint({ x: 2, y: 3 }, matrix)).toEqual({ x: 12, y: 23 });
	});

	it('keeps rotated nodes inside the canvas and centers oversized bounds', () => {
		const contained = containRotatedPlacement({
			...placement,
			x: -80,
			y: -50,
			rotate: 45
		}, 600, 400);
		const bounds = rotatedBounds(contained);
		expect(bounds.left).toBeGreaterThanOrEqual(-0.001);
		expect(bounds.top).toBeGreaterThanOrEqual(-0.001);
		expect(bounds.right).toBeLessThanOrEqual(600.001);
		expect(bounds.bottom).toBeLessThanOrEqual(400.001);

		const oversized = containRotatedPlacement({
			x: 0,
			y: 0,
			width: 800,
			height: 500,
			rotate: 0,
			zIndex: 1
		}, 600, 400);
		expect(oversized.x).toBe(-100);
		expect(oversized.y).toBe(-50);
	});

	it('keeps multi-selection spacing while constraining one shared translation', () => {
		const placements = [{
			x: 10, y: 10, width: 80, height: 40, rotate: 0, zIndex: 1
		}, {
			x: 200, y: 120, width: 80, height: 40, rotate: 0, zIndex: 2
		}];
		expect(containGroupTranslation(placements, { x: 100, y: 100 }, 300, 180))
			.toEqual({ x: 20, y: 20 });
		expect(containGroupTranslation(placements, { x: -100, y: -100 }, 300, 180))
			.toEqual({ x: -10, y: -10 });
		expect(containGroupTranslation([], { x: 12, y: 24 }, 300, 180))
			.toEqual({ x: 12, y: 24 });
	});

	it('uses the declared aspect ratio while respecting size limits', () => {
		const next = resizeRotatedPlacement(placement, 'se', { x: 700, y: 500 }, {
			aspectRatio: 1,
			minWidth: 40,
			minHeight: 40,
			maxWidth: 300,
			maxHeight: 300
		});
		expect(next.width).toBeCloseTo(next.height);
		expect(next.width).toBeLessThanOrEqual(300);
		expect(next.height).toBeLessThanOrEqual(300);
	});

	it('snaps placement edges to user guides and canvas reference lines', () => {
		const nearGuide = snapPlacementToGuides(
			{ x: 48, y: 38, width: 100, height: 80, rotate: 0, zIndex: 1 },
			[50, 600, 1200],
			[40, 400, 800],
			5
		);
		expect(nearGuide).toEqual({ dx: 2, dy: 2, guideX: [50], guideY: [40] });

		const nearCenter = snapPlacementToGuides(
			{ x: 545, y: 355, width: 100, height: 80, rotate: 0, zIndex: 1 },
			[0, 600, 1200],
			[0, 400, 800],
			5
		);
		expect(nearCenter.dx).toBe(5);
		expect(nearCenter.dy).toBe(5);
		expect(nearCenter.guideX).toEqual([600]);
		expect(nearCenter.guideY).toEqual([400]);

		const rightEdge = snapPlacementToGuides(
			{ x: 1196, y: 10, width: 40, height: 40, rotate: 0, zIndex: 1 },
			[0, 600, 1200],
			[],
			5
		);
		expect(rightEdge.dx).toBe(4);
		expect(rightEdge.guideX).toEqual([1200]);
		expect(rightEdge.dy).toBe(0);
		expect(rightEdge.guideY).toEqual([]);

		const miss = snapPlacementToGuides(
			{ x: 10, y: 10, width: 40, height: 40, rotate: 0, zIndex: 1 },
			[100],
			[100],
			5
		);
		expect(miss).toEqual({ dx: 0, dy: 0, guideX: [], guideY: [] });
	});
});
