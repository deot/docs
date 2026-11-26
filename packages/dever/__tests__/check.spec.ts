// @vitest-environment jsdom
import {
	createIncludeMatcher,
	dedupeRoutes,
	formatCheckReport,
	isCheckFailed,
	resolveRunModes,
	runChecks
} from '../src/check';
import type { CheckBrowserMessage, CheckDriver, CheckMountResult, CheckPlayground } from '../src/check';

interface FakePage {
	routes: Array<{ path: string; source: string; lang: string }>;
	playgrounds: Record<string, CheckPlayground[]>;
	results: Record<string, (local: boolean | undefined) => CheckMountResult>;
	messages?: Record<string, CheckBrowserMessage[]>;
	pageError?: Record<string, string>;
}

/**
 * 假浏览器：evaluate 直接在 jsdom 的 window 上执行，钩子用内存数据模拟。
 * @param fake 页面数据。
 * @returns 驱动和记录的挂载参数。
 */
const createFakeDriver = (fake: FakePage) => {
	const mounts: Array<{ path: string; index: number; local?: boolean }> = [];
	let current = '';
	let listener: ((message: CheckBrowserMessage) => void) | undefined;
	const driver: CheckDriver = {
		async open() {
			window.__DOCS_CHECK__ = {
				ready: true,
				renders: 0,
				routes: async () => fake.routes,
				navigate: async (path: string) => {
					const changed = path !== current;
					current = path;
					document.body.innerHTML = fake.pageError?.[path]
						? `<div class="docs-resource-slot__error">${fake.pageError[path]}</div>`
						: '';
					if (changed) window.__DOCS_CHECK__!.renders = (window.__DOCS_CHECK__!.renders || 0) + 1;
					return changed;
				},
				playgrounds: () => fake.playgrounds[current] || [],
				mount: async (index: number, options: { local?: boolean }) => {
					mounts.push({ path: current, index, local: options.local });
					for (const message of fake.messages?.[`${current}#${index}`] || []) listener?.(message);
					return fake.results[`${current}#${index}`](options.local);
				}
			} as never;
			return {
				evaluate: async (fn, ...args) => fn(...args),
				onMessage: (next) => { listener = next; },
				close: async () => {}
			};
		},
		close: async () => {}
	};
	return { driver, mounts };
};

const ok = (local = true): CheckMountResult => ({ status: 'ok', local, errors: [] });

describe('doc check', () => {
	afterEach(() => {
		delete window.__DOCS_CHECK__;
		document.body.innerHTML = '';
	});

	it('matches routes and picks run modes', () => {
		const route = { path: '/zh-CN/guide/markdown', source: 'docs/markdown.md', lang: 'zh-CN' };
		expect(createIncludeMatcher()(route)).toBe(true);
		expect(createIncludeMatcher('markdown.md')(route)).toBe(true);
		expect(createIncludeMatcher('docs/*.md')(route)).toBe(true);
		expect(createIncludeMatcher('packages/**')(route)).toBe(false);
		expect(dedupeRoutes([route, { ...route, lang: 'en-US', path: '/en-US/guide/markdown' }])).toEqual([route]);
		expect(resolveRunModes()).toEqual([undefined]);
		expect(resolveRunModes('local')).toEqual([true]);
		expect(resolveRunModes('iframe')).toEqual([false]);
		expect(resolveRunModes('both')).toEqual([true, false]);
	});

	it('mounts every playground serially and attributes browser messages to it', async () => {
		const { driver, mounts } = createFakeDriver({
			routes: [
				{ path: '/a', source: 'docs/a.md', lang: 'zh-CN' },
				{ path: '/b', source: 'docs/b.md', lang: 'zh-CN' },
				{ path: '/broken', source: 'docs/broken.md', lang: 'zh-CN' }
			],
			pageError: { '/broken': 'not found' },
			playgrounds: {
				'/a': [
					{ index: 0, title: 'ok', line: 3, local: true, warnings: ['未知配置 foo，该键会被忽略'] },
					{ index: 1, title: 'bad', line: 9, local: false, warnings: [] }
				],
				'/b': [{ index: 0, title: '', line: 4, local: true, warnings: [], error: 'PLAYGROUND: views 必须是非空数组' }]
			},
			results: {
				'/a#0': local => ok(local !== false),
				'/a#1': local => ({
					status: 'error',
					local: local ?? false,
					errors: [{ kind: 'runtime', message: 'Unhandled rejection: boom' }]
				})
			},
			messages: {
				'/a#1': [
					{ type: 'console', text: 'Unhandled rejection: boom' },
					{ type: 'requestfailed', text: 'net::ERR_FAILED https://cdn/x.js' },
					{ type: 'pageerror', text: 'thrown' }
				]
			}
		});
		const report = await runChecks('http://localhost/', driver, { mode: 'both', timeout: 200, settle: 0 });
		expect(mounts).toEqual([
			{ path: '/a', index: 0, local: true },
			{ path: '/a', index: 0, local: false },
			{ path: '/a', index: 1, local: true },
			{ path: '/a', index: 1, local: false }
		]);
		expect(report).toMatchObject({ pages: 3, playgrounds: 3, runs: 4 });
		expect(report.warnings).toEqual([expect.objectContaining({ source: 'docs/a.md', line: 3, kind: 'warning' })]);
		const summary = report.errors.map(issue => `${issue.source}:${issue.line ?? ''}:${issue.runtime ?? ''}:${issue.kind}`);
		expect(summary).toEqual([
			'docs/a.md:9:local:runtime',
			'docs/a.md:9:local:network',
			'docs/a.md:9:local:pageerror',
			'docs/a.md:9:iframe:runtime',
			'docs/a.md:9:iframe:network',
			'docs/a.md:9:iframe:pageerror',
			'docs/b.md:4::config',
			'docs/broken.md:::page'
		]);

		const text = formatCheckReport(report);
		expect(text).toContain('error docs/a.md:9 「bad」 [iframe] runtime: Unhandled rejection: boom');
		expect(text).toContain('warn  docs/a.md:3 「ok」 warning: 未知配置 foo，该键会被忽略');
		expect(text).toContain('✖ 3 pages, 3 playgrounds, 4 runs: 8 errors, 1 warnings');
		expect(JSON.parse(formatCheckReport(report, { reporter: 'json' })).runs).toBe(4);
		expect(isCheckFailed(report)).toBe(true);
	});

	it('passes with warnings unless strict and filters pages', async () => {
		const { driver, mounts } = createFakeDriver({
			routes: [
				{ path: '/a', source: 'docs/a.md', lang: 'zh-CN' },
				{ path: '/skip', source: 'docs/skip.md', lang: 'zh-CN' }
			],
			playgrounds: { '/a': [{ index: 0, title: 't', local: true, warnings: ['w'] }] },
			results: { '/a#0': () => ok() }
		});
		const report = await runChecks('http://localhost/', driver, { include: 'docs/a.md', settle: 0 });
		expect(mounts).toEqual([{ path: '/a', index: 0, local: undefined }]);
		expect(isCheckFailed(report)).toBe(false);
		expect(isCheckFailed(report, { strict: true })).toBe(true);
		expect(formatCheckReport(report)).toContain('✔ 1 pages, 1 playgrounds, 1 runs: 0 errors, 1 warnings');
	});
});
