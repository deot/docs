import { Dever, Locale } from '../src';

// @vitest-environment node
describe('index.ts', () => {
	it('exports the dever API', () => {
		expect(Dever.run).toBeTypeOf('function');
		expect(Locale.resolveLocale('zh-CN').name).toBe('zh-CN');
	});
});
