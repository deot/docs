// @vitest-environment jsdom
import { forgetPreviewActivity, getActivePreview, markPreviewActive, trackPreviewActivity } from '../src/core/runtime/local/activity';
import { createPreviewOverlay, PREVIEW_ADOPTED_ATTR } from '../src/core/runtime/local/overlay';

const flush = () => new Promise(resolve => setTimeout(resolve, 0));

describe('local preview overlay', () => {
	afterEach(() => {
		forgetPreviewActivity('one');
		forgetPreviewActivity('two');
		vi.useRealTimers();
	});

	it('tracks the most recently used preview inside a time window', () => {
		const root = document.createElement('div');
		const stop = trackPreviewActivity('one', root);
		expect(getActivePreview()).toBeUndefined();
		root.dispatchEvent(new Event('pointerdown'));
		expect(getActivePreview()).toBe('one');
		markPreviewActive('two');
		expect(getActivePreview()).toBe('two');
		expect(getActivePreview(-1)).toBeUndefined();
		stop();
		forgetPreviewActivity('two');
		expect(getActivePreview()).toBeUndefined();
	});

	it('adopts body nodes added while its preview is active and removes them on teardown', async () => {
		const element = document.createElement('div');
		const overlay = createPreviewOverlay({ scope: 'one', element });
		overlay.updateVars({ '--rem': '0.5px' });

		const idle = document.createElement('div');
		document.body.appendChild(idle);
		await flush();
		expect(idle.hasAttribute(PREVIEW_ADOPTED_ATTR)).toBe(false);

		markPreviewActive('one');
		const popup = document.createElement('div');
		const docsPopup = document.createElement('div');
		docsPopup.className = 'docs-search';
		document.body.append(popup, docsPopup);
		await flush();
		expect(popup.getAttribute(PREVIEW_ADOPTED_ATTR)).toBe('one');
		expect(popup.getAttribute('data-playground-scope')).toBe('one');
		expect(popup.style.getPropertyValue('--rem')).toBe('0.5px');
		expect(docsPopup.hasAttribute(PREVIEW_ADOPTED_ATTR)).toBe(false);

		overlay.updateVars({ '--vc-rem': '1px' });
		expect(popup.style.getPropertyValue('--rem')).toBe('');
		expect(popup.style.getPropertyValue('--vc-rem')).toBe('1px');

		markPreviewActive('two');
		const other = document.createElement('div');
		document.body.appendChild(other);
		await flush();
		expect(other.hasAttribute(PREVIEW_ADOPTED_ATTR)).toBe(false);

		element.appendChild(document.createElement('span'));
		overlay.teardown();
		expect(popup.isConnected).toBe(false);
		expect(element.children).toHaveLength(0);
		expect(idle.isConnected).toBe(true);
		overlay.dispose();
		[idle, docsPopup, other].forEach(node => node.remove());
	});

	it('runs the adapter once per setup and reports adapter errors', () => {
		const element = document.createElement('div');
		const onError = vi.fn();
		const cleanup = vi.fn(() => { throw new Error('cleanup'); });
		const overlay = createPreviewOverlay({
			scope: 'one',
			element,
			adapter: { setup: context => (context.element === element ? cleanup : undefined) },
			onError
		});
		overlay.setup({ vue: {} });
		overlay.teardown();
		expect(cleanup).toHaveBeenCalledTimes(1);
		expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'cleanup' }));
		overlay.teardown();
		expect(cleanup).toHaveBeenCalledTimes(1);
		createPreviewOverlay({ scope: 'two', element }).setup({});
		overlay.dispose();
	});
});
