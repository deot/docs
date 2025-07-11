import vue from '@vitejs/plugin-vue';
import vueJsx from '@vitejs/plugin-vue-jsx';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { defineConfig, mergeConfig } from 'vite';

const pathRegex = /^\/$|^\/(?:[^/]+\/)*[^/.]+?\/?$/;
const innerPathRegex = /^\/(@|__)/; // /@vite/ | /__vue-router
export default (options?: any) => {
	const baseConfig = defineConfig({
		plugins: [
			vue(),
			vueJsx(),
			{
				name: 'vite-plugin-virtual-html',
				configureServer(server: any) {
					if (options.build) return;
					const root = server.config.root;
					server.middlewares.use(async (req: any, res: any, next: any) => {
						const requestUrl = req.url || '/';
						const url = requestUrl.replace(/\/+/g, '/').replace(/[?#].*$/s, '') || '';
						const isPath = pathRegex.test(url);
						/**
						 * 1. ~
						 * 2. ~
						 * 3. ~
						 * 4. 文件已存在，这样xxx.png可以被获取，真实路径的.ts,.html都可以被获取
						 */
						if (
							res.writableEnded
							|| requestUrl.includes('html-proxy&')
							|| innerPathRegex.test(url)
							|| (!isPath && fs.existsSync(path.join(root, url)))
						) {
							return next();
						}

						if (isPath) {
							res.end(await server.transformIndexHtml(
								url,
								fs.readFileSync(path.resolve(root, options.workspace, 'index.html')).toString(),
								req.originalUrl)
							);
							return;
						};

						next();
					});
				}

			}
		]
	});
	return mergeConfig({}, baseConfig);
};
