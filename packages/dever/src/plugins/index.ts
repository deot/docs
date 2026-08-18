import vue from '@vitejs/plugin-vue';
import vueJsx from '@vitejs/plugin-vue-jsx';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import { defineConfig } from 'vite';
import type { Plugin, ViteDevServer } from 'vite';
import { isInside, resolveDocsWorkspace } from '../workspace';
import type { ResolvedDocsWorkspace } from '../workspace';
import type { DocsPluginOptions } from '../types';

export { isInside };

const innerPathRegex = /^\/(@|__)/;
const directResourceExtensions = new Set(['.md', '.json']);
const sourceResourceExtensions = new Set(['.vue', '.js', '.ts', '.css']);
const gatewayResourceExtensions = new Set([
	...directResourceExtensions,
	...sourceResourceExtensions
]);

/**
 * 按扩展名判断文档资源类型。与 client `classifyResourceSource` 对齐。
 * @param filename 工作区内的资源路径。
 * @returns 资源类型。
 */
export const getResourceType = (filename: string) => {
	if (/\.page\.json$/i.test(filename)) return 'page';
	switch (path.extname(filename).toLowerCase()) {
		case '.md': return 'markdown';
		case '.json': return 'sidebar';
		case '.vue': return 'sfc';
		case '.css': return 'style';
		default: return 'module';
	}
};

const createEtag = (content: Buffer) => `W/"${createHash('sha1').update(content).digest('hex')}"`;

const getRequestHeader = (value: string | string[] | undefined) => (
	Array.isArray(value) ? value.join(',') : value || ''
);

