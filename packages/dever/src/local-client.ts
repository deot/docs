import * as fs from 'node:fs';
import * as path from 'node:path';
import { isInside } from './workspace.ts';

export const LOCAL_CLIENT_ENTRY = '/packages/client/src/index.ts';

export const findLocalClientWorkspace = (cwd: string) => {
	const packageDir = path.resolve(cwd, 'packages/client');
	const packageFile = path.join(packageDir, 'package.json');
	try {
		const projectRoot = fs.realpathSync(cwd);
		if (!isInside(projectRoot, fs.realpathSync(packageDir))
			|| !isInside(projectRoot, fs.realpathSync(packageFile))) return undefined;
		const manifest = JSON.parse(fs.readFileSync(packageFile, 'utf8'));
		if (manifest.name !== '@deot/docs-client') return undefined;
		const entry = path.join(packageDir, 'src/index.ts');
		const source = fs.existsSync(entry)
			&& fs.statSync(entry).isFile()
			&& isInside(projectRoot, fs.realpathSync(entry))
			? entry
			: undefined;
		return { packageFile, source, clientDist: path.join(packageDir, 'dist') };
	} catch {
		return undefined;
	}
};

export const createLocalDocsAliases = (cwd: string) => (
	['locale', 'renderer', 'markdown', 'playground', 'theme'].reduce<Record<string, string>>((result, name) => {
		const source = path.resolve(cwd, `packages/${name}/src/index.ts`);
		if (!fs.existsSync(source)) return result;
		if (name === 'theme') {
			// SCSS 子路径必须在根入口之前，避免被拼接为 index.ts/functions。
			for (const resource of ['functions', 'mixins', 'theme', 'variables']) {
				result[`@deot/docs-theme/${resource}`] = path.resolve(cwd, `packages/theme/src/${resource}.scss`);
			}
		}
		result[`@deot/docs-${name}`] = source;
		return result;
	}, {})
);
