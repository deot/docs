import { dependencyUrlCandidates } from './resource-graph';

/**
 * GitHub Raw 不提供目录列表，用 Git tree 确定源码文件和 glob 匹配项。
 * @param rootUrl 入口源码的 URL。
 * @param signal 资源图的取消信号。
 * @returns GitHub 文件解析器，非 GitHub 地址返回 null。
 */
export const createGithubSourceResolver = (rootUrl: string, signal?: AbortSignal) => {
	const root = new URL(rootUrl, typeof location === 'undefined' ? 'http://localhost/' : location.href);
	const match = root.hostname === 'raw.githubusercontent.com'
		? root.pathname.match(/^\/([^/]+)\/([^/]+)\/(refs\/(?:heads|tags)\/)?([^/]+)\//)
		: null;
	if (!match) return null;
	const [, owner, repo, , ref] = match;
	const base = `${root.origin}${match[0]}`;
	let pending: Promise<Set<string> | null> | undefined;
	let globTree: Promise<Set<string>> | undefined;
	const tree = () => {
		pending ??= (async () => {
			try {
				const apiUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(ref)}?recursive=1`;
				const response = await fetch(apiUrl, { signal });
				if (!response.ok) return null;
				const data = await response.json() as { truncated?: boolean; tree: Array<{ type: string; path: string }> };
				if (data.truncated) return null;
				return new Set(data.tree.filter(item => item.type === 'blob').map(item => `${base}${item.path}`));
			} catch (reason) {
				if (signal?.aborted) throw reason;
				return null;
			}
		})();
		return pending;
	};
	const fallbackGlobTree = () => {
		globTree ??= (async () => {
			const url = `https://data.jsdelivr.com/v1/package/gh/${owner}/${repo}@${encodeURIComponent(ref)}/flat`;
			const response = await fetch(url, { signal });
			if (!response.ok) throw new Error(`[RemoteSfc] glob 备用文件清单加载失败: ${response.status}`);
			const data = await response.json() as { files: Array<{ name: string }> };
			return new Set(data.files.map(item => `${base}${item.name.replace(/^\//, '')}`));
		})();
		return globTree;
	};
	return {
		base,
		resolve: async (specifier: string, importer: string, style: boolean) => {
			const candidates = dependencyUrlCandidates(specifier, importer, style);
			if (!candidates[0].startsWith(base) || candidates[0].includes('/node_modules/')) return candidates;
			const files = await tree();
			if (!files) return candidates;
			const found = candidates.find(value => files.has(value.split(/[?#]/)[0]));
			if (!found) throw new Error(`[RemoteSfc] 无法解析依赖 "${specifier}"（来自 ${importer}）`);
			return [found];
		},
		expandGlob: async (code: string, importer: string) => {
			if (!code.includes('import.meta.glob')) return code;
			const files = await tree() ?? await fallbackGlobTree();
			const imports: string[] = [];
			const transformed = code.replace(
				/import\.meta\.glob(?:<[^;\n]+?>)?\(\s*(['"])([^'"]+)\1\s*,\s*\{\s*eager\s*:\s*true\s*\}\s*\)/g,
				(_call, _quote: string, pattern: string) => {
					const absolute = new URL(pattern, importer).href;
					const expression = absolute.split('*').map(part => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('[^/]*');
					const matcher = new RegExp(`^${expression}$`);
					const directory = new URL('.', importer).href;
					const entries = [...files].filter(value => matcher.test(value)).sort().map((value) => {
						const path = `./${value.slice(directory.length)}`;
						const name = `__docs_glob_${imports.length}`;
						imports.push(`import * as ${name} from ${JSON.stringify(path)};`);
						return `${JSON.stringify(path)}: ${name}`;
					});
					return `({${entries.join(',')}})`;
				}
			);
			if (transformed.includes('import.meta.glob')) throw new Error(`[RemoteSfc] 不支持的 glob 调用: ${importer}`);
			return `${imports.join('\n')}\n${transformed}`;
		}
	};
};

export const rewritePackageStyleImports = (code: string) => code.replace(
	/@import\s+(['"])([^.'"/][^'"]*\.css)\1/g,
	(statement, quote: string, path: string) => (
		/^[a-z][a-z\d+.-]*:/i.test(path) ? statement : `@import ${quote}https://cdn.jsdelivr.net/npm/${path}${quote}`
	)
);
