import { omitRouteQuery } from '../src/utils/query';

describe('omitRouteQuery', () => {
	it('drops the listed keys while preserving the rest', () => {
		expect(omitRouteQuery({ tab: 'android', preview: '1', q: 'x' }, ['tab'])).toEqual({
			preview: '1',
			q: 'x'
		});
		expect(omitRouteQuery({ tab: 'android' }, ['tab'])).toEqual({});
	});
});
