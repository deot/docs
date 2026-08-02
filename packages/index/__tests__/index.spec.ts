import { Dever } from '../src';

// @vitest-environment node
describe('index.ts', () => {
	it('exports the dever API', () => {
		expect(Dever.run).toBeTypeOf('function');
	});
});
