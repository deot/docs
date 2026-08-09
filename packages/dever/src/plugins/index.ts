import vue from '@vitejs/plugin-vue';
import vueJsx from '@vitejs/plugin-vue-jsx';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import { defineConfig } from 'vite';
import type { Plugin, ViteDevServer } from 'vite';

interface DocsPluginOptions {
	workspace?: string;
	outDir?: string;
	build?: boolean;
}

const pathRegex = /^\/$|^\/(?:[^/]+\/)*[^/.]+?\/?$/;
const innerPathRegex = /^\/(@|__)/;
const rawExtensions = new Set(['.vue', '.js', '.ts', '.css']);

export const getResourceType = (filename: string) => {
	switch (path.extname(filename).toLowerCase()) {
		case '.md': return 'markdown';
		case '.json': return 'sidebar';
		case '.vue': return 'sfc';
		case '.css': return 'style';
		default: return 'module';
	}
};

export const isInside = (parent: string, target: string) => {
	const relative = path.relative(parent, target);
	return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
};

const createEtag = (content: Buffer) => `W/"${createHash('sha1').update(content).digest('hex')}"`;

export const createRuntimePlugin = (options: DocsPluginOptions): Plugin => ({
	name: 'docs-runtime',
	transformIndexHtml: options.build
		? undefined
		: {
				order: 'pre',
				handler() {
					const workspace = `/${(options.workspace || 'site').replace(/^\/+|\/+$/g, '')}/`;
					const runtime = JSON.stringify({
						mode: 'development',
						workspace,
						events: '/__docs/events'
					}).replace(/</g, '\\u003c');
					return [{
						tag: 'script',
						children: `window.__DOCS_RUNTIME__ = Object.freeze(${runtime});`,
						injectTo: 'head-prepend'
					}];
				}
			}
});

const createWorkspacePlugin = (options: DocsPluginOptions): Plugin => ({
	name: 'docs-workspace-resources',
	configureServer(server) {
		const root = server.config.root;
		const workspaceName = (options.workspace || 'site').replace(/^\/+|\/+$/g, '');
		const workspace = path.resolve(root, workspaceName);
		const urlPrefix = `/${workspaceName}/`;

		server.middlewares.use((req, res, next) => {
			const requestUrl = new URL(req.url || '/', 'http://docs.local');
			if (!requestUrl.pathname.startsWith(urlPrefix)) return next();
			let decoded: string;
			try {
				decoded = decodeURIComponent(requestUrl.pathname.slice(urlPrefix.length));
			} catch {
				res.statusCode = 400;
				res.end('Bad Request');
				return;
			}
			const filename = path.resolve(workspace, decoded);
			if (!isInside(workspace, filename)) {
				res.statusCode = 403;
				res.end('Forbidden');
				return;
			}
			const extension = path.extname(filename).toLowerCase();
			const acceptsSource = String(req.headers.accept || '').includes('text/plain');
			if (!rawExtensions.has(extension) || !acceptsSource) return next();
			if (!fs.existsSync(filename) || !fs.statSync(filename).isFile()) {
				res.statusCode = 404;
				res.end('Not Found');
				return;
			}
			const content = fs.readFileSync(filename);
			const stat = fs.statSync(filename);
			const etag = createEtag(content);
			const lastModified = stat.mtime.toUTCString();
			res.setHeader('ETag', etag);
			res.setHeader('Last-Modified', lastModified);
			if (
				req.headers['if-none-match'] === etag
				|| req.headers['if-modified-since'] === lastModified
			) {
				res.statusCode = 304;
				res.end();
				return;
			}
			res.setHeader('Content-Type', extension === '.css'
				? 'text/css; charset=utf-8'
				: 'text/plain; charset=utf-8');
			res.end(content);
		});

		configureEvents(server, workspace);
	}
});

const configureEvents = (server: ViteDevServer, workspace: string) => {
	const clients = new Set<import('node:http').ServerResponse>();
	server.middlewares.use('/__docs/events', (req, res) => {
		res.statusCode = 200;
		res.setHeader('Content-Type', 'text/event-stream');
		res.setHeader('Cache-Control', 'no-cache');
		res.setHeader('Connection', 'keep-alive');
		res.write(': connected\n\n');
		clients.add(res);
		req.on('close', () => clients.delete(res));
	});

	const send = (type: 'add' | 'change' | 'unlink', filename: string) => {
		const absolute = path.resolve(filename);
		if (!isInside(workspace, absolute)) return;
		const relative = path.relative(workspace, absolute).split(path.sep).join('/');
		if (relative === 'index.html') {
			const payload = JSON.stringify({ type: 'reload', timestamp: Date.now() });
			clients.forEach(client => client.write(`data: ${payload}\n\n`));
			return;
		}
		const [lang, ...segments] = relative.split('/');
		if (!lang || !segments.length) return;
		const payload = JSON.stringify({
			type,
			lang,
			source: `./${segments.join('/')}`,
			resourceType: getResourceType(relative),
			timestamp: Date.now()
		});
		clients.forEach(client => client.write(`data: ${payload}\n\n`));
	};
	server.watcher.on('add', filename => send('add', filename));
	server.watcher.on('change', filename => send('change', filename));
	server.watcher.on('unlink', filename => send('unlink', filename));
	server.httpServer?.once('close', () => {
		clients.forEach(client => client.end());
		clients.clear();
	});
};

const createHistoryPlugin = (options: DocsPluginOptions): Plugin => ({
	name: 'docs-history-fallback',
	configureServer(server) {
		const root = server.config.root;
		server.middlewares.use(async (req, res, next) => {
			const requestUrl = req.url || '/';
			const url = requestUrl.replace(/\/+/g, '/').replace(/[?#].*$/s, '') || '';
			const isPath = pathRegex.test(url);
			if (
				res.writableEnded
				|| requestUrl.includes('html-proxy&')
				|| innerPathRegex.test(url)
				|| (!isPath && fs.existsSync(path.resolve(root, `.${url}`)))
			) return next();
			if (!isPath) return next();
			const indexFile = path.resolve(root, options.workspace || 'site', 'index.html');
			if (!fs.existsSync(indexFile)) {
				res.statusCode = 404;
				res.end('Not Found');
				return;
			}
			res.setHeader('Content-Type', 'text/html; charset=utf-8');
			res.end(await server.transformIndexHtml(
				url,
				fs.readFileSync(indexFile, 'utf8'),
				req.originalUrl
			));
		});
	}
});

const createStaticCopyPlugin = (options: DocsPluginOptions): Plugin => ({
	name: 'docs-static-resources',
	writeBundle() {
		if (!options.build) return;
		const workspace = path.resolve(process.cwd(), options.workspace || 'site');
		const outDir = path.resolve(process.cwd(), options.outDir || 'dist');
		fs.readdirSync(workspace, { withFileTypes: true }).forEach((entry) => {
			if (entry.name === 'index.html' || entry.name.startsWith('.')) return;
			fs.cpSync(path.join(workspace, entry.name), path.join(outDir, entry.name), {
				recursive: true,
				force: true
			});
		});
	}
});

export default (options: DocsPluginOptions = {}) => defineConfig({
	plugins: [
		createRuntimePlugin(options),
		createWorkspacePlugin(options),
		createHistoryPlugin(options),
		createStaticCopyPlugin(options),
		vue(),
		vueJsx()
	]
});
