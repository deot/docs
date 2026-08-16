import { defineConfig, mergeConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import vueJsx from '@vitejs/plugin-vue-jsx';
import { fileURLToPath } from 'node:url';
import sharedConfig from './node_modules/@deot/dev-tester/shared.config.ts';

export default mergeConfig(sharedConfig, defineConfig({
	plugins: [vue(), vueJsx()],
	resolve: {
		alias: {
			// 跨包测试必须读取当前 Renderer 源码，避免命中上一次构建遗留的 dist。
			'@deot/docs-renderer': fileURLToPath(new URL('./packages/renderer/src/index.ts', import.meta.url)),
			'@deot/docs-locale': fileURLToPath(new URL('./packages/locale/src/index.ts', import.meta.url))
		}
	},
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
