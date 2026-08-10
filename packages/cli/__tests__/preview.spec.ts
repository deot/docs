import { resolve } from 'node:path';
import { Command } from '@deot/dev-test';

describe('preview.ts', () => {
	it('doc preview', async () => {
		expect.hasAssertions();
		const instance = new Command(
			'cross-env NODE_ENV=UNIT tsx',
			[
				resolve(__dirname, '../src/index.ts'),
				'preview',
				'--dry-run'
			]
		);

		await instance.stop();

		expect(instance.code).toBe(0);
		expect(instance.stdout.includes('preview')).toBe(true);
		expect(instance.stderr).toBe('');
	}, 60000);
});
