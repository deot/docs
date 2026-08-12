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
	preview?: boolean;
}

const innerPathRegex = /^\/(@|__)/;
const directResourceExtensions = new Set(['.md', '.json']);
const sourceResourceExtensions = new Set(['.vue', '.js', '.ts', '.css']);
const gatewayResourceExtensions = new Set([
	...directResourceExtensions,
	...sourceResourceExtensions
]);

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

const getRequestHeader = (value: string | string[] | undefined) => (
	Array.isArray(value) ? value.join(',') : value || ''
);

const getRawPathname = (url: string) => url.split(/[?#]/u, 1)[0] || '/';

/*
 * 在 WHATWG URL 规范化之前校验请求目标。`new URL()` 会折叠编码的点路径段；
 * 若只检查 pathname，`/site/%2e%2e/package.json` 会变成 `/package.json`，
 * 从而完全绕过 workspace 边界。
 */
const decodeWorkspacePath = (requestUrl: string, urlPrefix: string) => {
	const rawPathname = getRawPathname(requestUrl);
	if (!rawPathname.startsWith(urlPrefix)) return null;
	let decoded: string;
	try {
		decoded = decodeURIComponent(rawPathname.slice(urlPrefix.length));
	} catch {
		throw new URIError('Bad Request');
	}
	if (
		decoded.includes('\0')
		|| decoded.includes('\\')
		|| decoded.split('/').includes('..')
		|| path.isAbsolute(decoded)
	) throw new RangeError('Forbidden');
	return decoded;
};

// 仓库级映射只开放子包入口 README，不能借此读取子包内的其他源码。
const isPackageReadme = (relative: string) => (
	/^[^/]+\/README\.md$/u.test(relative)
);

const getContentType = (extension: string) => {
	switch (extension) {
		case '.md': return 'text/markdown; charset=utf-8';
		case '.json': return 'application/json; charset=utf-8';
		case '.css': return 'text/css; charset=utf-8';
		default: return 'text/plain; charset=utf-8';
	}
};

// If-None-Match 优先，过期日期不能掩盖已变化的 ETag。
export const isNotModified = (
	headers: Record<string, string | string[] | undefined>,
	etag: string,
	lastModified: string
) => {
	const noneMatch = getRequestHeader(headers['if-none-match']);
	if (noneMatch) {
		return noneMatch === '*' || noneMatch.split(',').some(value => value.trim() === etag);
	}
	const modifiedSince = getRequestHeader(headers['if-modified-since']);
	return Boolean(modifiedSince && Date.parse(modifiedSince) >= Date.parse(lastModified));
};

export const createRuntimePlugin = (options: DocsPluginOptions): Plugin => ({
	name: 'docs-runtime',
	transformIndexHtml: options.build || options.preview
		? undefined
		: {
				order: 'pre',
				handler() {
					const workspace = `/${(options.workspace || 'site').replace(/^\/+|\/+$/g, '')}/`;
					const localClientEntry = path.resolve(
						process.cwd(),
						'packages/client/src/index.ts'
					);
					const runtime = JSON.stringify({
						mode: 'development',
						workspace,
						events: '/__docs/events'
					}).replace(/</g, '\\u003c');
					const styles = fs.existsSync(localClientEntry)
						? []
						: ['//unpkg.com/@deot/docs-client/dist/index.style.css'];
					return [
						{
							tag: 'script',
							children: `window.__DOCS_RUNTIME__ = Object.freeze(${runtime});`,
							injectTo: 'head-prepend'
						},
						...styles.map(href => ({
							tag: 'link',
							attrs: {
								rel: 'stylesheet',
								href
							},
							injectTo: 'head-prepend' as const
						}))
					];
				}
			}
});

// 在 Vite 转换模块请求之前返回源码形式的 SFC 依赖。
const configureWorkspaceServer = (options: DocsPluginOptions) => (server: ViteDevServer) => {
	const root = server.config.root;
	const workspaceName = (options.workspace || 'site').replace(/^\/+|\/+$/g, '');
	const workspace = options.preview ? root : path.resolve(root, workspaceName);
	const realWorkspace = fs.existsSync(workspace) ? fs.realpathSync(workspace) : workspace;
	const packages = path.resolve(root, 'packages');
	const realPackages = fs.existsSync(packages) ? fs.realpathSync(packages) : packages;
	const rootReadme = path.resolve(root, 'README.md');
	const urlPrefix = options.preview ? '/' : `/${workspaceName}/`;

	server.middlewares.use((req, res, next) => {
		let decoded: string | null;
		let resourceRoot = workspace;
		let realResourceRoot = realWorkspace;
		try {
			decoded = decodeWorkspacePath(req.url || '/', urlPrefix);
			if (decoded === null && !options.preview && getRawPathname(req.url || '/') === '/README.md') {
				decoded = 'README.md';
				resourceRoot = root;
				realResourceRoot = fs.realpathSync(root);
			}
			if (decoded === null && !options.preview) {
				const packagePath = decodeWorkspacePath(req.url || '/', '/packages/');
				if (packagePath !== null && isPackageReadme(packagePath)) {
					decoded = packagePath;
					resourceRoot = packages;
					realResourceRoot = realPackages;
				}
			}
		} catch (reason) {
			res.statusCode = reason instanceof URIError ? 400 : 403;
			res.end(reason instanceof URIError ? 'Bad Request' : 'Forbidden');
			return;
		}
		if (decoded === null) {
			let pathname: string;
			try {
				pathname = decodeURIComponent(getRawPathname(req.url || '/'));
			} catch {
				res.statusCode = 400;
				res.end('Bad Request');
				return;
			}
			const extension = path.posix.extname(pathname).toLowerCase();
			const acceptsSource = String(req.headers.accept || '').includes('text/plain');
			// 相对 SFC import 到达该 middleware 前可能已被规范化到 /site 外部。
			// 禁止 Vite 以仓库根目录将逃逸 URL 变成可读取源码；内部 Vite endpoint
			// 和普通模块请求仍保持原行为。
			if (
				acceptsSource
				&& gatewayResourceExtensions.has(extension)
				&& !innerPathRegex.test(pathname)
			) {
				res.statusCode = 403;
				res.end('Forbidden');
				return;
			}
			return next();
		}
		const filename = path.resolve(resourceRoot, decoded);
		if (!isInside(resourceRoot, filename)) {
			res.statusCode = 403;
			res.end('Forbidden');
			return;
		}
		const extension = path.extname(filename).toLowerCase();
		const acceptsSource = String(req.headers.accept || '').includes('text/plain');
		const servesDirectResource = directResourceExtensions.has(extension);
		const servesSourceResource = sourceResourceExtensions.has(extension) && acceptsSource;
		if (!servesDirectResource && !servesSourceResource) return next();
		if (!fs.existsSync(filename) || !fs.statSync(filename).isFile()) {
			res.statusCode = 404;
			res.end('Not Found');
			return;
		}
		const realFilename = fs.realpathSync(filename);
		if (!isInside(realResourceRoot, realFilename)) {
			res.statusCode = 403;
			res.end('Forbidden');
			return;
		}
		const content = fs.readFileSync(realFilename);
		const stat = fs.statSync(realFilename);
		const etag = createEtag(content);
		const lastModified = stat.mtime.toUTCString();
		res.setHeader('ETag', etag);
		res.setHeader('Last-Modified', lastModified);
		if (isNotModified(req.headers, etag, lastModified)) {
			res.statusCode = 304;
			res.end();
			return;
		}
		res.setHeader('Content-Type', getContentType(extension));
		res.end(content);
	});

	if (!options.preview) configureEvents(server, workspace, packages, rootReadme);
};

const createWorkspacePlugin = (options: DocsPluginOptions): Plugin => ({
	name: 'docs-workspace-resources',
	configureServer: options.build
		? undefined
		: configureWorkspaceServer(options)
});

// 广播 workspace 的逻辑 identity；重连由 EventSource 自行处理。
const configureEvents = (
	server: ViteDevServer,
	workspace: string,
	packages: string,
	rootReadme: string
) => {
	const clients = new Set<import('node:http').ServerResponse>();
	// packages 不一定进入 Vite 模块图，必须显式加入 watcher 才能广播 README 更新。
	server.watcher.add(packages);
	server.watcher.add(rootReadme);
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
		if (absolute === rootReadme) {
			const payload = JSON.stringify({
				type,
				// 根 README 被多种语言共用，空语言要求 Client 更新全部 identity。
				lang: '',
				source: 'README.md',
				resourceType: 'markdown',
				timestamp: Date.now()
			});
			clients.forEach(client => client.write(`data: ${payload}\n\n`));
			return;
		}
		const inWorkspace = isInside(workspace, absolute);
		const inPackages = isInside(packages, absolute);
		if (!inWorkspace && !inPackages) return;
		const relative = path.relative(
			inWorkspace ? workspace : packages,
			absolute
		).split(path.sep).join('/');
		if (inPackages) {
			if (!isPackageReadme(relative)) return;
			const payload = JSON.stringify({
				type,
				// 空语言表示该共享 README 的所有本地化 identity。
				lang: '',
				source: `packages/${relative}`,
				resourceType: 'markdown',
				timestamp: Date.now()
			});
			clients.forEach(client => client.write(`data: ${payload}\n\n`));
			return;
		}
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
			const candidate = path.resolve(root, `.${url}`);
			const isFile = fs.existsSync(candidate) && fs.statSync(candidate).isFile();
			if (options.preview && url.startsWith('/__docs/')) {
				res.statusCode = 404;
				res.end('Not Found');
				return;
			}
			if (
				res.writableEnded
				|| requestUrl.includes('html-proxy&')
				|| innerPathRegex.test(url)
				|| isFile
			) return next();
			// 浏览器导航声明接受 HTML；ResourceGateway 使用 text/plain，因此缺失的
			// .md/.vue 仍返回真实 404，同时路由 slug 可以安全包含点号。
			const accept = String(req.headers?.accept || 'text/html');
			if (!accept.includes('text/html')) return next();
			const indexFile = options.preview
				? path.resolve(root, 'index.html')
				: path.resolve(root, options.workspace || 'site', 'index.html');
			if (!fs.existsSync(indexFile)) {
				res.statusCode = 404;
				res.end('Not Found');
				return;
			}
			res.setHeader('Content-Type', 'text/html; charset=utf-8');
			const html = fs.readFileSync(indexFile, 'utf8');
			res.end(options.preview
				? html
				: await server.transformIndexHtml(url, html, req.originalUrl));
		});
	}
});

