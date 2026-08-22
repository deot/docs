// @vitest-environment jsdom

import 'fake-indexeddb/auto';
import { Gateway } from '../src/modules/gateway';
import { Resource } from '../src/modules/resource';

describe('resource manager', () => {
	it('provides all public resource managers from one instance', () => {
		expect(Resource.gateway).toBe(Gateway);
		expect(Resource.plan).toBeDefined();
		expect(Resource.prefetch).toBeDefined();
		expect(Resource.playground).toBeDefined();
	});
});
