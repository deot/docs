import * as fs from 'node:fs';
import * as path from 'node:path';

export interface ResolvedDocsWorkspace {
	/**
	 * 经过 realpath 解析的项目根目录。
	 */
	projectRoot: string;
	/**
	 * 经过 realpath 解析的文档 workspace。
	 */
	root: string;
	/**
	 * 相对于项目根的 POSIX 路径；根 workspace 为空字符串。
	 */
	relative: string;
	/**
	 * 浏览器访问资源时使用的规范路径前缀。
	 */
	urlBase: string;
	/**
	 * workspace 中经过安全检查的入口文件。
	 */
	entry: string;
}

/**
 * 判断 target 是否位于 parent 目录树内。只把 `..` 与 `..${sep}` 视为越界，
 * 避免把合法文件名（如 `..foo`）误判为父路径。
 * @param parent 作为边界的目录。
 * @param target 待检查的路径。
 * @returns 是否仍在边界内。
 */
export const isInside = (parent: string, target: string) => {
	const relative = path.relative(parent, target);
	return relative === '' || (
		relative !== '..'
		&& !relative.startsWith(`..${path.sep}`)
		&& !path.isAbsolute(relative)
	);
};

const toPosixPath = (value: string) => value.split(path.sep).join('/');

const hasParentSegment = (value: string) => (
	value.replace(/\\/gu, '/').split('/').includes('..')
);

const toUrlBase = (relative: string) => {
	if (!relative) return '/';
	return `/${relative.split('/').map(encodeURIComponent).join('/')}/`;
};

const resolveCandidate = (
	projectRoot: string,
	workspace: string
): ResolvedDocsWorkspace | null => {
	if (hasParentSegment(workspace)) {
		throw new RangeError(`Docs workspace must not contain parent segments: ${workspace}`);
	}
	const candidate = path.resolve(projectRoot, workspace || '.');
	if (!isInside(projectRoot, candidate)) {
		throw new RangeError(`Docs workspace must be inside the project: ${workspace}`);
	}
	if (!fs.existsSync(candidate) || !fs.statSync(candidate).isDirectory()) return null;
	const root = fs.realpathSync(candidate);
	if (!isInside(projectRoot, root)) {
		throw new RangeError(`Docs workspace symlink escapes the project: ${workspace}`);
	}
	const entryCandidate = path.join(root, 'index.html');
	if (!fs.existsSync(entryCandidate) || !fs.statSync(entryCandidate).isFile()) return null;
	// Vite 会把 HTML 符号链接解析为目标文件名，导致构建产物不再是 index.html。
	if (fs.lstatSync(entryCandidate).isSymbolicLink()) {
		throw new RangeError(`Docs entry must not be a symbolic link: ${entryCandidate}`);
	}
	const realEntry = fs.realpathSync(entryCandidate);
	if (!isInside(root, realEntry)) {
		throw new RangeError(`Docs entry symlink escapes the workspace: ${workspace}`);
	}
	// URL 使用用户选择的项目内路径；root/entry 则使用经过校验的真实资源边界。
	const relative = toPosixPath(path.relative(projectRoot, candidate));
	return {
		projectRoot,
		root,
		relative,
		urlBase: toUrlBase(relative),
		entry: entryCandidate
	};
};

/**
 * 解析文档入口和资源安全边界。显式 workspace 不回退；未指定时优先
 * `site/index.html`，再尝试项目根 `index.html`。
 * @param cwd 当前项目目录。
 * @param workspace CLI 显式指定的 workspace。
 * @returns dev、preview、build 共用的规范 workspace。
 */
export const resolveDocsWorkspace = (
	cwd = process.cwd(),
	workspace?: string
): ResolvedDocsWorkspace => {
	const projectCandidate = path.resolve(cwd);
	if (!fs.existsSync(projectCandidate) || !fs.statSync(projectCandidate).isDirectory()) {
		throw new Error(`Project directory does not exist: ${projectCandidate}`);
	}
	const projectRoot = fs.realpathSync(projectCandidate);
	const explicit = typeof workspace === 'string';
	const candidates = explicit ? [workspace || '.'] : ['site', '.'];
	for (const candidate of candidates) {
		const resolved = resolveCandidate(projectRoot, candidate);
		if (resolved) return resolved;
	}
	if (explicit) {
		throw new Error(`Cannot find docs workspace entry: ${path.resolve(projectRoot, workspace || '.', 'index.html')}`);
	}
	throw new Error([
		'Cannot find docs workspace entry. Checked:',
		path.join(projectRoot, 'site/index.html'),
		path.join(projectRoot, 'index.html')
	].join(' '));
};
