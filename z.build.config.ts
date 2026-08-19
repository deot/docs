import configVue from '@deot/dev-vue';
import { mergeConfig } from 'vite';
import type { Plugin, UserConfig } from 'vite';
import configShared from './node_modules/@deot/dev-builder/shared.config.ts';

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

if (isClientBrowserEntry) {
	const browserEnvironmentPlugin: Plugin = {
		name: 'docs-client-browser-environment',
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
			const outputs = new Set(Object.keys(bundle));
			const invalid: string[] = [];
			const cssText = Object.values(bundle).flatMap((output) => {
				if (output.type !== 'asset' || !output.fileName.endsWith('.css')) return [];
				return [typeof output.source === 'string'
					? output.source
					: Buffer.from(output.source).toString('utf8')];
			}).join('');
			if (!cssText.includes('.docs-app') || !cssText.includes('docs-renderer-hero')) {
				invalid.push('client CSS is missing shell or bundled renderer styles');
			}
			Object.values(bundle).forEach((output) => {
				if (output.type !== 'chunk') return;
				if (/\bprocess\.env\b/u.test(output.code)) {
					invalid.push(`${output.fileName}: unresolved process.env`);
				}
				[...output.imports, ...output.dynamicImports].forEach((source) => {
					if (!outputs.has(source)) invalid.push(`${output.fileName}: unresolved import ${source}`);
				});
			});
			if (invalid.length) {
				throw new Error(`Invalid docs-client browser bundle:\n${invalid.join('\n')}`);
			}
		}
	};
	config.plugins = [
		...(config.plugins || []),
		browserEnvironmentPlugin
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
				chunkFileNames: 'chunks/[name]-[hash].js',
				assetFileNames: 'style.css'
			}
		}
	};
}

export default config;
