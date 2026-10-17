import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as http from 'node:http';
import * as path from 'node:path';
import type { DeverOptions } from './types';
import { isInside, resolveDocsWorkspace } from './workspace';
import { findLocalClientWorkspace } from './local-client';
import { CLIENT_ASSET_REPLACEMENTS, CLIENT_PREFIX, LAUNCH_PREFIX, rewriteClientAssets, rewriteLaunchUrls } from './local-assets';

export interface PreviewRequestHandlerOptions {
	workspace: string;
	/** 本地 Client Bundle 目录，用来改写预览 HTML 里的 CDN 地址。 */
	clientDist?: string;
	/** 本地 launch 的构建产物目录。 */
	launchDist?: string;
}

const contentTypes: Record<string, string> = {
	'.css': 'text/css; charset=utf-8',
	'.gif': 'image/gif',
	'.html': 'text/html; charset=utf-8',
	'.ico': 'image/x-icon',
	'.jpeg': 'image/jpeg',
	'.jpg': 'image/jpeg',
	'.js': 'text/javascript; charset=utf-8',
	'.json': 'application/json; charset=utf-8',
	'.map': 'application/json; charset=utf-8',
	'.md': 'text/markdown; charset=utf-8',
	'.mjs': 'text/javascript; charset=utf-8',
	'.png': 'image/png',
	'.svg': 'image/svg+xml; charset=utf-8',
	'.ts': 'text/plain; charset=utf-8',
	'.vue': 'text/plain; charset=utf-8',
	'.webp': 'image/webp',
	'.woff': 'font/woff',
	'.woff2': 'font/woff2'
};
const errorMessages: Record<number, string> = {
	400: 'Bad Request',
	403: 'Forbidden',
	404: 'Not Found',
	500: 'Internal Server Error'
};

