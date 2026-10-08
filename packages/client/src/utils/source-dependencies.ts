import {
	collectResourceImports,
	collectResourceStyleImports,
	dependencyUrlCandidates,
	isSupportedDependency,
	resolveDependencyRequestUrl
} from './resource-graph';
import { createGithubSourceResolver, rewritePackageStyleImports } from './github-source';
import { ResourceRequestError } from '../modules/gateway/types';
import type { DocsResourceType } from '../types';

export const assertResolvableSourceGlobs = (code: string, url: string) => {
	if (code.includes('import.meta.glob')) {
		throw new Error(`[RemoteSfc] 普通 HTTP 资源无法枚举 glob 文件，请使用显式 import 或预先展开的文件清单: ${url}`);
	}
};

// 从已下载的文件构建索引，普通 HTTP 源码通过引用逐层发现真实路径。
export const createResourceDependencyResolver = (knownUrls: Iterable<string> = []) => {
	const files = new Set(knownUrls);
	const resolutions = new Map<string, Promise<string>>();
	const githubResolvers: Array<NonNullable<ReturnType<typeof createGithubSourceResolver>>> = [];
	return async (
		code: string,
		type: DocsResourceType,
		url: string,
		probe?: (url: string) => Promise<void>
	) => {
		files.add(url);
		if (/\.json(?:$|[?#])/i.test(url)) return [];
		let github = githubResolvers.find(resolver => url.startsWith(resolver.base));
		if (!github) {
			github = createGithubSourceResolver(url) ?? undefined;
			if (github) githubResolvers.push(github);
		}
		let source = code;
		if (type === 'module') {
			if (github) source = await github.expandGlob(source, url);
		}
		if (!github && type !== 'style') assertResolvableSourceGlobs(source, url);
		if (type === 'style') source = rewritePackageStyleImports(source);
		const imports = await collectResourceImports(source, type);
		const styles = collectResourceStyleImports(source, type);
		return await Promise.all(imports.filter(isSupportedDependency).map(async (specifier) => {
			const style = styles.includes(specifier) || /\.(?:scss|sass)(?:$|[?#])/i.test(specifier);
			const candidates = github
				? await github.resolve(specifier, url, style)
				: dependencyUrlCandidates(specifier, url, style);
			const found = candidates.find(candidate => files.has(candidate));
			if (found) return resolveDependencyRequestUrl(found);
			if (!probe || candidates.length === 1) return resolveDependencyRequestUrl(candidates[0]);
			const key = JSON.stringify(candidates);
			let pending = resolutions.get(key);
			if (!pending) {
				pending = (async () => {
					for (let index = 0; ; index += 1) {
						const candidate = candidates[index];
						try {
							await probe(candidate);
							files.add(candidate);
							return candidate;
						} catch (reason) {
							if (!(reason instanceof ResourceRequestError) || reason.status !== 404 || index === candidates.length - 1) throw reason;
						}
					}
				})();
				resolutions.set(key, pending);
			}
			return resolveDependencyRequestUrl(await pending);
		}));
	};
};
