import { watch } from 'vue';
import type { ReplStore } from '@vue/repl';
import { SASS_CDN_URL } from '../cdn';

const SCHEME = 'docs-playground';
const STYLE_EXTS = ['.scss', '.sass'] as const;
const VUE_SCSS_STYLE_RE = /<style\b[^>]*\blang\s*=\s*(['"]?)s[ac]ss\1/i;
const LANG_ATTR_RE = /\s*lang\s*=\s*(['"]?)s[ac]ss\1/i;
const SCSS_ERROR_MARK = '[playground-sass]';
const INJECT_START = '/* docs-playground-scss-start */';
const INJECT_END = '/* docs-playground-scss-end */';
const EMPTY_JS = 'export default {}\n';
const boundStores = new WeakSet<object>();
const wrappedCompilers = new WeakSet<object>();

export interface SassImporter {
	canonicalize(
		url: string,
		context: { fromImport: boolean; containingUrl: URL | null }
	): URL | null;
	load(canonicalUrl: URL): {
		contents: string;
		syntax: 'scss' | 'indented' | 'css';
	} | null;
}

export interface SassCompileOptions {
	syntax?: 'scss' | 'indented' | 'css';
	url?: URL;
	importer?: SassImporter;
	importers?: SassImporter[];
}

export interface SassCompiler {
	compileString(source: string, options?: SassCompileOptions): { css: string };
}

export type SassLoader = () => Promise<SassCompiler>;

type VueParseResult = {
	descriptor: {
		styles: Array<{
			lang?: string;
			content: string;
			loc: { start: { offset: number }; end: { offset: number } };
		}>;
	};
	errors: unknown[];
};

type VueParse = (source: string, options?: { filename?: string }) => VueParseResult;
type VueCompiler = ReplStore['compiler'];
type PlaygroundFileMap = Record<string, string>;
type FileSource = string | { code: string };

let testLoader: SassLoader | undefined;
let loadedSass: SassCompiler | undefined;
let loadPromise: Promise<SassCompiler> | undefined;

const fileCode = (value: FileSource) => (typeof value === 'string' ? value : value.code);
const playgroundPath = (url: URL) => decodeURIComponent(url.pathname.replace(/^\/+/u, ''));
const toPlaygroundUrl = (filename: string) => new URL(`${SCHEME}:///${filename.replace(/^\/+/u, '')}`);
const basename = (path: string) => path.split('/').pop() || path;
const scssSyntax = (filename: string, lang?: string) => (
	lang === 'sass' || /\.sass$/i.test(filename) ? 'indented' : 'scss'
);
const errorText = (item: unknown) => (item instanceof Error ? item.message : String(item));
const isScssFile = (filename: string) => /\.s[ac]ss$/i.test(filename);
const vueSourceNeedsScss = (source: string) => VUE_SCSS_STYLE_RE.test(source);

export const setSassLoader = (loader?: SassLoader) => {
	testLoader = loader;
	loadedSass = undefined;
	loadPromise = undefined;
};

const resolveSassModule = async (url: string): Promise<SassCompiler> => {
	const mod = await import(/* @vite-ignore */ url) as SassCompiler & { default?: SassCompiler };
	const sass = typeof mod.compileString === 'function' ? mod : mod.default;
	if (typeof sass?.compileString !== 'function') {
		throw new Error(`Sass module at ${url} does not export compileString`);
	}
	return sass;
};

export const loadSass = () => {
	loadPromise ??= (testLoader ?? (() => resolveSassModule(SASS_CDN_URL)))().then((sass) => {
		loadedSass = sass;
		return sass;
	});
	return loadPromise;
};

export const isScssPartial = (filename: string) => (
	isScssFile(filename) && basename(filename).startsWith('_')
);

export const filesNeedScss = (files: Record<string, FileSource>) => Object.entries(files).some(
	([filename, value]) => isScssFile(filename)
		|| (/\.vue$/i.test(filename) && vueSourceNeedsScss(fileCode(value)))
);

export const whenSassReady = (
	files: Record<string, FileSource>,
	run: () => void
) => {
	if (!filesNeedScss(files) || loadedSass) run();
	else void loadSass().then(run);
};

export const toPlaygroundFileMap = (files: Record<string, FileSource>): PlaygroundFileMap => (
	Object.fromEntries(Object.entries(files).map(([filename, value]) => [filename, fileCode(value)]))
);

export const formatScssError = (filename: string, message: string) => (
	`${SCSS_ERROR_MARK} ${filename}: ${message}`
);
const scssFail = (filename: string, error: unknown) => formatScssError(filename, errorText(error));

const withUnderscore = (path: string) => {
	const base = basename(path);
	if (base.startsWith('_')) return path;
	return `${path.slice(0, -base.length)}_${base}`;
};

const matchFileKey = (files: PlaygroundFileMap, path: string) => [
	path,
	path.startsWith('src/') ? path : `src/${path}`,
	path.replace(/^src\//u, '')
].find(key => files[key] !== undefined);

const stylesheetCandidates = (requestPath: string) => {
	if (isScssFile(requestPath)) return [requestPath, withUnderscore(requestPath)];
	return STYLE_EXTS.flatMap(ext => [
		`${requestPath}${ext}`,
		withUnderscore(`${requestPath}${ext}`),
		`${requestPath}/index${ext}`,
		withUnderscore(`${requestPath}/index${ext}`)
	]);
};

export const resolvePlaygroundStylesheet = (
	files: PlaygroundFileMap,
	requestPath: string
): string | null => {
	const found = [...new Set(
		stylesheetCandidates(requestPath)
			.map(path => matchFileKey(files, path))
			.filter((key): key is string => Boolean(key))
	)];
	if (found.length > 1) throw new Error(`Ambiguous Sass import "${requestPath}": ${found.join(', ')}`);
	return found[0] ?? null;
};

export const createPlaygroundImporter = (getFiles: () => PlaygroundFileMap): SassImporter => ({
	canonicalize(url, context) {
		if (/^[a-zA-Z][\w+.-]*:/u.test(url) && !url.startsWith(`${SCHEME}:`)) return null;
		try {
			const resolved = resolvePlaygroundStylesheet(
				getFiles(),
				playgroundPath(new URL(url, context.containingUrl ?? toPlaygroundUrl('')))
			);
			return resolved ? toPlaygroundUrl(resolved) : null;
		} catch {
			return null;
		}
	},
	load(canonicalUrl) {
		const files = getFiles();
		const key = playgroundPath(canonicalUrl);
		return files[key] === undefined
			? null
			: { contents: files[key], syntax: scssSyntax(key) };
	}
});

export const compileScssSource = (
	source: string,
	filename: string,
	sass: SassCompiler,
	files: PlaygroundFileMap,
	lang?: string
) => {
	const importer = createPlaygroundImporter(() => files);
	return sass.compileString(source, {
		syntax: scssSyntax(filename, lang),
		url: toPlaygroundUrl(filename),
		importer,
		importers: [importer]
	}).css;
};

export const rewriteVueSfcStyles = (
	source: string,
	filename: string,
	parse: VueParse,
	sass: SassCompiler,
	files: PlaygroundFileMap
): { code: string; errors: string[] } => {
	const scssStyles = parse(source, { filename }).descriptor.styles
		.filter(style => style.lang === 'scss' || style.lang === 'sass');
	if (!scssStyles.length) return { code: source, errors: [] };

	const errors: string[] = [];
	let code = source;
	for (const style of [...scssStyles].sort((left, right) => right.loc.start.offset - left.loc.start.offset)) {
		const before = code.slice(0, style.loc.start.offset);
		const after = code.slice(style.loc.end.offset);
		const openStart = before.lastIndexOf('<style');
		if (openStart < 0) {
			errors.push(formatScssError(filename, 'unable to locate <style> opening tag'));
			continue;
		}
		try {
			const css = compileScssSource(style.content, filename, sass, files, style.lang);
			code = `${before.slice(0, openStart)}${before.slice(openStart).replace(LANG_ATTR_RE, '')}${css}${after}`;
		} catch (error) {
			errors.push(scssFail(filename, error));
		}
	}
	return { code, errors };
};

const appendParseErrors = (result: VueParseResult, errors: string[]): VueParseResult => (
	errors.length
		? { ...result, errors: [...result.errors, ...errors.map(item => new Error(item))] }
		: result
);

export const wrapCompiler = (
	compiler: VueCompiler,
	getFiles: () => PlaygroundFileMap
): VueCompiler => {
	if (wrappedCompilers.has(compiler as object)) return compiler;
	const originalParse = compiler.parse.bind(compiler) as VueParse;
	// Vue's browser compiler can be an ESM namespace whose exports are exposed
	// through getter-only properties. Copy its exports into a plain object so the
	// SCSS parse wrapper never assigns through an inherited read-only `parse`.
	const wrapped = { ...compiler } as VueCompiler;
	wrapped.parse = ((source, options) => {
		const filename = options?.filename || 'anonymous.vue';
		if (!vueSourceNeedsScss(source)) return originalParse(source, options);
		const rewritten = loadedSass
			? rewriteVueSfcStyles(source, filename, originalParse, loadedSass, getFiles())
			: { code: source, errors: [formatScssError(filename, 'compiler is not loaded')] };
		return appendParseErrors(
			originalParse(rewritten.errors.length ? source : rewritten.code, options),
			rewritten.errors
		);
	}) as VueCompiler['parse'];
	wrappedCompilers.add(wrapped);
	return wrapped;
};

const withInjectedCss = (css: string, extra: string) => {
	const start = css.indexOf(INJECT_START);
	const end = start < 0 ? -1 : css.indexOf(INJECT_END, start);
	const base = (
		start < 0
			? css
			: `${css.slice(0, start)}${end >= 0 ? css.slice(end + INJECT_END.length) : ''}`
	).trimEnd();
	if (!extra.trim()) return base;
	const block = `${INJECT_START}\n${extra.trim()}\n${INJECT_END}`;
	return base ? `${base}\n${block}` : block;
};

const isStandaloneScssError = (item: string | Error) => {
	const text = errorText(item);
	return text.startsWith(SCSS_ERROR_MARK) && /\.s[ac]ss:/i.test(text);
};

const syncScssErrors = (store: Pick<ReplStore, 'errors'>, scssErrors: string[]) => {
	const next = [...scssErrors, ...store.errors.filter(item => !isStandaloneScssError(item))];
	if (next.map(String).join('\0') === store.errors.map(String).join('\0')) return;
	store.errors = next;
};

export const applyStandaloneScss = (
	store: Pick<ReplStore, 'files' | 'mainFile' | 'errors'>,
	sass = loadedSass
) => {
	if (!sass) return [] as string[];
	const fileMap = toPlaygroundFileMap(store.files);
	const errors: string[] = [];
	const injected: string[] = [];

	for (const [filename, file] of Object.entries(store.files)) {
		if (!isScssFile(filename) || !file.compiled) continue;
		try {
			const css = compileScssSource(file.code, filename, sass, fileMap);
			file.compiled.css = css;
			file.compiled.js = EMPTY_JS;
			file.compiled.ssr = EMPTY_JS;
			if (!isScssPartial(filename) && css.trim()) injected.push(css);
		} catch (error) {
			errors.push(scssFail(filename, error));
		}
	}

	const main = store.files[store.mainFile];
	if (main?.compiled) {
		const next = withInjectedCss(main.compiled.css || '', injected.join('\n'));
		if (next !== (main.compiled.css || '')) main.compiled.css = next;
	}

	syncScssErrors(store, errors);
	return errors;
};

export const bindPlaygroundScss = (store: ReplStore) => {
	if (boundStores.has(store)) return;
	boundStores.add(store);

	const getFiles = () => toPlaygroundFileMap(store.files);
	const installCompiler = () => {
		if (typeof store.compiler?.parse === 'function') {
			store.compiler = wrapCompiler(store.compiler, getFiles);
		}
	};

	installCompiler();
	watch(() => store.compiler, installCompiler);
	watch(
		() => [
			store.mainFile,
			store.files[store.mainFile]?.compiled?.css,
			store.errors.map(String).join('\0'),
			Object.entries(store.files)
				.filter(([filename]) => isScssFile(filename))
				.map(([filename, file]) => `${filename}:${file.code}`)
				.join('\n')
		].join('\0'),
		() => {
			if (loadedSass) applyStandaloneScss(store);
		}
	);

	const originalSetFiles = store.setFiles.bind(store);
	store.setFiles = async (newFiles, mainFile) => {
		if (filesNeedScss(newFiles) && !loadedSass) await loadSass();
		return originalSetFiles(newFiles, mainFile);
	};
};
