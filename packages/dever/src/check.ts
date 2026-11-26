import type { ViteDevServer } from 'vite';

export type CheckMode = 'declared' | 'local' | 'iframe' | 'both';
export type CheckReporter = 'text' | 'json';

export interface CheckOptions {
	/** 检查已在运行的站点；不传时自己启动开发服务。 */
	url?: string;
	/** `declared` 按示例自己的配置；`both` 每个示例 local 与 iframe 各跑一次。 */
	mode?: CheckMode;
	/** 只检查路由或源文件匹配的页面。含 `*` 时按通配符，否则按子串。 */
	include?: string;
	/** 单个示例等待挂载的上限（毫秒）。 */
	timeout?: number;
	/** 挂载后继续收集异步错误的时间（毫秒）。 */
	settle?: number;
	reporter?: CheckReporter;
	/** 配置警告也算失败。 */
	strict?: boolean;
}

/** 浏览器里收到的消息，归到当前正在挂载的示例。 */
export interface CheckBrowserMessage {
	type: 'console' | 'pageerror' | 'requestfailed';
	text: string;
}

export interface CheckPage {
	evaluate: <T, A extends unknown[]>(fn: (...args: A) => T | Promise<T>, ...args: A) => Promise<T>;
	onMessage: (listener: (message: CheckBrowserMessage) => void) => void;
	close: () => Promise<void>;
}

/** 浏览器抽象，便于在单元测试里替换 Puppeteer。 */
export interface CheckDriver {
	open: (url: string) => Promise<CheckPage>;
	close: () => Promise<void>;
}

export interface CheckRoute {
	path: string;
	source: string;
	lang: string;
}

export interface CheckPlayground {
	index: number;
	title: string;
	line?: number;
	local: boolean;
	warnings: string[];
	error?: string;
}

export interface CheckMountResult {
	status: 'ok' | 'error' | 'timeout';
	local: boolean;
	errors: Array<{ kind: 'compile' | 'runtime' | 'timeout' | 'config'; message: string }>;
}

export type CheckIssueKind = 'config' | 'compile' | 'runtime' | 'console' | 'pageerror' | 'network' | 'timeout' | 'page' | 'warning';

export interface CheckIssue {
	source: string;
	path: string;
	line?: number;
	title: string;
	/** 实际使用的渲染方式；页面级问题为空。 */
	runtime?: 'local' | 'iframe';
	kind: CheckIssueKind;
	message: string;
}

export interface CheckReport {
	pages: number;
	playgrounds: number;
	runs: number;
	errors: CheckIssue[];
	warnings: CheckIssue[];
}

interface CheckWindow {
	__docsCheckBefore?: number;
	__DOCS_CHECK__?: {
		ready?: boolean;
		renders?: number;
		routes?: () => Promise<CheckRoute[]>;
		navigate?: (path: string) => Promise<boolean>;
		playgrounds?: () => CheckPlayground[];
		mount?: (index: number, options: { local?: boolean; timeout?: number; settle?: number }) => Promise<CheckMountResult>;
	};
}

const DEFAULT_TIMEOUT = 30_000;
const DEFAULT_SETTLE = 500;

/**
 * @param pattern `--include` 的值。
 * @returns 匹配函数。
 */
