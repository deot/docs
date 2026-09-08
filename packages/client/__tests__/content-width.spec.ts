// @vitest-environment jsdom

import 'fake-indexeddb/auto';
import { ContentWidth, ContentWidthRuntime, Settings } from '../src/modules/settings';
import { createDocsConfig } from './fixtures/docs';

const createConfig = (namespace: string) => createDocsConfig({
	locales: { 'en-US': { label: 'English' } },
	namespace
});

describe('docs content width settings', () => {
	let stop = () => {};

	afterEach(async () => {
		stop();
		stop = () => {};
		await Settings.remove('width-a', 'contentWidth');
		await Settings.remove('width-b', 'contentWidth');
		await Settings.remove('width-restore-race', 'contentWidth');
		await Settings.remove('width-invalid', 'contentWidth');
	});

	it('defaults to wide and persists the selected width by namespace', async () => {
		stop = ContentWidthRuntime.start(createConfig('width-a'));
		expect(ContentWidth.current.value).toBe('wide');
		await ContentWidth.set('regular');
		expect(ContentWidth.current.value).toBe('regular');
		expect(await Settings.get('width-a', 'contentWidth')).toBe('regular');
		await ContentWidth.set('full');
		expect(await Settings.get('width-a', 'contentWidth')).toBe('full');
		stop();

		stop = ContentWidthRuntime.start(createConfig('width-a'));
		await vi.waitFor(() => expect(ContentWidth.current.value).toBe('full'));
	});

	it('isolates stored widths by namespace', async () => {
		await Settings.set('width-a', 'contentWidth', 'wide');
		await Settings.set('width-b', 'contentWidth', 'full');
		stop = ContentWidthRuntime.start(createConfig('width-b'));
		await vi.waitFor(() => expect(ContentWidth.current.value).toBe('full'));
	});

	it('ignores unknown width values', async () => {
		await Settings.set('width-invalid', 'contentWidth', 'compact');
		stop = ContentWidthRuntime.start(createConfig('width-invalid'));
		await ContentWidth.set('regular');
		await ContentWidth.set('invalid' as 'regular');
		expect(ContentWidth.current.value).toBe('regular');
		expect(await Settings.get('width-invalid', 'contentWidth')).toBe('regular');
	});

	it('does not let a delayed restore override a new user selection', async () => {
		const namespace = 'width-restore-race';
		let resolveStored!: (value: unknown) => void;
		const stored = new Promise<unknown>((resolve) => {
			resolveStored = resolve;
		});
		const get = vi.spyOn(Settings, 'get').mockReturnValueOnce(stored);
		stop = ContentWidthRuntime.start(createConfig(namespace));
		await ContentWidth.set('regular');
		resolveStored('full');
		await stored;
		await Promise.resolve();
		expect(ContentWidth.current.value).toBe('regular');
		get.mockRestore();
	});
});
