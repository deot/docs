import * as Dever from '../src';

// @vitest-environment node
describe('index', () => {
	it('exports run', () => {
		expect(Dever.run).toBeTypeOf('function');
	});
});
