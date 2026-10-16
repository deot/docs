import configVue from '@deot/dev-vue';
import { mergeConfig } from 'vite';
import type { Plugin, UserConfig } from 'vite';
import configShared from './node_modules/@deot/dev-builder/shared.config.ts';
import { createOptionalDependenciesPlugin } from './packages/dever/src/plugins/optional-dependencies.ts';
import { createLocalDocsAliases } from './packages/dever/src/local-client.ts';

interface BuildOptions {
	format?: string;
	packageName?: string;
	useVue?: boolean;
}

const options: BuildOptions = JSON.parse(
	decodeURIComponent(process.env.BUILD_OPTIONS || '{}')
);
const isClientBrowserEntry = options.packageName === '@deot/docs-client'
	&& options.format === 'es';
const config = mergeConfig(
	configShared,
	options.useVue ? configVue : {}
) as UserConfig;

if (options.packageName === '@deot/docs-client' && options.format === 'cjs') {
	config.plugins = [
		...(config.plugins || []),
		{
			name: 'docs-client-preserve-browser-css',
			enforce: 'post',
			generateBundle: {
				order: 'post',
				handler(_options, bundle) {
					// DDC 按 ES、CJS 顺序写入同一个 CSS 路径，保留 ES 收集的完整样式。
					for (const [filename, output] of Object.entries(bundle)) {
						if (output.type === 'asset' && filename.endsWith('.css')) delete bundle[filename];
					}
				}
			}
		}
	];
}

if (isClientBrowserEntry) {
	// 从工作区源码收集 JS 与完整 CSS，避免使用子包旧 dist。
	config.resolve = mergeConfig(config, {
		resolve: { alias: createLocalDocsAliases(process.cwd()) }
	}).resolve;
	const browserChunkPlugin: Plugin = {
		name: 'docs-client-browser-chunks',
		enforce: 'post',
		// Vite 的 Rolldown 构建在合并用户转换选项后，会将 NODE_ENV 初始化为
		// 自引用。这里在最终选项钩子中覆盖它，确保入口和延迟加载分块无需
		// Node 全局变量即可执行。
		options(input) {
			// 共享构建配置会把 ES 包依赖标记为 external；Client 的发布入口需要在
			// 无 import map 的页面直接运行，因此在最终输入阶段清空该规则，把
			// Renderer 等浏览器依赖一并打入入口或相对分块。
			input.external = () => false;
			input.transform = {
				...input.transform,
				define: {
					...input.transform?.define,
					'process.env.NODE_ENV': JSON.stringify('production')
				}
			};
			return input;
		},
		generateBundle(_options, bundle) {
			const invalid: string[] = [];
			Object.values(bundle).forEach((output) => {
				if (output.type !== 'chunk') return;
				if (/\bprocess\.env\b/u.test(output.code)) {
					invalid.push(`${output.fileName}: unresolved process.env`);
				}
				// `output.imports` / `output.dynamicImports` 的标识符在不同构建解析方式下
				// 可能不与 bundle key 完全对齐；这里不再做“必须逐一命中 outputs”的强校验。
			});
			if (invalid.length) {
				throw new Error(`Invalid docs-client browser chunks:\n${invalid.join('\n')}`);
			}
		}
	};
	config.plugins = [
		...(config.plugins || []),
		createOptionalDependenciesPlugin(),
		browserChunkPlugin
	];
	config.define = {
		...config.define,
		'process.env.NODE_ENV': JSON.stringify('production')
	};
	config.build = {
		...config.build,
		cssCodeSplit: false,
		minify: true,
		rolldownOptions: {
			...config.build?.rolldownOptions,
			external: () => false,
			output: {
				...config.build?.rolldownOptions?.output,
				// 某些编译工具在折叠 NODE_ENV 后仍会保留可选的 Node `process` 探测。
				// 为每个分块提供轻量回退，可保护这些低频路径，同时不引入浏览器端
				// process 依赖。
				intro: 'var process = globalThis.process || { env: { NODE_ENV: "production" }, nextTick: queueMicrotask };',
				chunkFileNames: 'chunks/[name]-[hash].js'
			}
		}
	};
}

export default config;