const decodeRequestPath = (requestUrl: string) => {
	const rawPathname = requestUrl.split(/[?#]/u, 1)[0] || '/';
	let decoded: string;
	try {
		decoded = decodeURIComponent(rawPathname);
	} catch {
		throw new URIError('Bad Request');
	}
	if (
		decoded.includes('\0')
		|| decoded.includes('\\')
		|| decoded.split('/').includes('..')
	) throw new RangeError('Forbidden');
	return decoded;
};

const rewriteLocalClient = (html: Buffer, clientDist?: string) => (
	clientDist
		? Buffer.from(rewriteClientAssets(html.toString('utf8')))
		: html
);

// 本地 launch 入口先调用用户钩子，再把 Client 指向本地 dist。
const localLaunchEntry = [
	'const config = window.$docs ||= {};',
	'const custom = config.resolve?.cdn;',
	`const replacements = ${JSON.stringify(CLIENT_ASSET_REPLACEMENTS.map(([pattern, replacement]) => [pattern.source, replacement]))};`,
	'config.resolve = {...config.resolve, cdn(context) {',
	'const url = custom?.(context) || context.url;',
	'return replacements.reduce((result, [pattern, replacement]) => result.replace(new RegExp(pattern, "gu"), replacement), url);',
	'}};',
	`import('${LAUNCH_PREFIX}dist/index.js');`
].join('\n');

const createEtag = (content: Buffer) => `W/"${createHash('sha1').update(content).digest('hex')}"`;

const sendFile = (
	req: http.IncomingMessage,
	res: http.ServerResponse,
	filename: string,
	root: string,
	clientDist?: string,
	launchDist?: string
) => {
	if (!fs.existsSync(filename) || !fs.statSync(filename).isFile()) return false;
	const realRoot = fs.realpathSync(root);
	const realFilename = fs.realpathSync(filename);
	if (!isInside(realRoot, realFilename)) {
		res.statusCode = 403;
		res.end('Forbidden');
		return true;
	}
	const stat = fs.statSync(realFilename);
	const extension = path.extname(realFilename).toLowerCase();
	const rawContent = fs.readFileSync(realFilename);
	let content = extension === '.html'
		? rewriteLocalClient(rawContent, clientDist)
		: rawContent;
	if (extension === '.html' && launchDist) {
		content = Buffer.from(rewriteLaunchUrls(content.toString('utf8'), `${LAUNCH_PREFIX}+esm`));
	}
	const etag = createEtag(content);
	const lastModified = stat.mtime.toUTCString();
	res.setHeader('Cache-Control', 'no-cache');
	res.setHeader('Content-Type', contentTypes[extension] || 'application/octet-stream');
	res.setHeader('ETag', etag);
	res.setHeader('Last-Modified', lastModified);
	if (
		String(req.headers['if-none-match'] || '') === etag
		|| (
			!req.headers['if-none-match']
			&& Date.parse(String(req.headers['if-modified-since'] || '')) >= (
				Math.floor(stat.mtimeMs / 1000) * 1000
			)
		)
	) {
		res.statusCode = 304;
		res.end();
		return true;
	}
	res.statusCode = 200;
	res.setHeader('Content-Length', content.byteLength);
	res.end(req.method === 'HEAD' ? undefined : content);
	return true;
};

/**
 * 创建生产模式的预览请求处理器。
 *
 * 预览服务有意避开 Vite 开发服务器：关闭 HMR 并不会关闭 Vite 文件监听器
 * 或 `/@vite/client` HTML 转换。该处理器每次请求时读取文件，因此手动刷新
 * 即可看到修改，无需维护文件监听器、SSE 通道、HMR 依赖图或站点构建目录。
 * @param options 静态工作区与可选的本地 client 构建产物。
 * @returns Node HTTP 请求处理函数。
 */
export const createPreviewRequestHandler = (options: PreviewRequestHandlerOptions) => {
	const workspace = path.resolve(options.workspace);
	const clientDist = options.clientDist && path.resolve(options.clientDist);
	const launchDist = options.launchDist && path.resolve(options.launchDist);
	return (req: http.IncomingMessage, res: http.ServerResponse) => {
		try {
			if (req.method !== 'GET' && req.method !== 'HEAD') {
				res.statusCode = 405;
				res.setHeader('Allow', 'GET, HEAD');
				res.end('Method Not Allowed');
				return;
			}
			const pathname = decodeRequestPath(req.url || '/');
			if (launchDist && pathname === `${LAUNCH_PREFIX}+esm`) {
				res.setHeader('Content-Type', 'text/javascript; charset=utf-8');
				res.setHeader('Cache-Control', 'no-cache');
				res.end(req.method === 'HEAD' ? undefined : localLaunchEntry);
				return;
			}
			const isPreviewPage = /^\/__docs\/(?:preview|raw-editor|markdown-editor)$/.test(pathname)
				&& String(req.headers.accept || '').includes('text/html');
			if (pathname.startsWith('/__docs/') && !isPreviewPage) {
				res.statusCode = 404;
				res.end('Not Found');
				return;
			}

			let root = workspace;
			let relative = pathname.replace(/^\/+/, '');
			if (clientDist && pathname.startsWith(CLIENT_PREFIX)) {
				root = clientDist;
				const rest = pathname.slice(CLIENT_PREFIX.length);
				relative = rest === '+esm' ? 'index.js' : rest.replace(/^dist\/(?:bundle\/)?/u, '');
			}
			if (launchDist && pathname.startsWith(LAUNCH_PREFIX)) {
				root = launchDist;
				relative = pathname.slice(LAUNCH_PREFIX.length).replace(/^dist\//u, '');
			}
			let filename = path.resolve(root, relative || 'index.html');
			if (!isInside(root, filename)) {
				res.statusCode = 403;
				res.end('Forbidden');
				return;
			}
			if (fs.existsSync(filename) && fs.statSync(filename).isDirectory()) {
				filename = path.join(filename, 'index.html');
			}
			if (sendFile(req, res, filename, root, clientDist, launchDist)) return;

			// 仅浏览器导航返回 SPA 入口。ResourceGateway 请求 text/plain，
			// 因此缺失的 Markdown/SFC 资源仍返回真实 404。
			if (String(req.headers.accept || '').includes('text/html')) {
				if (sendFile(
					req,
					res,
					path.join(workspace, 'index.html'),
					workspace,
					clientDist,
					launchDist
				)) return;
			}
			res.statusCode = 404;
			res.end('Not Found');
		} catch (reason) {
			if (res.writableEnded) return;
			const code = (reason as NodeJS.ErrnoException).code;
			if (reason instanceof URIError) res.statusCode = 400;
			else if (reason instanceof RangeError) res.statusCode = 403;
			else if (code === 'ENOENT') res.statusCode = 404;
			else res.statusCode = 500;
			res.end(errorMessages[res.statusCode]);
		}
	};
};

/**
 * 启动生产模式预览，但不生成站点输出目录。
 *
 * docs 仓库提供预先构建的本地 Client Bundle；消费项目不存在对应的软件包
 * 工作区，因此继续使用 HTML 中声明的远程发布地址。本地替换识别
 * Client Bundle 的 JS/CSS 地址，也兼容原 Client 入口；不绑定具体 CDN 域名。
 * 本地地址保留 `dist/bundle/`，构建由开发者显式执行。
 * @param options CLI/dever 选项。
 * @returns 已开始监听的 HTTP 服务器。
 */
export const startPreviewServer = async (options: DeverOptions) => {
	const cwd = process.cwd();
	const workspace = resolveDocsWorkspace(cwd, options.workspace);
	const localClient = findLocalClientWorkspace(cwd);
	const local = localClient && {
		clientDist: path.join(localClient.clientDist, 'bundle'),
		launchDist: path.resolve(cwd, 'packages/launch/dist')
	};
	if (local) {
		for (const filename of [
			path.join(local.clientDist, 'index.js'),
			path.join(local.clientDist, 'index.style.css'),
			path.join(local.launchDist, 'index.js')
		]) {
			if (!fs.existsSync(filename)) throw new Error(`Run npm run build before preview: missing ${filename}`);
		}
	}
	const server = http.createServer(createPreviewRequestHandler({ workspace: workspace.root, ...local }));
	const port = Number(options.port ?? 4173);
	const host = String(options.host || '0.0.0.0');
	if (!Number.isInteger(port) || port < 0 || port > 65535) {
		throw new RangeError(`Invalid preview port: ${String(options.port)}`);
	}
	await new Promise<void>((resolve, reject) => {
		const handleError = (reason: Error) => reject(reason);
		server.once('error', handleError);
		server.listen(port, host, () => {
			server.off('error', handleError);
			resolve();
		});
	});
	const address = server.address();
	const listeningPort = address && typeof address !== 'string' ? address.port : port;
	console.log(`Docs preview: http://localhost:${listeningPort}/`);
	return server;
};
