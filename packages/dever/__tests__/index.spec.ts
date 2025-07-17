import * as Dever from '@deot/docs-dever';

// @vitest-environment node
describe('index', () => {
	it('run', async () => {
		expect(typeof Dever.run).toBe('function');
	});
});
