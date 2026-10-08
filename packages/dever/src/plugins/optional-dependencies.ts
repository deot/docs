import * as fs from 'node:fs';
import * as path from 'node:path';
import { createRequire } from 'node:module';
import type { Plugin } from 'vite';

const resolveOptionalDependency = (id: string, importer?: string) => {
	if (!importer || !path.isAbsolute(importer) || /^[./]|:/.test(id)) return;
	const filename = importer.split('?')[0];
	const name = id.startsWith('@') ? id.split('/').slice(0, 2).join('/') : id.split('/')[0];
	let directory = path.dirname(filename);
	while (true) {
		const manifest = path.join(directory, 'package.json');
		if (fs.existsSync(manifest)) {
			const pkg = JSON.parse(fs.readFileSync(manifest, 'utf8'));
			if (!pkg.peerDependencies?.[name] || !pkg.peerDependenciesMeta?.[name]?.optional) return;
			try {
				createRequire(filename).resolve(id);
			} catch (reason) {
				if ((reason as NodeJS.ErrnoException).code === 'MODULE_NOT_FOUND') {
					return { id: `https://cdn.jsdelivr.net/npm/${id}/+esm`, external: true as const };
				}
			}
			return;
		}
		const parent = path.dirname(directory);
		if (parent === directory) return;
		directory = parent;
	}
};

/**
 * 本地包未安装的 optional peer 由浏览器按需从 CDN 加载。
 * @returns 同时用于 Vite 模块转换与依赖预打包的解析插件。
 */
export const createOptionalDependenciesPlugin = (): Plugin => {
	const resolver = {
		name: 'docs-optional-dependencies',
		resolveId: resolveOptionalDependency
	};
	return {
		...resolver,
		enforce: 'pre',
		config: () => ({
			// 预打包也必须走同一规则，避免生成 Vite 的 optional peer 抛错模块。
			optimizeDeps: { rolldownOptions: { plugins: [resolver] } }
		})
	};
};
