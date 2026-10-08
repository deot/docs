// @vitest-environment node
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { build, optimizeDeps, resolveConfig } from 'vite';
import { createOptionalDependenciesPlugin } from '../src/plugins/optional-dependencies';
import { pluginHook } from './fixtures';

describe('optional peer CDN fallback', () => {
	let root: string;
	let entry: string;

	beforeEach(() => {
		root = fs.mkdtempSync(path.join(os.tmpdir(), 'docs-optional-peer-'));
		const widget = path.join(root, 'node_modules/fixture-widget');
		fs.mkdirSync(widget, { recursive: true });
		fs.writeFileSync(path.join(root, 'package.json'), '{}');
		fs.writeFileSync(path.join(widget, 'package.json'), JSON.stringify({
			name: 'fixture-widget', type: 'module', main: 'index.js',
			peerDependencies: { '@example/capture': '*', 'quill': '*' },
			peerDependenciesMeta: { '@example/capture': { optional: true }, 'quill': { optional: true } }
		}));
		entry = path.join(widget, 'index.js');
		fs.writeFileSync(entry, 'export const capture = () => import("@example/capture");');
	});
	afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

	it('redirects missing optional peers while preserving installed and required dependencies', () => {
		const resolve = pluginHook(createOptionalDependenciesPlugin().resolveId, 'resolveId');
		expect(resolve('@example/capture', entry)).toEqual({
			id: 'https://cdn.jsdelivr.net/npm/@example/capture/+esm', external: true
		});
		expect(resolve('@example/capture/helpers', entry)).toEqual({
			id: 'https://cdn.jsdelivr.net/npm/@example/capture/helpers/+esm', external: true
		});
		expect(resolve('required-package', entry)).toBeUndefined();
		expect(resolve('./child.js', entry)).toBeUndefined();
		expect(resolve('https://example.com/widget.js', entry)).toBeUndefined();
		expect(resolve('quill')).toBeUndefined();
		expect(resolve('quill', '\0virtual')).toBeUndefined();
		fs.mkdirSync(path.join(root, 'node_modules/quill'));
		fs.writeFileSync(path.join(root, 'node_modules/quill/index.js'), 'module.exports = {};');
		expect(resolve('quill', entry)).toBeUndefined();
	});

	it('preserves lazy CDN imports in both production bundles and dependency prebundles', async () => {
		const plugin = createOptionalDependenciesPlugin();
		const output = await build({
			root, configFile: false, logLevel: 'silent', plugins: [plugin],
			build: { write: false, minify: false, lib: { entry, formats: ['es'] } }
		});
		const bundles = Array.isArray(output) ? output : [output];
		const code = bundles.flatMap(bundle => 'output' in bundle ? bundle.output : [])
			.filter(chunk => chunk.type === 'chunk').map(chunk => chunk.code).join('\n');
		expect(code).toContain('import("https://cdn.jsdelivr.net/npm/@example/capture/+esm")');
		const config = await resolveConfig({
			root, configFile: false, logLevel: 'silent', plugins: [plugin],
			optimizeDeps: { entries: [], include: ['fixture-widget'] }
		}, 'serve');
		const metadata = await optimizeDeps(config, true);
		const optimized = fs.readFileSync(metadata.optimized['fixture-widget'].file, 'utf8');
		expect(optimized).toContain('import("https://cdn.jsdelivr.net/npm/@example/capture/+esm")');
		expect(optimized).not.toContain('Could not resolve');
	});
});
