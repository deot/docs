import { defineConfig, mergeConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import vueJsx from '@vitejs/plugin-vue-jsx';
import sharedConfig from './node_modules/@deot/dev-tester/shared.config.ts';

export default mergeConfig(sharedConfig, defineConfig({
	plugins: [vue(), vueJsx()],
	test: {
		coverage: {
			exclude: [
				'packages/cli/src/**',
				'packages/dever/src/**'
			]
		}
	}
}));
