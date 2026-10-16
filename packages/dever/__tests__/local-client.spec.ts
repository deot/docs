// @vitest-environment node
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createServer } from 'vite';
import { createDeverConfig } from '../src';
import { findLocalClientWorkspace } from '../src/local-client';
import { rewriteClientAssets, rewriteLaunchUrls } from '../src/local-assets';

const entries = [
	'https://cdn.jsdelivr.net/npm/@deot/docs-launch/+esm',
	'https://esm.unpkg.com/@deot/docs-launch/dist/index.js'
];
const rootHtml = fs.readFileSync(path.resolve('index.html'), 'utf8');
const startup = rootHtml.slice(rootHtml.lastIndexOf('<script>'));

describe('local Client entry', () => {
	let root: string;

	beforeEach(() => {
		root = fs.mkdtempSync(path.join(os.tmpdir(), 'docs-local-client-'));
		fs.mkdirSync(path.join(root, 'packages/client/src'), { recursive: true });
		fs.writeFileSync(path.join(root, 'packages/client/package.json'), JSON.stringify({ name: '@deot/docs-client' }));
		fs.writeFileSync(path.join(root, 'packages/client/src/index.ts'), 'export const current = true;');
		fs.writeFileSync(path.join(root, 'index.html'), `<div id="app"></div>${startup}`);
	});

	afterEach(() => {
		vi.restoreAllMocks();
		fs.rmSync(root, { recursive: true, force: true });
	});

	it('transforms the unchanged CDN startup and serves current source through Vite', async () => {
		vi.spyOn(process, 'cwd').mockReturnValue(root);
		const server = await createServer({
			...createDeverConfig({ workspace: '.' }),
			configFile: false,
			server: { middlewareMode: true, hmr: false }
		});
		try {
			const html = await server.transformIndexHtml('/', fs.readFileSync(path.join(root, 'index.html'), 'utf8'));
			for (const entry of entries) expect(html).not.toContain(entry);
			expect(html.match(/'\/packages\/client\/src\/index\.ts'/g)).toHaveLength(2);
			expect(html.indexOf('window.__DOCS_RUNTIME__')).toBeLessThan(html.indexOf('const entries'));
			expect(html).toContain('"events":"/__docs/events"');
			expect((await server.transformRequest('/packages/client/src/index.ts'))?.code).toContain('current = true');
		} finally {
			await server.close();
		}
	});

	it.each(['wrong package', 'missing source', 'invalid manifest'])('keeps consumer CDN entries for %s', async (reason) => {
		const manifest = path.join(root, 'packages/client/package.json');
		if (reason === 'wrong package') fs.writeFileSync(manifest, '{"name":"consumer-client"}');
		if (reason === 'missing source') fs.unlinkSync(path.join(root, 'packages/client/src/index.ts'));
		if (reason === 'invalid manifest') fs.writeFileSync(manifest, 'invalid');
		vi.spyOn(process, 'cwd').mockReturnValue(root);
		const server = await createServer({
			...createDeverConfig({ workspace: '.' }),
			configFile: false,
			server: { middlewareMode: true, hmr: false }
		});
		try {
			const html = await server.transformIndexHtml('/', fs.readFileSync(path.join(root, 'index.html'), 'utf8'));
			entries.forEach(entry => expect(html).toContain(entry));
			expect(html).toContain('"mode":"development"');
			expect(html).not.toContain('\'/packages/client/src/index.ts\'');
		} finally {
			await server.close();
		}
	});

	it.each(['package', 'source', 'manifest'])('rejects an escaping %s symlink', (target) => {
		const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'docs-local-outside-'));
		try {
			if (target === 'package') {
				fs.cpSync(path.join(root, 'packages/client'), outside, { recursive: true });
				fs.rmSync(path.join(root, 'packages/client'), { recursive: true });
				fs.symlinkSync(outside, path.join(root, 'packages/client'), 'dir');
			} else {
				const relative = target === 'source' ? 'src/index.ts' : 'package.json';
				const filename = path.join(root, 'packages/client', relative);
				fs.copyFileSync(filename, path.join(outside, 'external'));
				fs.unlinkSync(filename);
				fs.symlinkSync(path.join(outside, 'external'), filename);
			}
			expect(findLocalClientWorkspace(root)?.source).toBeUndefined();
		} finally {
			fs.rmSync(outside, { recursive: true, force: true });
		}
	});

	it.each([
		'https://cdn.jsdelivr.net/npm/@deot/docs-launch@1.0.2/+esm',
		'https://esm.unpkg.com/@deot/docs-launch/dist/index.js',
		'https://esm.unpkg.com/@deot/docs-launch@next',
		'//cdn.example.com/@deot/docs-launch'
	])('preserves suffixes when rewriting %s', (url) => {
		expect(rewriteLaunchUrls(`'${url}?custom=1#entry'`, '/local.ts')).toBe('\'/local.ts?custom=1#entry\'');
	});

	it('leaves other packages and unsupported assets unchanged', () => {
		for (const url of [
			'https://cdn.example.com/@deot/docs-launch-extra/+esm',
			'https://cdn.example.com/@deot/docs-launch/dist/index.js.map',
			'https://cdn.example.com/@deot/docs-client-extra/dist/index.js',
			'https://cdn.example.com/@deot/docs-client/dist/index.js.map'
		]) {
			expect(rewriteLaunchUrls(`'${url}'`, '/local.ts')).toBe(`'${url}'`);
			expect(rewriteClientAssets(`'${url}'`)).toBe(`'${url}'`);
		}
	});
});
