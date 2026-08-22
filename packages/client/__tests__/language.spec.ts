// @vitest-environment jsdom

import 'fake-indexeddb/auto';
import { Settings } from '../src/modules/settings';
import { createDocsConfig } from './fixtures/docs';

describe('docs language settings', () => {
	const namespace = 'language-settings';
	const config = createDocsConfig({
		namespace,
		locales: {
			'zh-CN': { label: '简体中文' },
			'en-US': { label: 'English' }
		}
	});

	afterEach(async () => Settings.remove(namespace, 'language'));

	it('persists and restores a configured language', async () => {
		await Settings.language.persist(config, 'en-US');
		expect(await Settings.language.restore(config)).toBe('en-US');
	});

	it('ignores languages that are not configured', async () => {
		await Settings.set(namespace, 'language', 'fr-FR');
		expect(await Settings.language.restore(config)).toBeUndefined();

		await Settings.set(namespace, 'language', 'en-US');
		await Settings.language.persist(config, 'fr-FR');
		expect(await Settings.get(namespace, 'language')).toBe('en-US');
	});
});
