// @vitest-environment node
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { build, mergeConfig } from 'vite';

it('bundles current workspace sources and lazy component styles into one Client stylesheet', async () => {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), 'docs-client-build-'));
	fs.writeFileSync(path.join(root, 'package.json'), '{"name":"docs-build-fixture"}');
	for (const name of ['locale', 'renderer', 'markdown', 'playground', 'theme']) {
		const directory = path.join(root, 'packages', name);
		fs.mkdirSync(path.join(directory, 'src'), { recursive: true });
		fs.mkdirSync(path.join(directory, 'dist'));
		fs.writeFileSync(path.join(directory, 'src/index.ts'), `import './style.scss'; export const marker = '${name}-current';`);
		fs.writeFileSync(path.join(directory, 'src/style.scss'), `.docs-${name}-fixture { color: rgb(12, 34, 56); }`);
		fs.writeFileSync(path.join(directory, 'dist/index.js'), `export const marker = '${name}-stale';`);
	}
	fs.writeFileSync(path.join(root, 'packages/theme/src/functions.scss'), '@function size() { @return 7px; }');
	fs.writeFileSync(path.join(root, 'entry.scss'), '@use "@deot/docs-theme/functions" as *; .theme-function { width: size(); }');
	fs.writeFileSync(path.join(root, 'index.ts'), `
		import './entry.scss';
		export { marker as locale } from '@deot/docs-locale';
		export { marker as renderer } from '@deot/docs-renderer';
		export { marker as markdown } from '@deot/docs-markdown';
		export { marker as theme } from '@deot/docs-theme';
		export const lazy = () => import('@deot/docs-playground');
	`);
	const cwd = vi.spyOn(process, 'cwd').mockReturnValue(root);
	vi.stubEnv('BUILD_OPTIONS', encodeURIComponent(JSON.stringify({ packageName: '@deot/docs-client', format: 'es' })));
	try {
		const { default: config } = await import('../../../z.build.config');
		const settings = mergeConfig(config, {
			root, configFile: false, logLevel: 'silent',
			build: { write: false }
		});
		settings.build!.lib = { entry: path.join(root, 'index.ts'), formats: ['es'] };
		const result = await build(settings);
		const output = (Array.isArray(result) ? result : [result]).flatMap(bundle => 'output' in bundle ? bundle.output : []);
		const css = output.filter(asset => asset.type === 'asset' && asset.fileName.endsWith('.css'));
		expect(css).toHaveLength(1);
		for (const name of ['locale', 'renderer', 'markdown', 'playground', 'theme']) {
			expect(String(css[0].type === 'asset' && css[0].source)).toContain(`.docs-${name}-fixture`);
		}
		expect(String(css[0].type === 'asset' && css[0].source)).toContain('width:7px');
		const script = output.filter(chunk => chunk.type === 'chunk').map(chunk => chunk.code).join('\n');
		expect(script).toContain('playground-current');
		expect(script).toContain('renderer-current');
		expect(script).not.toContain('-stale');

		fs.writeFileSync(path.join(root, 'cjs.scss'), '.client-only { display: block; }');
		fs.writeFileSync(path.join(root, 'cjs.ts'), 'import \'./cjs.scss\'; export const current = true;');
		vi.stubEnv('BUILD_OPTIONS', encodeURIComponent(JSON.stringify({ packageName: '@deot/docs-client', format: 'cjs' })));
		vi.resetModules();
		const { default: cjsConfig } = await import('../../../z.build.config');
		const cjsSettings = mergeConfig(cjsConfig, {
			root, configFile: false, logLevel: 'silent',
			build: { write: false }
		});
		cjsSettings.build!.lib = { entry: path.join(root, 'cjs.ts'), formats: ['cjs'] };
		const cjsResult = await build(cjsSettings);
		const cjsOutput = (Array.isArray(cjsResult) ? cjsResult : [cjsResult]).flatMap(bundle => 'output' in bundle ? bundle.output : []);
		expect(cjsOutput.some(asset => asset.type === 'asset' && asset.fileName.endsWith('.css'))).toBe(false);
	} finally {
		cwd.mockRestore();
		vi.unstubAllEnvs();
		fs.rmSync(root, { recursive: true, force: true });
	}
});
