// @vitest-environment node
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as http from 'node:http';
import * as vm from 'node:vm';
import { createServer } from 'vite';
import { createDeverConfig } from '../src';

const rootHtml = fs.readFileSync(path.resolve('index.html'), 'utf8');
const startup = rootHtml.slice(rootHtml.lastIndexOf('<script>'));

describe('installed Client development', () => {
	let root: string;
	let packageRoot: string;

	beforeEach(() => {
		root = fs.mkdtempSync(path.join(os.tmpdir(), 'docs-installed-client-'));
		packageRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'docs-installed-packages-'));
		fs.mkdirSync(path.join(root, 'site'));
		fs.writeFileSync(path.join(root, 'site/index.html'), `<div id="app"></div>${startup}`);
		for (const name of ['client', 'launch']) {
			const directory = path.join(packageRoot, name);
			fs.mkdirSync(path.join(directory, 'dist/bundle'), { recursive: true });
			fs.writeFileSync(path.join(directory, 'package.json'), JSON.stringify({
				name: `@deot/docs-${name}`,
				type: 'module',
				exports: name === 'client'
					? { './dist/bundle/index.js': './dist/bundle/index.js' }
					: { '.': { import: './dist/index.js', default: './dist/index.js' } }
			}));
		}
		fs.writeFileSync(path.join(packageRoot, 'client/dist/bundle/index.js'), 'import "./chunk.js"; export const installed = true;');
		fs.writeFileSync(path.join(packageRoot, 'client/dist/bundle/chunk.js'), 'export const chunk = true;');
		fs.writeFileSync(path.join(packageRoot, 'client/dist/bundle/index.style.css'), '.installed { color: red; }');
		fs.writeFileSync(path.join(packageRoot, 'launch/dist/index.js'), 'export const launch = true;');
		fs.writeFileSync(path.join(packageRoot, 'secret.js'), 'secret');
		vi.spyOn(process, 'cwd').mockReturnValue(root);
	});

	afterEach(() => {
		vi.restoreAllMocks();
		fs.rmSync(root, { recursive: true, force: true });
		fs.rmSync(packageRoot, { recursive: true, force: true });
	});

	const install = (nested: boolean) => {
		let directory = root;
		if (nested) {
			directory = path.join(packageRoot, 'docs');
			fs.mkdirSync(path.join(directory, 'dist'), { recursive: true });
			fs.writeFileSync(path.join(directory, 'package.json'), '{"name":"@deot/docs","main":"dist/index.js"}');
			fs.writeFileSync(path.join(directory, 'dist/index.js'), '');
			fs.mkdirSync(path.join(root, 'node_modules/@deot'), { recursive: true });
			fs.symlinkSync(directory, path.join(root, 'node_modules/@deot/docs'), 'dir');
		}
		fs.mkdirSync(path.join(directory, 'node_modules/@deot'), { recursive: true });
		for (const name of ['client', 'launch']) {
			fs.symlinkSync(path.join(packageRoot, name), path.join(directory, `node_modules/@deot/docs-${name}`), 'dir');
		}
	};

	it.each([false, true])('serves installed launch, Client and chunks with nested dependencies: %s', async (nested) => {
		install(nested);
		const server = await createServer({
			...createDeverConfig({ workspace: 'site' }),
			configFile: false,
			server: { middlewareMode: true, hmr: false }
		});
		const httpServer = http.createServer(server.middlewares);
		await new Promise<void>(resolve => httpServer.listen(0, '127.0.0.1', resolve));
		const base = `http://127.0.0.1:${(httpServer.address() as import('node:net').AddressInfo).port}`;
		try {
			const html = await (await fetch(`${base}/site/zh-CN/guide`, { headers: { Accept: 'text/html' } })).text();
			expect(html.match(/'\/@deot\/docs-launch\/\+esm'/g)).toHaveLength(2);
			expect(html).not.toContain('https://cdn.jsdelivr.net/npm/@deot/docs-launch');
			expect(html).not.toContain('https://esm.unpkg.com/@deot/docs-launch');
			expect(html).toContain('"mode":"development"');
			expect(html).toContain('"workspace":"/site/"');
			const adapter = await fetch(`${base}/@deot/docs-launch/+esm`);
			expect(adapter.headers.get('content-type')).toContain('javascript');
			const source = await adapter.text();
			expect(source).toContain('import(\'/@deot/docs-launch/dist/index.js\')');
			const custom = vi.fn(({ url }: { url: string }) => `${url}?custom=1#entry`);
			const target = { $docs: { resolve: { cdn: custom } } };
			vm.runInNewContext(source.replace(/^import\(.*$/mu, ''), { window: target });
			expect(target.$docs.resolve.cdn({ url: 'https://cdn.jsdelivr.net/npm/@deot/docs-client/dist/bundle/index.js' }))
				.toBe('/@deot/docs-client/dist/bundle/index.js?custom=1#entry');
			expect(custom).toHaveBeenCalledOnce();
			for (const [url, content] of [
				['/@deot/docs-launch/dist/index.js', 'launch = true'],
				['/@deot/docs-client/dist/bundle/index.js', 'installed = true'],
				['/@deot/docs-client/dist/bundle/chunk.js', 'chunk = true'],
				['/@deot/docs-client/dist/bundle/index.style.css?version=1', '.installed { color: red; }']
			]) {
				const response = await fetch(`${base}${url}`);
				expect(response.status).toBe(200);
				expect(await response.text()).toContain(content);
			}
			expect((await fetch(`${base}/@deot/docs-client/dist/bundle/missing.js`)).status).toBe(404);
			expect((await fetch(`${base}/@deot/docs-client/dist/%2e%2e%2fsecret.js`)).status).toBe(403);
			fs.symlinkSync(path.join(packageRoot, 'secret.js'), path.join(packageRoot, 'client/dist/bundle/escape.js'));
			expect((await fetch(`${base}/@deot/docs-client/dist/bundle/escape.js`)).status).toBe(403);
			expect(fs.readFileSync(path.join(root, 'site/index.html'), 'utf8')).toContain('https://cdn.jsdelivr.net/npm/@deot/docs-launch');
		} finally {
			await new Promise<void>(resolve => httpServer.close(() => resolve()));
			await server.close();
		}
	});

	it('keeps CDN startup when the installed Client bundle is incomplete', async () => {
		install(false);
		fs.unlinkSync(path.join(packageRoot, 'client/dist/bundle/index.style.css'));
		const server = await createServer({
			...createDeverConfig({ workspace: 'site' }),
			configFile: false,
			server: { middlewareMode: true, hmr: false }
		});
		try {
			const transformed = await server.transformIndexHtml('/site/', startup);
			expect(transformed).toContain('https://cdn.jsdelivr.net/npm/@deot/docs-launch/+esm');
			expect(transformed).toContain('https://esm.unpkg.com/@deot/docs-launch/dist/index.js');
		} finally {
			await server.close();
		}
	});

	it('rewrites direct Client assets and prefers workspace source over installed bundles', async () => {
		install(false);
		const html = '<script type="module" src="https://cdn.jsdelivr.net/npm/@deot/docs-client/+esm"></script>';
		const server = await createServer({
			...createDeverConfig({ workspace: 'site' }),
			configFile: false,
			server: { middlewareMode: true, hmr: false }
		});
		try {
			const transformed = await server.transformIndexHtml('/site/', html);
			expect(transformed).toContain('src="/@deot/docs-client/dist/bundle/index.js"');
			expect(transformed).toContain('href="/@deot/docs-client/dist/bundle/index.style.css"');
		} finally {
			await server.close();
		}
		fs.mkdirSync(path.join(root, 'packages/client/src'), { recursive: true });
		fs.writeFileSync(path.join(root, 'packages/client/package.json'), '{"name":"@deot/docs-client"}');
		fs.writeFileSync(path.join(root, 'packages/client/src/index.ts'), 'export {};');
		const sourceServer = await createServer({
			...createDeverConfig({ workspace: 'site' }),
			configFile: false,
			server: { middlewareMode: true, hmr: false }
		});
		try {
			const transformed = await sourceServer.transformIndexHtml('/site/', startup);
			expect(transformed).toContain('\'/packages/client/src/index.ts\'');
			expect(transformed).not.toContain('\'/@deot/docs-launch/+esm\'');
		} finally {
			await sourceServer.close();
		}
	});
});
