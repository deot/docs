import { defineConfig, mergeConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import vueJsx from '@vitejs/plugin-vue-jsx';
import { fileURLToPath } from 'node:url';
import sharedConfig from './node_modules/@deot/dev-tester/shared.config.ts';

export default mergeConfig(sharedConfig, defineConfig({
	plugins: [vue(), vueJsx()],
	test: {
		setupFiles: [fileURLToPath(new URL('./z.test.setup.ts', import.meta.url))],
		coverage: {
			reporter: ['text', 'html', 'json'],
			exclude: [
				'packages/cli/src/**',
				'packages/dever/src/**'
			]
		}
	}
}));
