import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as http from 'node:http';
import * as path from 'node:path';
import { Shell } from '@deot/dev-shared';
import type { DeverOptions } from './types';
import { isInside, resolveDocsWorkspace } from './workspace';

export interface PreviewRequestHandlerOptions {
	workspace: string;
	/**
	 * 本地 `@deot/docs-client` 的 dist 目录。缺省时按包路径解析，用来改写预览 HTML 里的 CDN 地址。
	 */
	clientDist?: string;
}

const CLIENT_PREFIX = '/@deot/docs-client/';
const CLIENT_ASSET_PATTERN = new RegExp([
	String.raw`(?:https?:)?//[^/"'\x60\s<>]+`,
	String.raw`(?:/[^/"'\x60\s<>?#]+)*/@deot/docs-client`,
	String.raw`(?:@[^/"'\x60\s<>?#]+)?/dist/`,
	String.raw`(index\.js|index\.style\.css)`,
	String.raw`((?:[?#][^"'\x60\s<>]*)?)(?=["'\x60\s<>]|$)`
].join(''), 'gu');

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

const findLocalClientWorkspace = (cwd: string) => {
	const packageFile = path.resolve(cwd, 'packages/client/package.json');
	const clientDist = path.resolve(cwd, 'packages/client/dist');
	if (!fs.existsSync(packageFile)) return undefined;
	try {
		const manifest = JSON.parse(fs.readFileSync(packageFile, 'utf8'));
		return manifest.name === '@deot/docs-client'
			? { clientDist, packageFile }
			: undefined;
	} catch {
		return undefined;
	}
};

const getLatestModification = (filename: string) => {
	if (!fs.existsSync(filename)) return 0;
	const stat = fs.statSync(filename);
	if (!stat.isDirectory()) return stat.mtimeMs;
	return fs.readdirSync(filename).reduce((latest, entry) => (
		Math.max(latest, getLatestModification(path.join(filename, entry)))
	), stat.mtimeMs);
};

const ensureLocalClientDist = async (cwd: string) => {
	const localClient = findLocalClientWorkspace(cwd);
	if (!localClient) return undefined;
	const output = path.join(localClient.clientDist, 'index.js');
	const stylesheet = path.join(localClient.clientDist, 'index.style.css');
	const inputs = [
		localClient.packageFile,
		path.resolve(cwd, 'packages/locale/package.json'),
		path.resolve(cwd, 'packages/markdown/package.json'),
		path.resolve(cwd, 'packages/playground/package.json'),
		path.resolve(cwd, 'packages/theme/package.json'),
		path.resolve(cwd, 'packages/shims.d.ts'),
		path.resolve(cwd, 'z.build.config.ts'),
		path.resolve(cwd, 'tsconfig.json'),
		path.resolve(cwd, 'pnpm-lock.yaml'),
		path.resolve(cwd, 'packages/client/src'),
		path.resolve(cwd, 'packages/locale/src'),
		path.resolve(cwd, 'packages/markdown/src'),
		path.resolve(cwd, 'packages/playground/src'),
		path.resolve(cwd, 'packages/theme/src')
	];
	const outputTime = getLatestModification(output);
	const inputTime = Math.max(...inputs.map(getLatestModification));
	if (!outputTime || !fs.existsSync(stylesheet) || inputTime > outputTime) {
		console.log('Building local @deot/docs-client for preview...');
		await Shell.spawn('npm', [
			'run',
			'build',
			'--',
			'--package-name',
			'client'
		], { cwd });
	}
	if (!fs.existsSync(output)) {
		throw new Error(`Local client build did not create: ${output}`);
	}
	return localClient.clientDist;
};

const rewriteLocalClient = (html: Buffer, clientDist?: string) => (
	clientDist
		? Buffer.from(html.toString('utf8').replace(
				CLIENT_ASSET_PATTERN,
				(_url, filename: string, suffix: string) => `${CLIENT_PREFIX}${filename}${suffix}`
			))
		: html
);

const createEtag = (content: Buffer) => `W/"${createHash('sha1').update(content).digest('hex')}"`;

const sendFile = (
	req: http.IncomingMessage,
	res: http.ServerResponse,
	filename: string,
	root: string,
	clientDist?: string
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
	const content = extension === '.html'
		? rewriteLocalClient(rawContent, clientDist)
		: rawContent;
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
	return (req: http.IncomingMessage, res: http.ServerResponse) => {
		try {
			if (req.method !== 'GET' && req.method !== 'HEAD') {
				res.statusCode = 405;
				res.setHeader('Allow', 'GET, HEAD');
				res.end('Method Not Allowed');
				return;
			}
			const pathname = decodeRequestPath(req.url || '/');
			if (pathname.startsWith('/__docs/')) {
				res.statusCode = 404;
				res.end('Not Found');
				return;
			}

			let root = workspace;
			let relative = pathname.replace(/^\/+/, '');
			if (clientDist && pathname.startsWith(CLIENT_PREFIX)) {
				root = clientDist;
				relative = pathname.slice(CLIENT_PREFIX.length);
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
			if (sendFile(req, res, filename, root, clientDist)) return;

			// 仅浏览器导航返回 SPA 入口。ResourceGateway 请求 text/plain，
			// 因此缺失的 Markdown/SFC 资源仍返回真实 404。
			if (String(req.headers.accept || '').includes('text/html')) {
				if (sendFile(
					req,
					res,
					path.join(workspace, 'index.html'),
					workspace,
					clientDist
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
 * docs 仓库源码在需要时构建并提供本地 client；消费项目不存在对应的软件包
 * 工作区，因此继续使用 HTML 中声明的远程发布地址。本地替换只识别标准的
 * `@deot/docs-client[/@version]/dist/index.*` 产物路径，不绑定具体 CDN 域名。
 * @param options CLI/dever 选项。
 * @returns 已开始监听的 HTTP 服务器。
 */
export const startPreviewServer = async (options: DeverOptions) => {
	const cwd = process.cwd();
	const workspace = resolveDocsWorkspace(cwd, options.workspace);
	// 源码仓库必须预览当前待审代码，而不是 CDN 上的任意软件包版本。
	// 复用仓库统一 DDC build，仅在相关源码更新时重新构建。
	const clientDist = await ensureLocalClientDist(cwd);
	const server = http.createServer(createPreviewRequestHandler({
		workspace: workspace.root,
		clientDist
	}));
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
