import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Options } from '@deot/dev-shared';
import { Utils, Shell } from '@deot/dev-shared';

import fs from 'fs-extra';
import type { InlineConfig } from 'vite';
import { cloneDeep } from 'lodash-es';
import { build as createBuild, createServer, mergeConfig } from 'vite';
import createPlugins from './plugins';

const dirname = path.dirname(fileURLToPath(import.meta.url));

export const run = (options: Options) => Utils.autoCatch(async () => {
	options = {
		workspace: 'site',
		outDir: 'dist',
		dryRun: false,
		build: false,
		...options
	};

	if (typeof options.dryRun === 'undefined') {
		options.dryRun = process.env.NODE_ENV === 'UNIT';
	}
	if (options.dryRun) return Shell.spawn(`echo development ${dirname}`);

	let options$: InlineConfig = {
		root: '.',
		resolve: {},
		server: {
			host: true
		},
		define: {
		},
		build: {
			rollupOptions: {

			}
		},
		css: {}
	};
	const devOptions = {
		...options
	};

	const cwd = process.cwd();
	const userConfigFiles = ['z.doc.config', 'doc.config', 'vite.config'];
	const allowExt = ['.js', '.ts'];
	for (let i = 0; i < userConfigFiles.length; i++) {
		const filename = userConfigFiles[i];
		for (let j = 0; j < allowExt.length; j++) {
			const ext = allowExt[j];
			if (fs.existsSync(`${cwd}/${filename}${ext}`)) {
				options$.configFile = path.relative(cwd, path.resolve(cwd, `./${filename}${ext}`));
				break;
			}
		}
		if (options$.configFile) break;
	}

	if (!options$.configFile) {
		options$.configFile = path.relative(cwd, path.resolve(dirname, '../shared.config.ts'));
	}

	process.env.ENV_OPTIONS = encodeURIComponent(JSON.stringify(devOptions));

	if (!options.build) {
		options$ = mergeConfig(createPlugins(options), options$);

		const server = await createServer(options$);
		await server.listen();

		server.printUrls();
		server.bindCLIShortcuts({ print: true });
	} else {
		let newOptions = cloneDeep(options$);
		newOptions = mergeConfig(createPlugins(), newOptions);
		await createBuild(newOptions);
	}
});
