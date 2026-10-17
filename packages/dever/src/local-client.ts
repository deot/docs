import * as fs from 'node:fs';
import * as path from 'node:path';
import { createRequire } from 'node:module';
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
		return { source, clientDist: path.join(packageDir, 'dist') };
	} catch {
		return undefined;
	}
};

export const findInstalledClientAssets = (cwd: string) => {
	const projectRequire = createRequire(path.join(cwd, 'package.json'));
	const resolvers = [projectRequire];
	try {
		// pnpm 非提升安装时，Client 与 launch 只能从聚合包内部解析。
		resolvers.push(createRequire(projectRequire.resolve('@deot/docs')));
	} catch { /* 项目可以只安装独立子包。 */ }
	for (const resolver of resolvers) {
		try {
			const clientEntry = resolver.resolve('@deot/docs-client/dist/bundle/index.js');
			const launchEntry = resolver.resolve('@deot/docs-launch');
			const clientDist = path.dirname(clientEntry);
			if (!fs.existsSync(path.join(clientDist, 'index.style.css'))) continue;
			return { clientDist, launchDist: path.dirname(launchEntry) };
		} catch { /* 没有完整安装时保留 HTML 中的 CDN 入口。 */ }
	}
	return undefined;
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
