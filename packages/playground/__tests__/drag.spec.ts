// @vitest-environment jsdom

import { Drag } from '../src/editor/drag';

describe('Drag', () => {
	const makeElement = () => {
		const el = document.createElement('div');
		Object.defineProperties(el, { offsetWidth: { value: 100 }, offsetHeight: { value: 80 } });
		document.body.appendChild(el);
		return el;
	};

	it('requires a handle element', () => {
		expect(() => new Drag()).toThrow('必传');
	});

	it('moves within the container bounds and detaches listeners', () => {
		const el = makeElement();
		const remove = vi.spyOn(el, 'removeEventListener');
		const drag = new Drag({ el, wrapper: el, container: { innerWidth: 300, innerHeight: 200 } });

		drag.handleStart({ preventDefault: vi.fn(), touches: [{ clientX: 100, clientY: 100 }] });
		drag.handleMove({ preventDefault: vi.fn(), touches: [{ clientX: -500, clientY: -500 }] });
		expect(el.style.right).toBe('200px');
		expect(el.style.bottom).toBe('120px');

		drag.handleEnd();
		drag.handleMove({ preventDefault: vi.fn(), touches: [{ clientX: 0, clientY: 0 }] });
		drag.off();
		expect(drag.flag).toBe(false);
		expect(remove).toHaveBeenCalled();
	});

	it('clamps negative positions and respects auto offsets', () => {
		const el = makeElement();
		el.style.right = 'auto';
		el.style.bottom = 'auto';
		const drag = new Drag({ el, wrapper: el, container: { clientWidth: 400, clientHeight: 300 } });
		drag.handleStart({ preventDefault: vi.fn(), touches: [{ clientX: 0, clientY: 0 }] });
		drag.handleMove({ preventDefault: vi.fn(), touches: [{ clientX: 100, clientY: 100 }] });
		expect(el.style.right).toBe('0px');
		expect(el.style.bottom).toBe('0px');
		drag.handleEnd();
	});
});
