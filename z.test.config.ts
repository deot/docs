import { defineConfig, mergeConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import vueJsx from '@vitejs/plugin-vue-jsx';
import { fileURLToPath } from 'node:url';
import sharedConfig from './node_modules/@deot/dev-tester/shared.config.ts';

export default mergeConfig(sharedConfig, defineConfig({
	plugins: [vue(), vueJsx()],
	test: {
		// 单元测试不依赖工作区聚合 CSS 产物，各包构建仍校验真实样式。
		alias: [{
			find: /^.*\/node_modules\/@deot\/docs-(?:renderer|markdown|playground)\/dist\/index\.style\.css$/,
			replacement: fileURLToPath(new URL('./packages/client/__tests__/fixtures/styles.css', import.meta.url))
		}],
		setupFiles: [fileURLToPath(new URL('./z.test.setup.ts', import.meta.url))],
		// Client 从主包导入 playground 时会带上 @vue/repl 的 CSS，需交给 Vite 转译。
		server: {
			deps: {
				inline: [/@vue\/repl/]
			}
		},
		coverage: {
			reporter: ['text', 'html', 'json'],
			exclude: [
				'packages/cli/src/**',
				'packages/dever/src/**'
			]
		}
	}
}));
