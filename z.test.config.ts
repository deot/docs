import { mergeConfig, defineConfig } from 'vitest/config';
import type { UserConfig } from 'vite';
import configShared from './node_modules/@deot/dev-tester/shared.config';

const config: UserConfig = mergeConfig(
	configShared,
	defineConfig({
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
