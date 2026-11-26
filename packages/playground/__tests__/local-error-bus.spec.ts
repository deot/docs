// @vitest-environment jsdom
import { forgetPreviewActivity, markPreviewActive } from '../src/core/runtime/local/activity';
import { registerPreviewErrors } from '../src/core/runtime/local/error-bus';
import { compilePlayground } from '../src/core/runtime/local/compile';
import { linkPlayground } from '../src/core/runtime/local/linker';

const rejection = (reason: unknown) => {
	const event = new Event('unhandledrejection') as PromiseRejectionEvent;
	Object.defineProperty(event, 'reason', { value: reason });
	window.dispatchEvent(event);
};

describe('local error bus', () => {
	afterEach(() => {
		forgetPreviewActivity('one');
		forgetPreviewActivity('two');
	});

	it('routes errors by source URL, then by the active preview', () => {
		const original = console.error;
		const silent = vi.fn();
		console.error = silent;
		const one = vi.fn();
		const two = vi.fn();
		const stopOne = registerPreviewErrors('one', one);
		const stopTwo = registerPreviewErrors('two', two);
		try {
			const owned = new Error('owned');
			owned.stack = 'Error: owned\n    at docs-playground://two/App.vue:3:7';
			rejection(owned);
			expect(two).toHaveBeenCalledWith('Unhandled rejection: owned');

			rejection(new Error('nobody'));
			expect(one).not.toHaveBeenCalled();

			markPreviewActive('one');
			rejection(new Error('recent'));
			rejection(undefined);
			expect(one).toHaveBeenCalledWith('Unhandled rejection: recent');
			expect(one).toHaveBeenCalledTimes(1);

			console.error('failed', { message: 'inner' });
			expect(silent).toHaveBeenCalledWith('failed', { message: 'inner' });
			expect(one).toHaveBeenLastCalledWith('console.error: failed inner');

			window.dispatchEvent(new ErrorEvent('error', { message: 'thrown', error: new Error('thrown') }));
			expect(one).toHaveBeenLastCalledWith('thrown');
		} finally {
			stopOne();
			expect(console.error).not.toBe(silent);
			stopTwo();
			expect(console.error).toBe(silent);
			console.error = original;
		}
	});

	it('tags linked modules with a per-preview source URL', async () => {
		const files = {
			'App.vue': '<script>export default { stack: new Error("x").stack };</script><template><p /></template>'
		};
		const compiled = await compilePlayground(files, 'App.vue');
		const linked = linkPlayground(compiled, files, { sourceScope: 'scope-1' });
		expect(String((linked.component as { stack: string }).stack)).toContain('docs-playground://scope-1/');
	});
});
