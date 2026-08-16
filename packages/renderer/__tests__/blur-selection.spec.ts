// @vitest-environment jsdom

import { deactivateRendererSelection, shouldKeepRendererSelection } from '../src/frame/shared/blur-selection';

describe('renderer selection blur', () => {
	it('keeps the current module when the pointer is on chrome that edits it', () => {
		const node = document.createElement('div');
		node.dataset.rendererNodeId = 'a';
		expect(shouldKeepRendererSelection(node)).toBe(true);
		expect(shouldKeepRendererSelection(document.createElement('div'))).toBe(false);
	});

	it('blurs the inspector input then clears the selection', () => {
		const editor = document.createElement('div');
		editor.className = 'docs-renderer-editor';
		const input = document.createElement('input');
		editor.appendChild(input);
		document.body.appendChild(editor);
		input.focus();
		const blur = vi.spyOn(input, 'blur');
		const store = { select: vi.fn() };
		const event = new Event('pointerdown') as PointerEvent;
		Object.defineProperty(event, 'button', { value: 0 });
		Object.defineProperty(event, 'target', { value: document.createElement('div') });
		expect(deactivateRendererSelection(store, event)).toBe(true);
		expect(blur).toHaveBeenCalled();
		expect(store.select).toHaveBeenCalledWith(null);
		editor.remove();
	});

	it('ignores non-primary buttons and inspector chrome', () => {
		const store = { select: vi.fn() };
		const right = new Event('pointerdown') as PointerEvent;
		Object.defineProperty(right, 'button', { value: 2 });
		Object.defineProperty(right, 'target', { value: document.createElement('div') });
		expect(deactivateRendererSelection(store, right)).toBe(false);

		const editor = document.createElement('aside');
		editor.className = 'docs-renderer-editor';
		const left = new Event('pointerdown') as PointerEvent;
		Object.defineProperty(left, 'button', { value: 0 });
		Object.defineProperty(left, 'target', { value: editor });
		expect(deactivateRendererSelection(store, left)).toBe(false);
		expect(store.select).not.toHaveBeenCalled();
	});
});
