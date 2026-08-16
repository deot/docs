import * as path from 'node:path';
import * as fs from 'node:fs';
import * as http from 'node:http';
import * as os from 'node:os';
import * as vm from 'node:vm';
import * as Dever from '../src';
import {
	createRuntimePlugin,
	default as createDocsPlugins,
	getResourceType,
	isInside,
	isNotModified,
	resolvePageSaveTarget
} from '../src/plugins';
import { createPreviewRequestHandler } from '../src/preview';
import { resolveDocsWorkspace } from '../src/workspace';

// @vitest-environment node
describe('dever configuration', () => {
	it('resolves page editor saves inside the selected workspace only', () => {
		const root = fs.mkdtempSync(path.join(os.tmpdir(), 'docs-page-save-'));
		const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'docs-page-save-outside-'));
		try {
			fs.mkdirSync(path.join(root, 'zh-CN'), { recursive: true });
			expect(resolvePageSaveTarget(root, 'zh-CN', './pages/home.page.json')).toBe(
				path.join(root, 'zh-CN/pages/home.page.json')
			);
			expect(() => resolvePageSaveTarget(root, 'zh-CN', '../secret.page.json')).toThrow();
			expect(() => resolvePageSaveTarget(root, '../outside', './home.page.json')).toThrow();
			if (process.platform !== 'win32') {
				fs.symlinkSync(outside, path.join(root, 'zh-CN/linked'));
				expect(() => resolvePageSaveTarget(
					root,
					'zh-CN',
					'./linked/secret.page.json'
				)).toThrow();
			}
		} finally {
			fs.rmSync(root, { recursive: true, force: true });
			fs.rmSync(outside, { recursive: true, force: true });
		}
	});

	it('resolves default, root and explicit project workspaces safely', () => {
		const root = fs.mkdtempSync(path.join(os.tmpdir(), 'docs-workspace-'));
		const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'docs-workspace-outside-'));
		try {
			fs.mkdirSync(path.join(root, 'site'), { recursive: true });
			fs.mkdirSync(path.join(root, 'docs/nested'), { recursive: true });
			fs.mkdirSync(path.join(root, 'docs #v1'), { recursive: true });
			fs.mkdirSync(path.join(root, '..docs'), { recursive: true });
			fs.writeFileSync(path.join(root, 'index.html'), '<div>root</div>');
			fs.writeFileSync(path.join(root, 'site/index.html'), '<div>site</div>');
			fs.writeFileSync(path.join(root, 'docs/nested/index.html'), '<div>nested</div>');
			fs.writeFileSync(path.join(root, 'docs #v1/index.html'), '<div>encoded</div>');
			fs.writeFileSync(path.join(root, '..docs/index.html'), '<div>dots</div>');

			const detected = resolveDocsWorkspace(root);
			expect(detected).toMatchObject({ relative: 'site', urlBase: '/site/' });
			expect(detected.entry).toBe(fs.realpathSync(path.join(root, 'site/index.html')));
			const explicitRoot = resolveDocsWorkspace(root, '.');
			expect(explicitRoot).toMatchObject({ relative: '', urlBase: '/' });
			expect(explicitRoot.entry).toBe(fs.realpathSync(path.join(root, 'index.html')));
			expect(resolveDocsWorkspace(root, './docs//nested/')).toMatchObject({
				relative: 'docs/nested',
				urlBase: '/docs/nested/'
			});
			expect(resolveDocsWorkspace(root, 'docs #v1')).toMatchObject({
				relative: 'docs #v1',
				urlBase: '/docs%20%23v1/'
			});
			expect(resolveDocsWorkspace(root, '..docs')).toMatchObject({
				relative: '..docs',
				urlBase: '/..docs/'
			});
			expect(() => resolveDocsWorkspace(root, 'docs/../site'))
				.toThrow('must not contain parent segments');

			fs.rmSync(path.join(root, 'site/index.html'));
			expect(resolveDocsWorkspace(root).entry).toBe(fs.realpathSync(path.join(root, 'index.html')));
			expect(() => resolveDocsWorkspace(root, 'site'))
				.toThrow('Cannot find docs workspace entry');
			expect(() => resolveDocsWorkspace(root, '../outside'))
				.toThrow('must not contain parent segments');
			fs.symlinkSync(outside, path.join(root, 'linked-docs'), 'dir');
			expect(() => resolveDocsWorkspace(root, 'linked-docs'))
				.toThrow('symlink escapes the project');
		} finally {
			fs.rmSync(root, { recursive: true, force: true });
			fs.rmSync(outside, { recursive: true, force: true });
		}
	});

	it('rejects an index symlink before Vite changes the output filename', () => {
		const root = fs.mkdtempSync(path.join(os.tmpdir(), 'docs-workspace-entry-'));
		try {
			fs.writeFileSync(path.join(root, 'template.html'), '<div>template</div>');
			fs.symlinkSync('template.html', path.join(root, 'index.html'));
			expect(() => resolveDocsWorkspace(root, '.'))
				.toThrow('Docs entry must not be a symbolic link');
		} finally {
			fs.rmSync(root, { recursive: true, force: true });
		}
	});

	it('lists both default entry candidates when no workspace can be detected', () => {
		const root = fs.mkdtempSync(path.join(os.tmpdir(), 'docs-workspace-empty-'));
		try {
			const realRoot = fs.realpathSync(root);
			expect(() => resolveDocsWorkspace(root)).toThrow(
				`Checked: ${path.join(realRoot, 'site/index.html')} ${path.join(realRoot, 'index.html')}`
			);
		} finally {
			fs.rmSync(root, { recursive: true, force: true });
		}
	});

	it('uses the same root workspace for development, preview and build configs', () => {
		const root = fs.mkdtempSync(path.join(os.tmpdir(), 'docs-root-config-'));
		fs.writeFileSync(path.join(root, 'index.html'), '<div />');
		const restoreCwd = vi.spyOn(process, 'cwd').mockReturnValue(root);
		try {
			const development = Dever.createDeverConfig({ workspace: '.' } as any);
			expect(development.root).toBe(fs.realpathSync(root));
			const preview = Dever.createDeverConfig({ workspace: '.', preview: true } as any);
			expect(preview.root).toBe(fs.realpathSync(root));
			const build = Dever.createDeverConfig({
				workspace: '.',
				build: true,
				outDir: 'dist'
			} as any);
			expect(build.root).toBe(fs.realpathSync(root));
			expect(build.build?.rollupOptions?.input).toBe(fs.realpathSync(path.join(root, 'index.html')));
		} finally {
			restoreCwd.mockRestore();
			fs.rmSync(root, { recursive: true, force: true });
		}
	});

	it('maps package readmes to local dev resources and remote preview resources', () => {
		const html = fs.readFileSync(path.resolve('site/index.html'), 'utf8');
		const configScript = html.match(/<script>([\s\S]*?)<\/script>/u)?.[1];
		expect(configScript).toBeTruthy();
		const target: Record<string, any> = {};
		vm.runInNewContext(configScript!, {
			window: target,
			location: {
				pathname: '/zh-CN/packages/client',
				origin: 'http://localhost:4173',
				href: 'http://localhost:4173/zh-CN/packages/client'
			},
			URL,
			encodeURIComponent
		});
		const config = target.$docs;
		const guideSource = config.resolve.markdown({ lang: 'en-US', value: 'guide' });
		expect(guideSource).toBe('README.md');
		expect(config.resolve.resource({
			source: guideSource,
			type: 'markdown',
			lang: 'en-US',
			runtime: { mode: 'development' }
		})).toBe('/README.md');
		expect(config.resolve.resource({
			source: guideSource,
			type: 'markdown',
			lang: 'en-US',
			runtime: { mode: 'production' }
		})).toBe('https://raw.githubusercontent.com/deot/docs/refs/heads/main/README.md');
		const source = config.resolve.markdown({ lang: 'en-US', value: 'client' });
		expect(source).toBe('packages/client/README.md');
		expect(config.resolve.markdown({ lang: 'zh-CN', value: 'client' })).toBe(source);
		expect(config.resolve.resource({
			source,
			type: 'markdown',
			runtime: { mode: 'development' }
		})).toBe('/packages/client/README.md');
		expect(config.resolve.resource({
			source,
			type: 'markdown',
			runtime: { mode: 'production' }
		})).toBe(
			'https://raw.githubusercontent.com/deot/docs/refs/heads/main/packages/client/README.md'
		);
		expect(config.resolve.link({
			href: 'packages/client/README.md',
			lang: 'en-US',
			source: 'README.md'
		})).toBe('/en-US/packages/client');
		expect(config.resolve.link({
			href: '../dever/README.md?tab=api#rules',
			lang: 'en-US',
			source: 'packages/index/README.md'
		})).toBe('/en-US/packages/dever?tab=api#rules');
		expect(config.home.locales['zh-CN'].blocks.map((item: { module: { type: string } }) => item.module.type))
			.toEqual(['hero', 'features', 'steps', 'faq', 'cta']);
		expect(config.home.locales['zh-CN'].blocks[0].appearance).toEqual(expect.objectContaining({
			fullWidth: true,
			maxWidth: 1200
		}));
		expect(config.home.locales['zh-CN'].blocks[0].module.props.title).toBe('你好 @deot/docs');
		expect(config.home.locales['en-US'].blocks[0].module.props.actions[0].to)
			.toBe('/en-US/packages/guide');
		expect(config.resolve.link({
			href: '../cli/README.md',
			lang: 'zh-CN',
			source: 'packages/index/README.md'
		})).toBe('/zh-CN/packages/cli');
		expect(config.resolve.link({
			href: 'https://example.com/docs',
			lang: 'en-US',
			source: 'packages/index/README.md'
		})).toBeUndefined();
		expect(config.resolve.link({
			href: '../unknown/README.md',
			lang: 'en-US',
			source: 'packages/index/README.md'
		})).toBeUndefined();
		const sidebar = config.routes['/packages/guide'].sidebar['en-US'];
		expect(sidebar)
			.toEqual([
				{ label: 'Introduction', value: '/packages/guide' },
				{
					label: 'Packages',
					children: expect.arrayContaining([
						{ label: '@deot/docs', value: '/packages/index' },
						{ label: '@deot/docs-client', value: '/packages/client' }
					])
				}
			]);
		expect(config.routes['/']).toBeUndefined();
		expect(config.routes['/packages/guide']).toMatchObject({ value: 'guide' });
		expect(config.routes['/packages/guide'].sidebar['zh-CN'][0])
			.toEqual({ label: '简介', value: '/packages/guide' });
	});

	it('exports run and creates isolated development, build and preview configs', () => {
		expect(Dever.run).toBeTypeOf('function');
		const development = Dever.createDeverConfig({ workspace: 'site' } as any);
		expect(development.root).toBe(process.cwd());
		expect(development.resolve?.alias).toMatchObject({
			'@deot/docs-locale': expect.stringContaining('packages/locale/src/index.ts'),
			'@deot/docs-markdown': expect.stringContaining('packages/markdown/src/index.ts'),
			'@deot/docs-playground': expect.stringContaining('packages/playground/src/index.ts'),
			'@deot/docs-theme': expect.stringContaining('packages/theme/src/index.ts'),
			'@deot/docs-theme/variables': expect.stringContaining('packages/theme/src/variables.scss')
		});
		expect(development.server?.watch?.ignored).toEqual(['**/coverage/**', '**/dist/**']);

		const production = Dever.createDeverConfig({
			workspace: 'site',
			outDir: 'preview',
			build: true
		} as any);
		expect(production.root).toBe(path.resolve('site'));
		expect(production.build?.rollupOptions?.input).toBe(path.resolve('site/index.html'));
		expect(production.build?.outDir).toBe(path.resolve('preview'));
		expect(() => Dever.createDeverConfig({
			workspace: 'site',
			outDir: '.',
			build: true
		} as any)).toThrow('Build outDir must not contain the workspace');
		expect(() => Dever.createDeverConfig({
			workspace: 'site',
			outDir: 'site',
			build: true
		} as any)).toThrow('Build outDir must not contain the workspace');
		expect(Dever.createDeverConfig({
			workspace: 'site',
			outDir: 'site/preview',
			build: true
		} as any).build?.outDir).toBe(path.resolve('site/preview'));

		const preview = Dever.createDeverConfig({
			workspace: 'site',
			preview: true
		} as any);
		expect(preview.root).toBe(path.resolve('site'));
		expect(preview.build).toBeUndefined();
		expect(preview.server).toBeUndefined();
		expect(() => Dever.createDeverConfig({ build: true, preview: true } as any))
			.toThrow('build and preview modes are mutually exclusive');
	});

	it('skips only a nested build output while retaining its static siblings', () => {
		const root = fs.mkdtempSync(path.join(os.tmpdir(), 'docs-build-copy-'));
		const workspace = path.join(root, 'site');
		const outDir = path.join(workspace, 'output/dist');
		fs.mkdirSync(path.join(workspace, 'zh-CN'), { recursive: true });
		fs.mkdirSync(path.join(workspace, 'zh-CN/.assets'), { recursive: true });
		fs.mkdirSync(outDir, { recursive: true });
		fs.writeFileSync(path.join(workspace, 'index.html'), '<div>docs</div>');
		fs.writeFileSync(path.join(workspace, 'zh-CN/index.md'), '# Docs');
		fs.writeFileSync(path.join(workspace, 'zh-CN/.assets/theme.css'), ':root {}');
		fs.writeFileSync(path.join(workspace, 'output/source.txt'), 'skip output tree');
		fs.writeFileSync(path.join(outDir, 'index.html'), '<div>built</div>');
		const restoreCwd = vi.spyOn(process, 'cwd').mockReturnValue(root);
		try {
			const config = createDocsPlugins({
				workspace: 'site',
				outDir: 'site/output/dist',
				build: true
			}) as any;
			const copyPlugin = config.plugins.find((plugin: any) => (
				plugin.name === 'docs-static-resources'
			));
			copyPlugin.writeBundle();
			expect(fs.readFileSync(path.join(outDir, 'zh-CN/index.md'), 'utf8')).toBe('# Docs');
			expect(fs.readFileSync(path.join(outDir, 'zh-CN/.assets/theme.css'), 'utf8'))
				.toBe(':root {}');
			expect(fs.readFileSync(path.join(outDir, 'output/source.txt'), 'utf8'))
				.toBe('skip output tree');
			expect(fs.existsSync(path.join(outDir, 'output/dist'))).toBe(false);

			// 字面上位于工作区外的输出目录仍可能通过符号链接解析回工作区，
			// 因此必须应用相同的顶层排除规则。
			const linkedOutDir = path.join(root, 'linked-output');
			fs.symlinkSync(outDir, linkedOutDir, 'dir');
			fs.rmSync(path.join(outDir, 'zh-CN'), { recursive: true, force: true });
			const linkedConfig = createDocsPlugins({
				workspace: 'site',
				outDir: 'linked-output',
				build: true
			}) as any;
			const linkedCopyPlugin = linkedConfig.plugins.find((plugin: any) => (
				plugin.name === 'docs-static-resources'
			));
			linkedCopyPlugin.writeBundle();
			expect(fs.readFileSync(path.join(outDir, 'zh-CN/index.md'), 'utf8')).toBe('# Docs');
			expect(fs.readFileSync(path.join(outDir, 'output/source.txt'), 'utf8'))
				.toBe('skip output tree');
			expect(fs.existsSync(path.join(outDir, 'output/dist'))).toBe(false);
		} finally {
			restoreCwd.mockRestore();
			fs.rmSync(root, { recursive: true, force: true });
		}
	});

	it('copies root workspace resources without build and dependency directories', () => {
		const root = fs.mkdtempSync(path.join(os.tmpdir(), 'docs-root-build-copy-'));
		const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'docs-root-build-outside-'));
		const outDir = path.join(root, 'dist');
		for (const directory of [
			'zh-CN',
			'node_modules/pkg',
			'coverage',
			'out',
			'.cache',
			'.well-known'
		]) {
			fs.mkdirSync(path.join(root, directory), { recursive: true });
		}
		fs.mkdirSync(outDir, { recursive: true });
		fs.writeFileSync(path.join(root, 'index.html'), '<div>root docs</div>');
		fs.writeFileSync(path.join(root, 'zh-CN/index.md'), '# Root Docs');
		fs.writeFileSync(path.join(root, 'node_modules/pkg/index.js'), 'ignored');
		fs.writeFileSync(path.join(root, 'coverage/index.json'), '{}');
		fs.writeFileSync(path.join(root, 'out/index.html'), 'ignored');
		fs.writeFileSync(path.join(root, '.cache/value'), 'ignored');
		fs.writeFileSync(path.join(root, '.well-known/value'), 'ignored');
		fs.writeFileSync(path.join(root, '.nojekyll'), '');
		fs.writeFileSync(path.join(outDir, 'index.html'), '<div>built</div>');
		const restoreCwd = vi.spyOn(process, 'cwd').mockReturnValue(root);
		try {
			const config = createDocsPlugins({
				workspace: '.',
				outDir: 'dist',
				build: true
			}) as any;
			const copyPlugin = config.plugins.find((plugin: any) => (
				plugin.name === 'docs-static-resources'
			));
			copyPlugin.writeBundle();
			expect(fs.readFileSync(path.join(outDir, 'zh-CN/index.md'), 'utf8'))
				.toBe('# Root Docs');
			expect(fs.existsSync(path.join(outDir, 'node_modules'))).toBe(false);
			expect(fs.existsSync(path.join(outDir, 'coverage'))).toBe(false);
			expect(fs.existsSync(path.join(outDir, 'out'))).toBe(false);
			expect(fs.existsSync(path.join(outDir, '.cache'))).toBe(false);
			expect(fs.existsSync(path.join(outDir, '.well-known'))).toBe(false);
			expect(fs.existsSync(path.join(outDir, '.nojekyll'))).toBe(true);
			expect(fs.existsSync(path.join(outDir, 'dist'))).toBe(false);
			fs.writeFileSync(path.join(outside, 'secret.md'), '# Outside');
			fs.symlinkSync(path.join(outside, 'secret.md'), path.join(root, 'escaped.md'));
			expect(() => copyPlugin.writeBundle()).toThrow(
				'Static resource symlink escapes the workspace'
			);
		} finally {
			restoreCwd.mockRestore();
			fs.rmSync(root, { recursive: true, force: true });
			fs.rmSync(outside, { recursive: true, force: true });
		}
	});

	it('previews static resources without Vite runtime, SSE or a generated site dist', async () => {
		const root = fs.mkdtempSync(path.join(os.tmpdir(), 'docs-preview-'));
		const workspace = path.join(root, 'site');
		const clientDist = path.join(root, 'client');
		fs.mkdirSync(path.join(workspace, 'zh-CN'), { recursive: true });
		fs.mkdirSync(path.join(clientDist, 'chunks'), { recursive: true });
		fs.writeFileSync(path.join(workspace, 'index.html'), [
			'<!DOCTYPE html>',
			'<link href="https://unpkg.com/@deot/docs-client@1.0.0/dist/index.style.css?theme=docs#style">',
			'<script type="module" src="//unpkg.com/@deot/docs-client/dist/index.js"></script>',
			'<script>const client = "http://cdn.example.com/vendor/npm/@deot/docs-client@next/dist/index.js?module#entry";</script>',
			'<script>const style = "https://cdn.jsdelivr.net/npm/@deot/docs-client/dist/index.style.css";</script>',
			'<script>const sourceMap = "https://cdn.example.com/@deot/docs-client/dist/index.js.map";</script>',
			'<script>const bareText = "@deot/docs-client/dist/index.js";</script>',
			'<script>const module = "https://esm.sh/@deot/docs-client";</script>',
			'<script>const other = "https://cdn.example.com/@deot/docs-client-extra/dist/index.js";</script>'
		].join(''));
		fs.writeFileSync(path.join(workspace, 'zh-CN/index.md'), '# Preview');
		fs.writeFileSync(path.join(clientDist, 'index.js'), 'import "./chunks/lazy.js";');
		fs.writeFileSync(path.join(clientDist, 'index.style.css'), '.docs {}');
		fs.writeFileSync(path.join(clientDist, 'chunks/lazy.js'), 'export default 1;');

		const server = http.createServer(createPreviewRequestHandler({
			workspace,
			clientDist
		}));
		await new Promise<void>((resolve, reject) => {
			server.once('error', reject);
			server.listen(0, '127.0.0.1', resolve);
		});
		try {
			const address = server.address();
			if (!address || typeof address === 'string') throw new Error('Missing preview address');
			const base = `http://127.0.0.1:${address.port}`;
			const page = await fetch(`${base}/zh-CN/index`, {
				headers: { Accept: 'text/html' }
			});
			const html = await page.text();
			expect(page.status).toBe(200);
			expect(html).toContain('/@deot/docs-client/index.js');
			expect(html).toContain('/@deot/docs-client/index.style.css?theme=docs#style');
			expect(html).toContain('/@deot/docs-client/index.js?module#entry');
			expect(html).toContain('/@deot/docs-client/index.style.css');
			expect(html).toContain('https://cdn.example.com/@deot/docs-client/dist/index.js.map');
			expect(html).toContain('@deot/docs-client/dist/index.js');
			expect(html).toContain('https://esm.sh/@deot/docs-client');
			expect(html).toContain('https://cdn.example.com/@deot/docs-client-extra/dist/index.js');
			expect(html).not.toContain('https://unpkg.com/@deot/docs-client@1.0.0/dist/index.style.css');
			expect(html).not.toContain('//unpkg.com/@deot/docs-client/dist/index.js');
			expect(html).not.toContain('http://cdn.example.com/vendor/npm/@deot/docs-client@next/dist/index.js');
			expect(html).not.toContain('https://cdn.jsdelivr.net/npm/@deot/docs-client/dist/index.style.css');
			expect(html).not.toContain('/@vite/client');
			expect(html).not.toContain('__DOCS_RUNTIME__');
			expect(await (await fetch(`${base}/@deot/docs-client/index.js`)).text())
				.toContain('./chunks/lazy.js');
			const markdown = await fetch(`${base}/zh-CN/index.md`);
			expect(markdown.status).toBe(200);
			expect((await fetch(`${base}/zh-CN/index.md`, {
				headers: { 'If-None-Match': String(markdown.headers.get('etag')) }
			})).status).toBe(304);
			expect((await fetch(`${base}/__docs/events`)).status).toBe(404);
			expect((await fetch(`${base}/zh-CN/missing.md`, {
				headers: { Accept: 'text/plain' }
			})).status).toBe(404);
			expect(fs.existsSync(path.join(root, 'dist'))).toBe(false);

			const remoteServer = http.createServer(createPreviewRequestHandler({ workspace }));
			await new Promise<void>((resolve, reject) => {
				remoteServer.once('error', reject);
				remoteServer.listen(0, '127.0.0.1', resolve);
			});
			try {
				const remoteAddress = remoteServer.address();
				if (!remoteAddress || typeof remoteAddress === 'string') {
					throw new Error('Missing remote preview address');
				}
				const remoteHtml = await (await fetch(
					`http://127.0.0.1:${remoteAddress.port}/zh-CN/index`,
					{ headers: { Accept: 'text/html' } }
				)).text();
				expect(remoteHtml).toContain(
					'https://unpkg.com/@deot/docs-client@1.0.0/dist/index.style.css?theme=docs#style'
				);
				expect(remoteHtml).toContain('//unpkg.com/@deot/docs-client/dist/index.js');
				expect(remoteHtml).not.toContain('/@deot/docs-client/index.js');
			} finally {
				await new Promise<void>((resolve, reject) => {
					remoteServer.close((reason) => {
						if (reason) reject(reason);
						else resolve();
					});
				});
			}
		} finally {
			await new Promise<void>((resolve, reject) => {
				server.close((reason) => {
					if (reason) reject(reason);
					else resolve();
				});
			});
			fs.rmSync(root, { recursive: true, force: true });
		}
	});

	it('classifies resources and rejects paths outside the workspace', () => {
		const workspace = path.resolve('site');
		expect(isInside(workspace, path.join(workspace, 'zh-CN/index.vue'))).toBe(true);
		expect(isInside(workspace, path.resolve('package.json'))).toBe(false);
		expect(getResourceType('index.md')).toBe('markdown');
		expect(getResourceType('sidebar.json')).toBe('sidebar');
		expect(getResourceType('index.vue')).toBe('sfc');
		expect(getResourceType('style.css')).toBe('style');
		expect(getResourceType('index.ts')).toBe('module');
		expect(isNotModified({
			'if-none-match': 'old-etag',
			'if-modified-since': 'Mon, 10 Aug 2026 10:00:00 GMT'
		}, 'new-etag', 'Mon, 10 Aug 2026 10:00:00 GMT')).toBe(false);
		expect(isNotModified({
			'if-modified-since': 'Mon, 10 Aug 2026 10:00:00 GMT'
		}, 'new-etag', 'Mon, 10 Aug 2026 10:00:00 GMT')).toBe(true);
	});

	it('injects the development runtime before application scripts', () => {
		const plugin = createRuntimePlugin({ workspace: 'site' });
		const transform = plugin.transformIndexHtml as any;
		const tags = transform.handler();
		expect(tags[0]).toMatchObject({ tag: 'script', injectTo: 'head-prepend' });
		expect(tags[0].children).toContain('window.__DOCS_RUNTIME__');
		expect(tags[0].children).toContain('"workspace":"/site/"');
		const root = fs.mkdtempSync(path.join(os.tmpdir(), 'docs-root-runtime-'));
		fs.writeFileSync(path.join(root, 'index.html'), '<div />');
		const restoreCwd = vi.spyOn(process, 'cwd').mockReturnValue(root);
		try {
			const rootTags = (createRuntimePlugin({ workspace: '.' }).transformIndexHtml as any)
				.handler();
			expect(rootTags[0].children).toContain('"workspace":"/"');
		} finally {
			restoreCwd.mockRestore();
			fs.rmSync(root, { recursive: true, force: true });
		}
		expect(tags).toHaveLength(1);
		expect(createRuntimePlugin({ build: true }).transformIndexHtml).toBeUndefined();
		expect(createRuntimePlugin({ preview: true }).transformIndexHtml).toBeUndefined();

		const previewWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), 'docs-plugin-preview-'));
		fs.writeFileSync(path.join(previewWorkspace, 'index.html'), '<div />');
		fs.writeFileSync(path.join(previewWorkspace, 'index.vue'), '<template><div /></template>');
		const previewPlugins = createDocsPlugins({ workspace: 'site', preview: true }) as any;
		const workspacePlugin = previewPlugins.plugins.find((item: any) => (
			item.name === 'docs-workspace-resources'
		));
		let previewRawMiddleware: Function | undefined;
		const previewServer = {
			config: { root: previewWorkspace },
			middlewares: {
				use: vi.fn((handler: Function) => {
					previewRawMiddleware = handler;
				})
			},
			watcher: { add: vi.fn(), on: vi.fn() },
			httpServer: { once: vi.fn() }
		};
		workspacePlugin.configureServer(previewServer);
		expect(previewServer.middlewares.use).toHaveBeenCalledOnce();
		expect(previewServer.watcher.on).not.toHaveBeenCalled();
		expect(previewServer.httpServer.once).not.toHaveBeenCalled();
		const rawResponse = {
			statusCode: 0,
			setHeader: vi.fn(),
			end: vi.fn()
		};
		previewRawMiddleware!({
			url: '/index.vue',
			headers: { accept: 'text/plain' }
		}, rawResponse, vi.fn());
		expect(rawResponse.end).toHaveBeenCalledWith(expect.any(Buffer));
		expect(rawResponse.setHeader).toHaveBeenCalledWith(
			'Content-Type',
			'text/plain; charset=utf-8'
		);
		fs.rmSync(previewWorkspace, { recursive: true, force: true });
	});

	it('serves preview history from the workspace root without a development runtime', async () => {
		let middleware: Function | undefined;
		const server = {
			config: { root: path.resolve('site') },
			middlewares: {
				use: vi.fn((handler: Function) => {
					middleware = handler;
				})
			},
			transformIndexHtml: vi.fn(async (_url, html) => html)
		};
		const config = createDocsPlugins({ workspace: 'site', preview: true }) as any;
		const historyPlugin = config.plugins.find((plugin: any) => (
			plugin.name === 'docs-history-fallback'
		));
		historyPlugin.configureServer(server);
		const response = {
			writableEnded: false,
			statusCode: 0,
			setHeader: vi.fn(),
			end: vi.fn()
		};
		await middleware!({
			url: '/zh-CN/changelog-1.0',
			headers: { accept: 'text/html' }
		}, response, vi.fn());

		expect(server.transformIndexHtml).not.toHaveBeenCalled();
		expect(response.setHeader).toHaveBeenCalledWith('Content-Type', 'text/html; charset=utf-8');
		expect(response.end).toHaveBeenCalledWith(expect.not.stringContaining('__DOCS_RUNTIME__ ='));
		expect(response.end).toHaveBeenCalledWith(expect.not.stringContaining('/@vite/client'));

		const next = vi.fn();
		await middleware!({
			url: '/zh-CN/missing.md',
			headers: { accept: 'text/plain' }
		}, response, next);
		expect(next).toHaveBeenCalledOnce();

		const docsResponse = {
			...response,
			statusCode: 0,
			setHeader: vi.fn(),
			end: vi.fn()
		};
		await middleware!({ url: '/__docs/events' }, docsResponse, vi.fn());
		expect(docsResponse.statusCode).toBe(404);
		expect(docsResponse.end).toHaveBeenCalledWith('Not Found');
	});

	it('serves direct resources and rejects encoded workspace traversal before URL normalization', () => {
		const middlewares: Function[] = [];
		const server = {
			config: { root: process.cwd() },
			middlewares: {
				use: vi.fn((pathOrHandler: string | Function) => {
					if (typeof pathOrHandler === 'function') middlewares.push(pathOrHandler);
				})
			},
			watcher: { add: vi.fn(), on: vi.fn() },
			httpServer: { once: vi.fn() }
		};
		const config = createDocsPlugins({ workspace: 'site' }) as any;
		const workspacePlugin = config.plugins.find((plugin: any) => (
			plugin.name === 'docs-workspace-resources'
		));
		workspacePlugin.configureServer(server);
		const middleware = middlewares[0];
		expect(server.watcher.add).toHaveBeenCalledWith(path.resolve('packages'));
		expect(server.watcher.add).toHaveBeenCalledWith(path.resolve('README.md'));
		const createResponse = () => ({
			statusCode: 200,
			setHeader: vi.fn(),
			end: vi.fn()
		});

		const markdownResponse = createResponse();
		middleware({
			url: '/packages/client/README.md',
			headers: { accept: 'text/plain' }
		}, markdownResponse, vi.fn());
		expect(markdownResponse.setHeader).toHaveBeenCalledWith(
			'Content-Type',
			'text/markdown; charset=utf-8'
		);
		expect(markdownResponse.end).toHaveBeenCalledWith(expect.any(Buffer));

		const rootReadmeResponse = createResponse();
		middleware({
			url: '/README.md',
			headers: { accept: 'text/plain' }
		}, rootReadmeResponse, vi.fn());
		expect(rootReadmeResponse.setHeader).toHaveBeenCalledWith(
			'Content-Type',
			'text/markdown; charset=utf-8'
		);
		expect(rootReadmeResponse.setHeader).toHaveBeenCalledWith('ETag', expect.any(String));
		expect(rootReadmeResponse.end).toHaveBeenCalledWith(expect.any(Buffer));
		const rootReadmeEtag = rootReadmeResponse.setHeader.mock.calls
			.find(([name]) => name === 'ETag')?.[1];
		const notModifiedResponse = createResponse();
		middleware({
			url: '/README.md',
			headers: { 'accept': 'text/plain', 'if-none-match': rootReadmeEtag }
		}, notModifiedResponse, vi.fn());
		expect(notModifiedResponse.statusCode).toBe(304);
		expect(notModifiedResponse.end).toHaveBeenCalledWith();

		const traversalResponse = createResponse();
		middleware({
			url: '/site/%2e%2e/package.json',
			headers: { accept: 'text/plain' }
		}, traversalResponse, vi.fn());
		expect(traversalResponse.statusCode).toBe(403);
		expect(traversalResponse.end).toHaveBeenCalledWith('Forbidden');

		const malformedResponse = createResponse();
		middleware({
			url: '/site/%E0%A4%A',
			headers: { accept: 'text/plain' }
		}, malformedResponse, vi.fn());
		expect(malformedResponse.statusCode).toBe(400);
		expect(malformedResponse.end).toHaveBeenCalledWith('Bad Request');

		const escapedSourceResponse = createResponse();
		middleware({
			url: '/package.json',
			headers: { accept: 'text/plain' }
		}, escapedSourceResponse, vi.fn());
		expect(escapedSourceResponse.statusCode).toBe(403);
		expect(escapedSourceResponse.end).toHaveBeenCalledWith('Forbidden');

		const packageSourceResponse = createResponse();
		middleware({
			url: '/packages/client/src/index.ts',
			headers: { accept: 'text/plain' }
		}, packageSourceResponse, vi.fn());
		expect(packageSourceResponse.statusCode).toBe(403);
		expect(packageSourceResponse.end).toHaveBeenCalledWith('Forbidden');

		const moduleNext = vi.fn();
		middleware({
			url: '/packages/client/src/index.ts',
			headers: { accept: '*/*' }
		}, createResponse(), moduleNext);
		expect(moduleNext).toHaveBeenCalledOnce();

		const viteNext = vi.fn();
		middleware({
			url: '/@vite/client.ts',
			headers: { accept: 'text/plain' }
		}, createResponse(), viteNext);
		expect(viteNext).toHaveBeenCalledOnce();
	});

	it('serves root workspace resources, history and SSE with canonical paths', async () => {
		const root = fs.mkdtempSync(path.join(os.tmpdir(), 'docs-root-dev-'));
		fs.mkdirSync(path.join(root, 'zh-CN'), { recursive: true });
		fs.mkdirSync(path.join(root, 'packages/client'), { recursive: true });
		fs.writeFileSync(path.join(root, 'index.html'), '<div id="root-docs"></div>');
		fs.writeFileSync(path.join(root, 'README.md'), '# Root');
		fs.writeFileSync(path.join(root, 'zh-CN/index.md'), '# 首页');
		fs.writeFileSync(path.join(root, 'packages/client/README.md'), '# Client');
		const restoreCwd = vi.spyOn(process, 'cwd').mockReturnValue(root);
		try {
			const middlewareEntries: Array<[string | Function, Function?]> = [];
			const watcherHandlers = new Map<string, (filename: string) => void>();
			const server = {
				config: { root },
				middlewares: {
					use: vi.fn((pathOrHandler: string | Function, handler?: Function) => {
						middlewareEntries.push([pathOrHandler, handler]);
					})
				},
				watcher: {
					add: vi.fn(),
					on: vi.fn((event: string, handler: (filename: string) => void) => {
						watcherHandlers.set(event, handler);
					})
				},
				httpServer: { once: vi.fn() },
				transformIndexHtml: vi.fn(async (_url: string, html: string) => html)
			};
			const config = createDocsPlugins({ workspace: '.' }) as any;
			const workspacePlugin = config.plugins.find((plugin: any) => (
				plugin.name === 'docs-workspace-resources'
			));
			workspacePlugin.configureServer(server);
			const rawMiddleware = middlewareEntries
				.find(([route]) => typeof route === 'function')![0] as Function;
			const createResponse = () => ({
				statusCode: 200,
				setHeader: vi.fn(),
				end: vi.fn(),
				write: vi.fn()
			});
			const markdown = createResponse();
			rawMiddleware({
				url: '/zh-CN/index.md',
				headers: { accept: 'text/plain' }
			}, markdown, vi.fn());
			expect(markdown.end).toHaveBeenCalledWith(expect.any(Buffer));
			expect(markdown.setHeader).toHaveBeenCalledWith(
				'Content-Type',
				'text/markdown; charset=utf-8'
			);
			const blocked = createResponse();
			rawMiddleware({
				url: '/__docs/private.md',
				headers: { accept: 'text/plain' }
			}, blocked, vi.fn());
			expect(blocked.statusCode).toBe(404);

			const eventsMiddleware = middlewareEntries
				.find(([route]) => route === '/__docs/events')![1]!;
			const response = createResponse();
			eventsMiddleware({ on: vi.fn() }, response);
			watcherHandlers.get('change')!(path.join(root, 'zh-CN/index.md'));
			expect(response.write).toHaveBeenLastCalledWith(expect.stringContaining(
				'"lang":"zh-CN","source":"./index.md"'
			));
			watcherHandlers.get('change')!(path.join(root, 'packages/client/README.md'));
			expect(response.write).toHaveBeenLastCalledWith(expect.stringContaining(
				'"lang":"","source":"packages/client/README.md"'
			));
			watcherHandlers.get('change')!(path.join(root, 'index.html'));
			expect(response.write).toHaveBeenLastCalledWith(expect.stringContaining('"type":"reload"'));

			let historyMiddleware: Function | undefined;
			const historyPlugin = config.plugins.find((plugin: any) => (
				plugin.name === 'docs-history-fallback'
			));
			historyPlugin.configureServer({
				...server,
				middlewares: { use: vi.fn((handler: Function) => { historyMiddleware = handler; }) }
			});
			const historyResponse = createResponse();
			await historyMiddleware!({
				url: '/zh-CN/guide',
				headers: { accept: 'text/html' }
			}, historyResponse, vi.fn());
			expect(historyResponse.end).toHaveBeenCalledWith('<div id="root-docs"></div>');
		} finally {
			restoreCwd.mockRestore();
			fs.rmSync(root, { recursive: true, force: true });
		}
	});

	it('streams workspace changes over SSE and releases disconnected clients', () => {
		const middlewareEntries: Array<[string | Function, Function?]> = [];
		const watcherHandlers = new Map<string, (filename: string) => void>();
		let closeServer: (() => void) | undefined;
		const server = {
			config: { root: process.cwd() },
			middlewares: {
				use: vi.fn((pathOrHandler: string | Function, handler?: Function) => {
					middlewareEntries.push([pathOrHandler, handler]);
				})
			},
			watcher: {
				add: vi.fn(),
				on: vi.fn((event: string, handler: (filename: string) => void) => {
					watcherHandlers.set(event, handler);
				})
			},
			httpServer: {
				once: vi.fn((_event: string, handler: () => void) => {
					closeServer = handler;
				})
			}
		};
		const config = createDocsPlugins({ workspace: 'site' }) as any;
		const workspacePlugin = config.plugins.find((plugin: any) => (
			plugin.name === 'docs-workspace-resources'
		));
		workspacePlugin.configureServer(server);

		const eventsEntry = middlewareEntries.find(([route]) => route === '/__docs/events');
		expect(eventsEntry).toBeDefined();
		const eventsMiddleware = eventsEntry![1]!;
		let closeClient: (() => void) | undefined;
		const request = {
			on: vi.fn((_event: string, handler: () => void) => {
				closeClient = handler;
			})
		};
		const response = {
			statusCode: 0,
			setHeader: vi.fn(),
			write: vi.fn(),
			end: vi.fn()
		};
		eventsMiddleware(request, response);
		expect(response.statusCode).toBe(200);
		expect(response.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream');
		expect(response.write).toHaveBeenCalledWith(': connected\n\n');

		watcherHandlers.get('change')!(path.resolve('site/zh-CN/guide.md'));
		expect(response.write).toHaveBeenLastCalledWith(expect.stringContaining(
			'"type":"change","lang":"zh-CN","source":"./guide.md","resourceType":"markdown"'
		));
		watcherHandlers.get('change')!(path.resolve('package.json'));
		expect(response.write).toHaveBeenCalledTimes(2);
		watcherHandlers.get('change')!(path.resolve('packages/client/README.md'));
		expect(response.write).toHaveBeenLastCalledWith(expect.stringContaining(
			'"lang":"","source":"packages/client/README.md","resourceType":"markdown"'
		));
		watcherHandlers.get('change')!(path.resolve('README.md'));
		expect(response.write).toHaveBeenLastCalledWith(expect.stringContaining(
			'"lang":"","source":"README.md","resourceType":"markdown"'
		));

		watcherHandlers.get('change')!(path.resolve('site/index.html'));
		expect(response.write).toHaveBeenLastCalledWith(expect.stringContaining('"type":"reload"'));
		closeClient!();
		watcherHandlers.get('unlink')!(path.resolve('site/zh-CN/guide.md'));
		expect(response.write).toHaveBeenCalledTimes(5);

		eventsMiddleware(request, response);
		closeServer!();
		expect(response.end).toHaveBeenCalledOnce();
	});
});