export const createIncludeMatcher = (pattern?: string) => {
	if (!pattern) return () => true;
	if (!pattern.includes('*')) return (route: CheckRoute) => route.path.includes(pattern) || route.source.includes(pattern);
	const escaped = pattern.split('**')
		.map(part => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*'))
		.join('.*');
	const regexp = new RegExp(`^${escaped}$`);
	return (route: CheckRoute) => regexp.test(route.path) || regexp.test(route.source);
};

/**
 * 同一份源文件只检查一次（多语言共用同一 Markdown 时）。
 * @param routes 页面列表。
 * @returns 去重后的页面列表。
 */
export const dedupeRoutes = (routes: CheckRoute[]) => {
	const seen = new Set<string>();
	return routes.filter((route) => {
		if (seen.has(route.source)) return false;
		seen.add(route.source);
		return true;
	});
};

/**
 * @param mode 检查模式。
 * @returns 每个示例要跑的渲染方式；`undefined` 表示按示例自己的配置。
 */
export const resolveRunModes = (mode: CheckMode = 'declared'): Array<boolean | undefined> => {
	if (mode === 'local') return [true];
	if (mode === 'iframe') return [false];
	if (mode === 'both') return [true, false];
	return [undefined];
};

const classifyMessage = (message: CheckBrowserMessage): CheckIssueKind => {
	if (message.type === 'pageerror') return 'pageerror';
	if (message.type === 'requestfailed' || /Failed to load resource|net::ERR_/u.test(message.text)) return 'network';
	return 'console';
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * 在页面里轮询，直到条件成立或超时。
 * @param page 浏览器页面。
 * @param predicate 在页面里执行的判断。
 * @param timeout 超时（毫秒）。
 * @returns 条件是否成立。
 */
const waitFor = async (page: CheckPage, predicate: () => boolean, timeout: number) => {
	const deadline = Date.now() + timeout;
	while (Date.now() < deadline) {
		if (await page.evaluate(predicate)) return true;
		await sleep(100);
	}
	return false;
};

/**
 * 逐页、逐个示例串行挂载并收集错误。串行保证浏览器消息能归到当前示例。
 * @param baseUrl 站点地址。
 * @param driver 浏览器驱动。
 * @param options 检查参数。
 * @returns 检查报告。
 */
export const runChecks = async (baseUrl: string, driver: CheckDriver, options: CheckOptions = {}): Promise<CheckReport> => {
	const timeout = options.timeout ?? DEFAULT_TIMEOUT;
	const settle = options.settle ?? DEFAULT_SETTLE;
	const report: CheckReport = { pages: 0, playgrounds: 0, runs: 0, errors: [], warnings: [] };
	const page = await driver.open(baseUrl);
	let messages: CheckBrowserMessage[] = [];
	page.onMessage(message => messages.push(message));

	try {
		// 首次启动要等 Vite 预构建依赖，给足时间。
		const ready = await waitFor(page, () => !!(window as CheckWindow).__DOCS_CHECK__?.ready, 60_000);
		if (!ready) {
			const details = messages.map(message => `  ${message.type}: ${message.text}`).join('\n');
			throw new Error(`Docs client did not start at ${baseUrl}${details ? `\n${details}` : ''}`);
		}
		const routes = dedupeRoutes(await page.evaluate(() => (window as CheckWindow).__DOCS_CHECK__!.routes!()))
			.filter(createIncludeMatcher(options.include));

		for (const route of routes) {
			report.pages += 1;
			messages = [];
			// 导航前记下渲染次数，渲染计数增加即表示新页面的 Markdown 已经完成。
			await page.evaluate(() => {
				(window as CheckWindow).__docsCheckBefore = (window as CheckWindow).__DOCS_CHECK__!.renders || 0;
			});
			const changed = await page.evaluate(path => (window as CheckWindow).__DOCS_CHECK__!.navigate!(path), route.path);
			// 已经在目标路由时不会重新渲染，只需等首次渲染完成。
			if (!changed) {
				await page.evaluate(() => {
					(window as CheckWindow).__docsCheckBefore = 0;
				});
			}
			const done = await waitFor(page, () => {
				const hooks = (window as CheckWindow).__DOCS_CHECK__!;
				return !!document.querySelector('.docs-renderer-markdown__error, .docs-resource-slot__error')
					|| (hooks.renders || 0) > ((window as CheckWindow).__docsCheckBefore || 0);
			}, timeout);
			const pageError = await page.evaluate(() => (
				document.querySelector('.docs-renderer-markdown__error, .docs-resource-slot__error')?.textContent?.trim() || ''
			));
			if (pageError || !done) {
				report.errors.push({
					source: route.source,
					path: route.path,
					title: '',
					kind: 'page',
					message: pageError || `页面在 ${timeout}ms 内没有完成渲染`
				});
				continue;
			}

			const playgrounds = await page.evaluate(() => (window as CheckWindow).__DOCS_CHECK__!.playgrounds!());
			for (const playground of playgrounds) {
				report.playgrounds += 1;
				const base = { source: route.source, path: route.path, line: playground.line, title: playground.title };
				for (const warning of playground.warnings) {
					report.warnings.push({ ...base, kind: 'warning', message: warning });
				}
				if (playground.error) {
					report.errors.push({ ...base, kind: 'config', message: playground.error });
					continue;
				}
				for (const local of resolveRunModes(options.mode)) {
					report.runs += 1;
					messages = [];
					const result = await page.evaluate(
						(index, mountOptions) => (window as CheckWindow).__DOCS_CHECK__!.mount!(index, mountOptions),
						playground.index,
						{ local, timeout, settle }
					);
					const runtime = result.local ? 'local' : 'iframe';
					const seen = new Set<string>();
					const push = (kind: CheckIssueKind, message: string) => {
						const key = message.trim();
						if (!key || [...seen].some(item => item.includes(key) || key.includes(item))) return;
						seen.add(key);
						report.errors.push({ ...base, runtime, kind, message: key });
					};
					for (const error of result.errors) push(error.kind, error.message);
					for (const message of messages) push(classifyMessage(message), message.text);
				}
			}
		}
	} finally {
		await page.close();
	}
	return report;
};

const formatLocation = (issue: CheckIssue) => {
	const location = issue.line ? `${issue.source}:${issue.line}` : issue.source;
	const title = issue.title ? ` 「${issue.title}」` : '';
	const runtime = issue.runtime ? ` [${issue.runtime}]` : '';
	return `${location}${title}${runtime}`;
};

/**
 * @param report 检查报告。
 * @param options 输出参数。
 * @param options.reporter 输出格式。
 * @param options.strict 警告是否算失败。
 * @returns 报告文本。
 */
export const formatCheckReport = (report: CheckReport, options: Pick<CheckOptions, 'reporter' | 'strict'> = {}) => {
	if (options.reporter === 'json') return JSON.stringify(report, null, 2);
	const lines: string[] = [];
	const groups = new Map<string, CheckIssue[]>();
	for (const issue of [...report.errors, ...report.warnings]) {
		const list = groups.get(issue.source) || [];
		list.push(issue);
		groups.set(issue.source, list);
	}
	for (const [source, issues] of groups) {
		lines.push(source);
		for (const issue of issues.sort((a, b) => (a.line || 0) - (b.line || 0))) {
			const level = issue.kind === 'warning' ? 'warn ' : 'error';
			const message = issue.message.replace(/\n+/g, '\n      ');
			lines.push(`  ${level} ${formatLocation(issue)} ${issue.kind}: ${message}`);
		}
		lines.push('');
	}
	const failed = isCheckFailed(report, options);
	lines.push(`${failed ? '✖' : '✔'} ${report.pages} pages, ${report.playgrounds} playgrounds, ${report.runs} runs: `
		+ `${report.errors.length} errors, ${report.warnings.length} warnings`);
	return lines.join('\n');
};

/**
 * @param report 检查报告。
 * @param options 检查参数。
 * @returns 是否应以失败退出。
 */
export const isCheckFailed = (report: CheckReport, options: Pick<CheckOptions, 'strict'> = {}) => (
	report.errors.length > 0 || (!!options.strict && report.warnings.length > 0)
);

/**
 * 用 Puppeteer 创建浏览器驱动。Puppeteer 是可选依赖，缺失时给出安装提示。
 * @returns 浏览器驱动。
 */
export const createPuppeteerDriver = async (): Promise<CheckDriver> => {
	let puppeteer: typeof import('puppeteer');
	try {
		puppeteer = await import('puppeteer');
	} catch {
		throw new Error('doc check 需要 puppeteer：请先运行 `pnpm add -D puppeteer`（或 npm i -D puppeteer）');
	}
	const browser = await puppeteer.default.launch({
		headless: true,
		args: process.env.CI ? ['--no-sandbox', '--disable-setuid-sandbox'] : []
	});
	return {
		async open(url) {
			const page = await browser.newPage();
			const listeners: Array<(message: CheckBrowserMessage) => void> = [];
			const emit = (message: CheckBrowserMessage) => listeners.forEach(listener => listener(message));
			page.on('console', (message) => {
				if (message.type() === 'error') emit({ type: 'console', text: message.text() });
			});
			page.on('pageerror', error => emit({ type: 'pageerror', text: error instanceof Error ? error.message : String(error) }));
			page.on('requestfailed', (request) => {
				const failure = request.failure()?.errorText || 'failed';
				// 切换示例时取消的请求不算失败。
				if (failure !== 'net::ERR_ABORTED') emit({ type: 'requestfailed', text: `${failure} ${request.url()}` });
			});
			await page.evaluateOnNewDocument(() => {
				(window as CheckWindow).__DOCS_CHECK__ = {};
			});
			await page.goto(url, { waitUntil: 'domcontentloaded' });
			return {
				evaluate: (fn, ...args) => page.evaluate(fn as never, ...(args as unknown as never[])) as never,
				onMessage: listener => listeners.push(listener),
				close: () => page.close()
			};
		},
		close: () => browser.close()
	};
};

/**
 * @param server 已经 listen 的 Vite 开发服务。
 * @returns 站点地址。
 */
export const resolveServerUrl = (server: Pick<ViteDevServer, 'resolvedUrls'>) => {
	const url = server.resolvedUrls?.local[0];
	if (!url) throw new Error('Vite dev server has no local URL');
	return url;
};
