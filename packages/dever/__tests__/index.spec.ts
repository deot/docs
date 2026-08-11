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
	isNotModified
} from '../src/plugins';
import { createPreviewRequestHandler } from '../src/preview';

// @vitest-environment node
describe('dever configuration', () => {
	it('maps package readmes to local dev resources and remote preview resources', () => {
		const html = fs.readFileSync(path.resolve('site/index.html'), 'utf8');
		const configScript = html.match(/<script>([\s\S]*?)<\/script>/u)?.[1];
		expect(configScript).toBeTruthy();
		const target: Record<string, any> = {};
		vm.runInNewContext(configScript!, {
			window: target,
			location: {
				pathname: '/zh-CN/client',
				origin: 'http://localhost:4173',
				href: 'http://localhost:4173/zh-CN/client'
			},
			URL,
			encodeURIComponent
		});
		const config = target.$docs;
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
			href: '../dever/README.md?tab=api#rules',
			lang: 'en-US',
			source: 'packages/index/README.md'
		})).toBe('/en-US/dever?tab=api#rules');
		expect(config.resolve.link({
			href: '../cli/README.md',
			lang: 'zh-CN',
			source: 'packages/index/README.md'
		})).toBe('/zh-CN/cli');
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
		const sidebar = config.resolve.resource({
			source: './sidebar.json',
			type: 'sidebar',
			runtime: { mode: 'production' }
		});
		expect(JSON.parse(decodeURIComponent(sidebar.split(',')[1])))
			.toEqual(expect.arrayContaining([
				{ label: '@deot/docs', value: '/index' },
				{ label: '@deot/docs-client', value: '/client' }
			]));
	});

	it('exports run and creates isolated development, build and preview configs', () => {
		expect(Dever.run).toBeTypeOf('function');
		const development = Dever.createDeverConfig({ workspace: 'site' } as any);
		expect(development.root).toBe(process.cwd());
		expect(development.resolve?.alias).toMatchObject({
			'@deot/docs-locale': expect.stringContaining('packages/locale/src/index.ts'),
			'@deot/docs-markdown': expect.stringContaining('packages/markdown/src/index.ts'),
			'@deot/docs-playground': expect.stringContaining('packages/playground/src/index.ts')
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
		fs.mkdirSync(outDir, { recursive: true });
		fs.writeFileSync(path.join(workspace, 'zh-CN/index.md'), '# Docs');
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

	it('previews static resources without Vite runtime, SSE or a generated site dist', async () => {
		const root = fs.mkdtempSync(path.join(os.tmpdir(), 'docs-preview-'));
		const workspace = path.join(root, 'site');
		const clientDist = path.join(root, 'client');
		fs.mkdirSync(path.join(workspace, 'zh-CN'), { recursive: true });
		fs.mkdirSync(path.join(clientDist, 'chunks'), { recursive: true });
		fs.writeFileSync(path.join(workspace, 'index.html'), [
			'<!DOCTYPE html><link href="https://unpkg.com/@deot/docs-client@1.0.0/dist/index.style.css">',
			'<script type="module" src="//unpkg.com/@deot/docs-client/dist/index.js"></script>'
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
			expect(html).toContain('/@deot/docs-client/index.style.css');
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
		const plugin = createRuntimePlugin({ workspace: 'docs' });
		const transform = plugin.transformIndexHtml as any;
		const tags = transform.handler();
		expect(tags[0]).toMatchObject({ tag: 'script', injectTo: 'head-prepend' });
		expect(tags[0].children).toContain('window.__DOCS_RUNTIME__');
		expect(tags[0].children).toContain('"workspace":"/docs/"');
		expect(tags).toHaveLength(1);
		expect(createRuntimePlugin({ build: true }).transformIndexHtml).toBeUndefined();
		expect(createRuntimePlugin({ preview: true }).transformIndexHtml).toBeUndefined();

		const previewWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), 'docs-plugin-preview-'));
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

		watcherHandlers.get('change')!(path.resolve('site/index.html'));
		expect(response.write).toHaveBeenLastCalledWith(expect.stringContaining('"type":"reload"'));
		closeClient!();
		watcherHandlers.get('unlink')!(path.resolve('site/zh-CN/guide.md'));
		expect(response.write).toHaveBeenCalledTimes(4);

		eventsMiddleware(request, response);
		closeServer!();
		expect(response.end).toHaveBeenCalledOnce();
	});
});