const getRawPathname = (url: string) => url.split(/[?#]/u, 1)[0] || '/';

const readJsonBody = async (req: import('node:http').IncomingMessage, limit = 2 * 1024 * 1024) => {
	const chunks: Buffer[] = [];
	let size = 0;
	for await (const chunk of req) {
		const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
		size += buffer.length;
		if (size > limit) throw new RangeError('Payload Too Large');
		chunks.push(buffer);
	}
	return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
};

const resolveExistingRealPath = (filename: string) => {
	const tail: string[] = [];
	let cursor = filename;
	while (!fs.existsSync(cursor)) {
		const parent = path.dirname(cursor);
		if (parent === cursor) break;
		tail.unshift(path.basename(cursor));
		cursor = parent;
	}
	return path.resolve(fs.realpathSync(cursor), ...tail);
};

/**
 * 将编辑器逻辑地址转换为 workspace 内的 Page JSON 文件。该入口只接受带语言
 * 的相对资源地址，避免保存能力演变成任意文件写入接口。
 * @param workspace 文档资源根目录。
 * @param lang 页面使用的业务语言。
 * @param source `.page.json` 逻辑资源地址。
 * @returns 通过现有符号链接边界检查的文件绝对路径。
 */
export const resolvePageSaveTarget = (workspace: string, lang: string, source: string) => {
	if (!/^[a-z\d_-]+$/iu.test(lang)) throw new RangeError('Invalid language');
	if (
		!source
		|| source.includes('\\')
		|| source.includes('\0')
		|| source.includes('?')
		|| source.includes('#')
		|| path.posix.isAbsolute(source)
	) throw new RangeError('Invalid page source');
	const relative = source.replace(/^\.\//u, '');
	if (!/\.page\.json$/iu.test(relative) || relative.split('/').includes('..')) {
		throw new RangeError('Invalid page source');
	}
	const target = path.resolve(workspace, lang, relative);
	const realWorkspace = fs.realpathSync(workspace);
	if (!isInside(workspace, target) || !isInside(realWorkspace, resolveExistingRealPath(target))) {
		throw new RangeError('Forbidden');
	}
	return target;
};

const configurePageWriter = (server: ViteDevServer, workspace: string) => {
	server.middlewares.use('/__docs/page', async (req, res) => {
		if (req.method !== 'PUT') {
			res.statusCode = 405;
			res.setHeader('Allow', 'PUT');
			res.end('Method Not Allowed');
			return;
		}
		if (!String(req.headers['content-type'] || '').startsWith('application/json')) {
			res.statusCode = 415;
			res.end('Unsupported Media Type');
			return;
		}
		try {
			const body = await readJsonBody(req);
			if (!body || typeof body !== 'object') throw new TypeError('Invalid page payload');
			const { lang, source, document } = body as Record<string, unknown>;
			if (typeof lang !== 'string' || typeof source !== 'string') {
				throw new TypeError('Invalid page payload');
			}
			if (!document || typeof document !== 'object' || Array.isArray(document)) {
				throw new TypeError('Invalid page document');
			}
			const page = document as Record<string, unknown>;
			const meta = page.meta as Record<string, unknown> | undefined;
			const layout = page.layout as Record<string, unknown> | undefined;
			if (
				page.schemaVersion !== 2
				|| !meta
				|| typeof meta.id !== 'string'
				|| !meta.id
				|| !layout
				|| !['sortable', 'draggable'].includes(String(layout.mode))
				|| !Array.isArray(page.blocks)
			) throw new TypeError('Invalid page document');
			const target = resolvePageSaveTarget(workspace, lang, source);
			const content = `${JSON.stringify(document, null, 2)}\n`;
			fs.mkdirSync(path.dirname(target), { recursive: true });
			const temporary = `${target}.${process.pid}.${Date.now()}.tmp`;
			try {
				fs.writeFileSync(temporary, content, { flag: 'wx' });
				fs.renameSync(temporary, target);
			} finally {
				if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
			}
			const etag = createEtag(Buffer.from(content));
			res.statusCode = 200;
			res.setHeader('Content-Type', 'application/json; charset=utf-8');
			res.end(JSON.stringify({ source, etag }));
		} catch (reason) {
			res.statusCode = reason instanceof RangeError
				? reason.message === 'Payload Too Large' ? 413 : 403
				: 400;
			res.end(reason instanceof Error ? reason.message : 'Invalid page payload');
		}
	});
};

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

export const createRuntimePlugin = (
	options: DocsPluginOptions,
	resolvedWorkspace?: ResolvedDocsWorkspace
): Plugin => ({
	name: 'docs-runtime',
	transformIndexHtml: options.build || options.preview
		? undefined
		: {
				order: 'pre',
				handler() {
					const workspace = (resolvedWorkspace || resolveDocsWorkspace(
						process.cwd(),
						options.workspace
					)).urlBase;
					const localClientEntry = path.resolve(
						process.cwd(),
						'packages/client/src/index.ts'
					);
					// 形状对齐 client DocsRuntime；workspace 是 urlBase。
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
const configureWorkspaceServer = (
	options: DocsPluginOptions,
	resolvedWorkspace?: ResolvedDocsWorkspace
) => (server: ViteDevServer) => {
	const root = server.config.root;
	const resolved = resolvedWorkspace || resolveDocsWorkspace(
		options.preview ? root : process.cwd(),
		options.preview ? '.' : options.workspace
	);
	const workspace = resolved.root;
	const realWorkspace = fs.existsSync(workspace) ? fs.realpathSync(workspace) : workspace;
	const packagesCandidate = path.resolve(resolved.projectRoot, 'packages');
	const realPackagesCandidate = fs.existsSync(packagesCandidate)
		? fs.realpathSync(packagesCandidate)
		: packagesCandidate;
	// 仓库级 README 映射也必须留在项目边界内，不能借 packages 符号链接读外部文件。
	const packages = isInside(resolved.projectRoot, realPackagesCandidate)
		? packagesCandidate
		: path.resolve(resolved.projectRoot, '__docs_inaccessible_packages__');
	const realPackages = packages === packagesCandidate
		? realPackagesCandidate
		: packages;
	const rootReadme = path.resolve(resolved.projectRoot, 'README.md');
	const urlPrefix = options.preview ? '/' : resolved.urlBase;
	if (!options.preview) configurePageWriter(server, workspace);

	server.middlewares.use((req, res, next) => {
		let decoded: string | null;
		let resourceRoot = workspace;
		let realResourceRoot = realWorkspace;
		try {
			const rawPathname = getRawPathname(req.url || '/');
			if (rawPathname.startsWith('/__docs/') && rawPathname !== '/__docs/events') {
				res.statusCode = 404;
				res.end('Not Found');
				return;
			}
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

	if (!options.preview) configureEvents(
		server,
		workspace,
		resolved.entry,
		packages,
		rootReadme
	);
};

const createWorkspacePlugin = (
	options: DocsPluginOptions,
	resolvedWorkspace?: ResolvedDocsWorkspace
): Plugin => ({
	name: 'docs-workspace-resources',
	configureServer: options.build
		? undefined
		: configureWorkspaceServer(options, resolvedWorkspace)
});

// 广播 workspace 的逻辑 identity；重连由 EventSource 自行处理。
const configureEvents = (
	server: ViteDevServer,
	workspace: string,
	entry: string,
	packages: string,
	rootReadme: string
) => {
	const clients = new Set<import('node:http').ServerResponse>();
	const realEntry = fs.realpathSync(entry);
	// packages 不一定进入 Vite 模块图，必须显式加入 watcher 才能广播 README 更新。
	server.watcher.add(workspace);
	if (!isInside(workspace, packages)) server.watcher.add(packages);
	if (!isInside(workspace, rootReadme)) server.watcher.add(rootReadme);
	server.middlewares.use('/__docs/events', (req, res) => {
		res.statusCode = 200;
		res.setHeader('Content-Type', 'text/event-stream');
		res.setHeader('Cache-Control', 'no-cache');
		res.setHeader('Connection', 'keep-alive');
		res.write(': connected\n\n');
		clients.add(res);
		req.on('close', () => clients.delete(res));
	});

	// payload 形状对齐 client events.ts 的 DocsResourceEvent。
	const send = (type: 'add' | 'change' | 'unlink', filename: string) => {
		const candidate = path.resolve(filename);
		const absolute = fs.existsSync(candidate)
			? fs.realpathSync(candidate)
			: fs.existsSync(path.dirname(candidate))
				? path.join(fs.realpathSync(path.dirname(candidate)), path.basename(candidate))
				: candidate;
		if (absolute === entry || absolute === realEntry) {
			const payload = JSON.stringify({ type: 'reload', timestamp: Date.now() });
			clients.forEach(client => client.write(`data: ${payload}\n\n`));
			return;
		}
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
			inPackages ? packages : workspace,
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

const createHistoryPlugin = (
	options: DocsPluginOptions,
	resolvedWorkspace?: ResolvedDocsWorkspace
): Plugin => ({
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
			const indexFile = resolvedWorkspace?.entry
				|| resolveDocsWorkspace(
					options.preview ? root : process.cwd(),
					options.preview ? '.' : options.workspace
				).entry;
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

const ROOT_WORKSPACE_IGNORES = new Set([
	'build',
	'coverage',
	'dist',
	'node_modules',
	'out',
	'temp',
	'tmp'
]);

const createStaticCopyPlugin = (
	options: DocsPluginOptions,
	resolvedWorkspace?: ResolvedDocsWorkspace
): Plugin => ({
	name: 'docs-static-resources',
	writeBundle() {
		if (!options.build) return;
		const resolved = resolvedWorkspace || resolveDocsWorkspace(process.cwd(), options.workspace);
		const workspace = resolved.root;
		const outDir = path.resolve(process.cwd(), options.outDir || 'dist');
		const realOutDir = fs.realpathSync(outDir);
		const realWorkspace = fs.realpathSync(workspace);
		const activeDirectories = new Set<string>();
		const isBuildOutputSource = (source: string) => {
			const realSource = fs.existsSync(source) ? fs.realpathSync(source) : path.resolve(source);
			return isInside(realOutDir, realSource);
		};
		const copyResource = (source: string, target: string) => {
			if (isBuildOutputSource(source)) return;
			const name = path.basename(source);
			const realSource = fs.realpathSync(source);
			if (!isInside(realWorkspace, realSource)) {
				throw new RangeError(`Static resource symlink escapes the workspace: ${source}`);
			}
			const stat = fs.statSync(realSource);
			if (
				!resolved.relative
				&& stat.isDirectory()
				&& (name.startsWith('.') || ROOT_WORKSPACE_IGNORES.has(name))
			) return;
			if (!stat.isDirectory()) {
				fs.mkdirSync(path.dirname(target), { recursive: true });
				fs.copyFileSync(realSource, target);
				return;
			}
			if (activeDirectories.has(realSource)) return;
			activeDirectories.add(realSource);
			fs.mkdirSync(target, { recursive: true });
			// 当 outDir 位于 workspace 内时，node:fs 会在 filter 执行前拒绝
			// parent -> child 的 cp，因此这里自行递归复制目录。
			fs.readdirSync(realSource).forEach((childName) => {
				copyResource(path.join(realSource, childName), path.join(target, childName));
			});
			activeDirectories.delete(realSource);
		};
		fs.readdirSync(workspace, { withFileTypes: true }).forEach((entry) => {
			const entryName = entry.name;
			if (entryName === 'index.html') return;
			if (resolved.relative && entryName.startsWith('.')) return;
			copyResource(path.join(workspace, entryName), path.join(outDir, entryName));
		});
	}
});

export default (
	options: DocsPluginOptions = {},
	resolvedWorkspace?: ResolvedDocsWorkspace
) => defineConfig({
	plugins: [
		createRuntimePlugin(options, resolvedWorkspace),
		createWorkspacePlugin(options, resolvedWorkspace),
		createHistoryPlugin(options, resolvedWorkspace),
		createStaticCopyPlugin(options, resolvedWorkspace),
		vue(),
		vueJsx()
	]
});
