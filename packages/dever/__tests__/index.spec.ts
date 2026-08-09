import * as path from 'node:path';
import * as Dever from '../src';
import {
	createRuntimePlugin,
	default as createDocsPlugins,
	getResourceType,
	isInside
} from '../src/plugins';

// @vitest-environment node
describe('dever configuration', () => {
	it('exports run and creates development and build roots', () => {
		expect(Dever.run).toBeTypeOf('function');
		const development = Dever.createDeverConfig({ workspace: 'site' } as any);
		expect(development.root).toBe(process.cwd());
		expect(development.resolve?.alias).toMatchObject({
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
	});

	it('injects the development runtime before application scripts', () => {
		const plugin = createRuntimePlugin({ workspace: 'docs' });
		const transform = plugin.transformIndexHtml as any;
		const tags = transform.handler();
		expect(tags[0]).toMatchObject({ tag: 'script', injectTo: 'head-prepend' });
		expect(tags[0].children).toContain('window.__DOCS_RUNTIME__');
		expect(tags[0].children).toContain('"workspace":"/docs/"');
		expect(createRuntimePlugin({ build: true }).transformIndexHtml).toBeUndefined();
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

		watcherHandlers.get('change')!(path.resolve('site/index.html'));
		expect(response.write).toHaveBeenLastCalledWith(expect.stringContaining('"type":"reload"'));
		closeClient!();
		watcherHandlers.get('unlink')!(path.resolve('site/zh-CN/guide.md'));
		expect(response.write).toHaveBeenCalledTimes(3);

		eventsMiddleware(request, response);
		closeServer!();
		expect(response.end).toHaveBeenCalledOnce();
	});
});
