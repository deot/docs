import { Dever } from '@deot/docs';

// @vitest-environment node
describe('index.ts', () => {
	it('any', () => {
		expect(typeof Dever).toBe('object');
	});
});
