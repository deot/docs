import { jsonFieldPolicy, jsonPathPattern } from '../src/editor/json/policy';

describe('page JSON field policy', () => {
	it('locks protocol identity and required structure', () => {
		expect(jsonPathPattern(['blocks', 0, 'module', 'type'])).toBe('blocks/*/module/type');
		expect(jsonFieldPolicy([], 'object')).toMatchObject({
			keyLocked: true,
			removable: false,
			kindLocked: true,
			valueLocked: false,
			canAddChild: false
		});
		expect(jsonFieldPolicy(['schemaVersion'], 'number')).toMatchObject({
			keyLocked: true,
			removable: false,
			kindLocked: true,
			valueLocked: true
		});
		expect(jsonFieldPolicy(['layout', 'mode'], 'string')).toMatchObject({
			keyLocked: true,
			removable: false,
			kindLocked: true,
			valueLocked: true
		});
		expect(jsonFieldPolicy(['meta'], 'object')).toMatchObject({
			keyLocked: true,
			removable: false,
			kindLocked: true,
			canAddChild: false
		});
		expect(jsonFieldPolicy(['meta', 'id'], 'string')).toMatchObject({
			keyLocked: true,
			removable: false,
			kindLocked: true,
			valueLocked: false
		});
		expect(jsonFieldPolicy(['blocks'], 'array')).toMatchObject({
			keyLocked: true,
			removable: false,
			kindLocked: true,
			canAddChild: true
		});
		expect(jsonFieldPolicy(['blocks', 0], 'object')).toMatchObject({
			keyLocked: false,
			removable: true,
			kindLocked: true,
			canAddChild: false
		});
		expect(jsonFieldPolicy(['blocks', 0, 'id'], 'string')).toMatchObject({
			keyLocked: true,
			removable: false
		});
		expect(jsonFieldPolicy(['blocks', 0, 'appearance', 'marginTop'], 'number')).toMatchObject({
			keyLocked: true,
			removable: false,
			kindLocked: true
		});
		expect(jsonFieldPolicy(['blocks', 1, 'placement', 'width'], 'number')).toMatchObject({
			keyLocked: true,
			removable: false
		});
	});

	it('only lets arrays grow and only array items be removed', () => {
		expect(jsonFieldPolicy(['meta', 'title'], 'string')).toMatchObject({
			keyLocked: true,
			removable: false,
			kindLocked: true,
			valueLocked: false
		});
		expect(jsonFieldPolicy(['layout', 'minHeight'], 'number')).toMatchObject({
			keyLocked: true,
			removable: false,
			kindLocked: true,
			valueLocked: false
		});
		expect(jsonFieldPolicy(['meta', 'extra'], 'object')).toMatchObject({
			keyLocked: true,
			removable: false,
			canAddChild: false,
			kindLocked: true
		});
		expect(jsonFieldPolicy(['meta', 'extra', 'array'], 'array')).toMatchObject({
			keyLocked: true,
			removable: false,
			canAddChild: true,
			kindLocked: true
		});
		expect(jsonFieldPolicy(['meta', 'extra', 'array', 0], 'string')).toMatchObject({
			keyLocked: false,
			removable: true,
			kindLocked: true
		});
		expect(jsonFieldPolicy(['blocks', 0, 'module', 'props', 'text'], 'string')).toMatchObject({
			keyLocked: true,
			removable: false,
			kindLocked: true,
			valueLocked: false
		});
		expect(jsonFieldPolicy(['blocks', 0, 'module', 'props', 'items'], 'array')).toMatchObject({
			canAddChild: true,
			keyLocked: true,
			removable: false
		});
		expect(jsonFieldPolicy(['blocks', 0, 'module', 'props', 'items', 1], 'object')).toMatchObject({
			canAddChild: false,
			removable: true,
			kindLocked: true
		});
	});
});
