import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Options } from '@deot/dev-shared';
import { Shell, Utils } from '@deot/dev-shared';
import fs from 'fs-extra';
import type { InlineConfig } from 'vite';
import { build as createBuild, createServer, mergeConfig } from 'vite';
import createPlugins from './plugins';

const dirname = path.dirname(fileURLToPath(import.meta.url));

export const createDeverConfig = (options: Options): InlineConfig => {
	const cwd = process.cwd();
	const workspace = String(options.workspace || 'site');
	const build = Boolean(options.build);
	const localAliases = ['markdown', 'playground'].reduce<Record<string, string>>((result, name) => {
		const source = path.resolve(cwd, `packages/${name}/src/index.ts`);
		if (fs.existsSync(source)) result[`@deot/docs-${name}`] = source;
		return result;
	}, {});
	const config: InlineConfig = {
		root: build
			? path.resolve(cwd, workspace)
			: cwd,
		resolve: { alias: localAliases },
		server: {
			host: true,
			watch: { ignored: ['**/coverage/**', '**/dist/**'] }
		},
		optimizeDeps: { entries: [] },
		build: build
			? {
					outDir: path.resolve(cwd, String(options.outDir || 'dist')),
					emptyOutDir: true,
					rollupOptions: { input: path.resolve(cwd, workspace, 'index.html') }
				}
			: undefined
	};

	const userConfigFiles = ['z.doc.config', 'doc.config', 'vite.config'];
	for (const filename of userConfigFiles) {
		for (const extension of ['.js', '.ts']) {
			const candidate = path.resolve(cwd, `${filename}${extension}`);
			if (fs.existsSync(candidate)) {
				config.configFile = candidate;
				return mergeConfig(createPlugins(options), config);
			}
		}
	}
	config.configFile = path.resolve(dirname, '../shared.config.ts');
	return mergeConfig(createPlugins(options), config);
};

export const run = (input: Options) => Utils.autoCatch(async () => {
	const options: Options = {
		workspace: 'site',
		outDir: 'dist',
		dryRun: false,
		build: false,
		...input
	};
	if (typeof options.dryRun === 'undefined') options.dryRun = process.env.NODE_ENV === 'UNIT';
	if (options.dryRun) return Shell.spawn(`echo development ${dirname}`);
	process.env.ENV_OPTIONS = encodeURIComponent(JSON.stringify(options));
	const config = createDeverConfig(options);
	if (options.build) {
		await createBuild(config);
		return;
	}
	const server = await createServer(config);
	await server.listen();
	server.printUrls();
	server.bindCLIShortcuts({ print: true });
});