const createStaticCopyPlugin = (options: DocsPluginOptions): Plugin => ({
	name: 'docs-static-resources',
	writeBundle() {
		if (!options.build) return;
		const workspace = path.resolve(process.cwd(), options.workspace || 'site');
		const outDir = path.resolve(process.cwd(), options.outDir || 'dist');
		const realOutDir = fs.realpathSync(outDir);
		const isBuildOutputSource = (source: string) => {
			const realSource = fs.existsSync(source) ? fs.realpathSync(source) : path.resolve(source);
			return isInside(realOutDir, realSource);
		};
		const copyResource = (source: string, target: string) => {
			if (isBuildOutputSource(source)) return;
			const stat = fs.lstatSync(source);
			if (!stat.isDirectory()) {
				fs.cpSync(source, target, { force: true });
				return;
			}
			fs.mkdirSync(target, { recursive: true });
			// 当 outDir 位于 workspace 内时，node:fs 会在 filter 执行前拒绝
			// parent -> child 的 cp，因此这里自行递归复制目录。
			fs.readdirSync(source).forEach((name) => {
				copyResource(path.join(source, name), path.join(target, name));
			});
		};
		fs.readdirSync(workspace, { withFileTypes: true }).forEach((entry) => {
			if (entry.name === 'index.html' || entry.name.startsWith('.')) return;
			copyResource(path.join(workspace, entry.name), path.join(outDir, entry.name));
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
