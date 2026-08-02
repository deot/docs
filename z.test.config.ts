import { mergeConfig, defineConfig } from 'vitest/config';
import type { UserConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import configShared from './node_modules/@deot/dev-tester/shared.config.ts';

const config: UserConfig = mergeConfig(
	configShared,
	defineConfig({
		plugins: [vue()],
		test: {
			coverage: {
				provider: 'istanbul',
				// DOM 操作（会出现异常）和命令行操作不收集依赖
				exclude: [
					`packages/cli/src/**/*.ts`,
					`packages/*er/src/**/*.ts`
				]
			}
		}
	})
);

export default config;
