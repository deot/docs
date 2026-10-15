// @vitest-environment jsdom

import { launch } from '../src';
import type { DocsConfig } from '../../client/src/types';

const roots = ['https://cdn.jsdelivr.net/npm/', 'https://esm.unpkg.com/'];
const cacheKey = '@deot/docs-launch:cdn';
const targets: Window[] = [];
const host = (config: Partial<DocsConfig> = {}) => {
	const target = {
		document: document.implementation.createHTMLDocument(),
		localStorage,
		sessionStorage,
		location: { reload: vi.fn() },
		$docs: { locales: {}, routes: {}, ...config }
	} as unknown as Window;
	targets.push(target);
	return target;
};
const loaded = (target: Window) => target.document.querySelectorAll('link,script')
	.forEach(node => node.dispatchEvent(new Event('load')));

describe('docs launch', () => {
	beforeEach(() => {
		localStorage.clear();
		sessionStorage.clear();
	});

	afterEach(() => {
		targets.splice(0).forEach(loaded);
		vi.unstubAllGlobals();
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it('uses the default candidates and inserts four CSS links before requesting Client JS', async () => {
		const fetcher = vi.fn<typeof fetch>(async () => new Response('{}'));
		vi.stubGlobal('fetch', fetcher);
		const target = host();
		const order: string[] = [];
		const head = target.document.head;
		const body = target.document.body;
		const appendHead = head.appendChild.bind(head);
		const appendBody = body.appendChild.bind(body);
		vi.spyOn(head, 'appendChild').mockImplementation((node) => {
			expect(target.$docs.runtime?.cdn).toBe(roots[0]);
			order.push(node.nodeName);
			return appendHead(node);
		});
		vi.spyOn(body, 'appendChild').mockImplementation((node) => {
			order.push(node.nodeName);
			return appendBody(node);
		});
		await launch(target);
		expect(fetcher.mock.calls.map(call => call[0])).toEqual(roots.map(root => `${root}@deot/docs-theme@1.1.4/package.json?raw`));
		expect(order).toEqual(['LINK', 'LINK', 'LINK', 'LINK', 'SCRIPT']);
		expect([...head.querySelectorAll('link')].map(link => link.href)).toEqual(
			['client', 'renderer', 'markdown', 'playground'].map(name => `${roots[0]}@deot/docs-${name}/dist/index.style.css`)
		);
		expect(body.querySelector('script')?.src).toBe(`${roots[0]}@deot/docs-client/+esm`);
		expect(body.querySelector('script')?.type).toBe('module');
		expect(localStorage.getItem(cacheKey)).toBe(roots[0]);
	});

	it('starts from cache immediately, refreshes it silently, and uses the new node on the next page', async () => {
		localStorage.setItem(cacheKey, roots[0]);
		const requests: { resolve: (response: Response) => void; signal: AbortSignal }[] = [];
		const fetcher = vi.fn((_url: string, options: RequestInit) => new Promise<Response>((resolve, reject) => {
			requests.push({ resolve, signal: options.signal as AbortSignal });
			options.signal!.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
		}));
		vi.stubGlobal('fetch', fetcher);
		const cdn = vi.fn(({ url }: { url: string }) => url);
		const target = host({ resolve: { cdn } });
		const task = launch(target);
		expect(launch(target)).toBe(task);
		await task;
		expect(requests.every(request => !request.signal.aborted)).toBe(true);
		expect(target.$docs.runtime?.cdn).toBe(roots[0]);
		expect(target.document.querySelectorAll('link')).toHaveLength(4);
		expect(target.document.querySelector('script')?.src).toBe(`${roots[0]}@deot/docs-client/+esm`);
		expect(fetcher).toHaveBeenCalledTimes(2);
		expect(cdn).toHaveBeenCalledTimes(5);

		requests[1].resolve(new Response('{}'));
		await vi.waitFor(() => expect(localStorage.getItem(cacheKey)).toBe(roots[1]));
		loaded(target);
		expect(localStorage.getItem(cacheKey)).toBe(roots[1]);
		expect(requests.every(request => request.signal.aborted)).toBe(true);
		expect(target.$docs.runtime?.cdn).toBe(roots[0]);
		expect(target.document.querySelectorAll('link,script')).toHaveLength(5);
		expect(cdn).toHaveBeenCalledTimes(5);

		const next = host();
		await launch(next);
		expect(next.$docs.runtime?.cdn).toBe(roots[1]);
		expect(next.document.querySelector('script')?.src).toBe(`${roots[1]}@deot/docs-client/dist/index.js`);
		requests[3].resolve(new Response('{}'));
		await vi.waitFor(() => expect(requests[2].signal.aborted).toBe(true));
	});

	it('keeps cached resources and the saved node when silent probing fails', async () => {
		localStorage.setItem(cacheKey, roots[1]);
		vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 404 })));
		const error = vi.spyOn(console, 'error').mockImplementation(() => {});
		const target = host();
		await launch(target);
		// 等待后台任务完成，确认失败不会修改缓存或报告启动错误。
		await new Promise(resolve => setTimeout(resolve, 0));
		expect(target.$docs.runtime?.cdn).toBe(roots[1]);
		expect(localStorage.getItem(cacheKey)).toBe(roots[1]);
		expect(target.document.querySelectorAll('link,script')).toHaveLength(5);
		expect(error).not.toHaveBeenCalled();
	});

	it.each([roots[1], 'invalid'])('ignores an unusable cached node (%s) and waits for a fresh probe', async (cached) => {
		localStorage.setItem(cacheKey, cached);
		let finish!: (response: Response) => void;
		vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((resolve) => { finish = resolve; })));
		const target = host({ cdns: [roots[0]] });
		const task = launch(target);
		expect(target.document.querySelector('link,script')).toBeNull();
		finish(new Response('{}'));
		await task;
		expect(target.$docs.runtime?.cdn).toBe(roots[0]);
		expect(localStorage.getItem(cacheKey)).toBe(roots[0]);
	});

	it.each(['getItem', 'setItem'] as const)('still launches when storage %s fails', async (method) => {
		vi.stubGlobal('fetch', vi.fn(async () => new Response('{}')));
		vi.spyOn(Storage.prototype, method).mockImplementation(() => { throw new Error('Storage disabled'); });
		const target = host();
		await launch(target);
		expect(target.$docs.runtime?.cdn).toBe(roots[0]);
		expect(target.document.querySelectorAll('link,script')).toHaveLength(5);
	});

	it('still launches when access to localStorage is blocked', async () => {
		vi.stubGlobal('fetch', vi.fn(async () => new Response('{}')));
		const target = host();
		Object.defineProperty(target, 'localStorage', { get: () => { throw new DOMException('Blocked', 'SecurityError'); } });
		await launch(target);
		expect(target.$docs.runtime?.cdn).toBe(roots[0]);
		expect(target.document.querySelectorAll('link,script')).toHaveLength(5);
	});

	it('waits for a complete successful body, chooses UNPKG, and cancels the slower probe', async () => {
		let finish!: (text: string) => void;
		const signals: AbortSignal[] = [];
		vi.stubGlobal('fetch', vi.fn(async (url: string, options: RequestInit) => {
			signals.push(options.signal as AbortSignal);
			return {
				ok: true,
				text: () => String(url).startsWith(roots[0])
					? new Promise<string>((resolve) => { finish = resolve; })
					: Promise.resolve('{}')
			} as Response;
		}));
		const target = host();
		await launch(target);
		expect(target.$docs.runtime?.cdn).toBe(roots[1]);
		expect(target.document.body.querySelector('script')?.src).toBe(`${roots[1]}@deot/docs-client/dist/index.js`);
		expect(signals.every(signal => signal.aborted)).toBe(true);
		finish('{}');
	});

	it('normalizes candidates, reuses the task, and invokes the existing hook only for five resources', async () => {
		vi.stubGlobal('fetch', vi.fn(async () => new Response('{}')));
		const cdn = vi.fn(({ url }: { url: string }) => `${url}?custom=1`);
		const config = { cdns: [' https://esm.unpkg.com/// ', roots[1]], resolve: { cdn } };
		const target = host(config);
		const task = launch(target);
		expect(launch(target)).toBe(task);
		await task;
		expect(fetch).toHaveBeenCalledTimes(1);
		expect(cdn).toHaveBeenCalledTimes(5);
		expect(target.$docs.resolve?.cdn).toBe(cdn);
		expect(target.$docs.cdns).toEqual(config.cdns);
		expect(target.document.body.querySelector('script')?.src).toBe(`${roots[1]}@deot/docs-client/dist/index.js?custom=1`);
	});

	it.each([null, undefined, ''])('keeps resource addresses when the hook returns %s', async (value) => {
		vi.stubGlobal('fetch', vi.fn(async () => new Response('{}')));
		const target = host({ cdns: [], resolve: { cdn: () => value } });
		await launch(target);
		expect(target.document.body.querySelector('script')?.src).toBe(`${roots[0]}@deot/docs-client/+esm`);
	});

	it('ignores a quick 404 and never loads resources before a successful probe', async () => {
		let finish!: (response: Response) => void;
		vi.stubGlobal('fetch', vi.fn(async (url: string) => url.startsWith(roots[0])
			? new Response('', { status: 404 })
			: new Promise<Response>((resolve) => { finish = resolve; })));
		const target = host();
		const task = launch(target);
		await Promise.resolve();
		expect(target.document.querySelector('link,script')).toBeNull();
		finish(new Response('{}'));
		await task;
		expect(target.$docs.runtime?.cdn).toBe(roots[1]);
	});

	it('tries actual resources in candidate order when all metadata probes fail', async () => {
		vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 404 })));
		const target = host();
		await launch(target);
		expect(target.$docs.runtime?.cdn).toBe(roots[0]);
		expect(target.document.querySelector('script')?.src).toBe(`${roots[0]}@deot/docs-client/+esm`);
		loaded(target);
		expect(localStorage.getItem(cacheKey)).toBe(roots[0]);
	});

	it('aborts a stalled probe after five seconds and still tries the actual resources', async () => {
		vi.useFakeTimers();
		vi.stubGlobal('fetch', vi.fn((_url: string, options: RequestInit) => new Promise((_resolve, reject) => {
			options.signal!.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
		})));
		const target = host({ cdns: [roots[0]] });
		const task = launch(target);
		await vi.advanceTimersByTimeAsync(5000);
		await task;
		expect(target.document.querySelector('script')?.src).toBe(`${roots[0]}@deot/docs-client/+esm`);
	});

	it.each(['script', 'link'])('retries the whole page on %s failure and excludes the failed node', async (selector) => {
		localStorage.setItem(cacheKey, roots[0]);
		vi.stubGlobal('fetch', vi.fn(async () => new Response('{}')));
		const target = host();
		await launch(target);
		target.document.querySelector(selector)!.dispatchEvent(new Event('error'));
		target.document.querySelector(selector)!.dispatchEvent(new Event('error'));
		expect(target.location.reload).toHaveBeenCalledTimes(1);
		expect(JSON.parse(sessionStorage.getItem(cacheKey)!)).toEqual([roots[0]]);
		expect(localStorage.getItem(cacheKey)).toBe(roots[1]);

		const next = host();
		await launch(next);
		expect(next.$docs.runtime?.cdn).toBe(roots[1]);
		expect(next.document.querySelector('script')?.src).toBe(`${roots[1]}@deot/docs-client/dist/index.js`);
		expect(sessionStorage.getItem(cacheKey)).toBeNull();
		expect(fetch).toHaveBeenCalledTimes(3);
	});

	it('reloads on a late CSS failure even when the Client module has already loaded', async () => {
		vi.stubGlobal('fetch', vi.fn(async () => new Response('{}')));
		const target = host();
		await launch(target);
		target.document.querySelector('script')!.dispatchEvent(new Event('load'));
		target.document.querySelector('link')!.dispatchEvent(new Event('error'));
		expect(target.location.reload).toHaveBeenCalledTimes(1);
	});

	it('reloads after thirty seconds and ignores late events from the old attempt', async () => {
		vi.useFakeTimers();
		vi.stubGlobal('fetch', vi.fn(async () => new Response('{}')));
		const target = host();
		await launch(target);
		await vi.advanceTimersByTimeAsync(30000);
		loaded(target);
		target.document.querySelector('script')!.dispatchEvent(new Event('error'));
		expect(target.location.reload).toHaveBeenCalledTimes(1);
	});

	it('stops the timeout after all five resources load', async () => {
		vi.useFakeTimers();
		vi.stubGlobal('fetch', vi.fn(async () => new Response('{}')));
		const target = host();
		await launch(target);
		loaded(target);
		await vi.advanceTimersByTimeAsync(35000);
		expect(target.location.reload).not.toHaveBeenCalled();
	});

	it('shows a visible failure after every node is exhausted without a reload loop', async () => {
		vi.stubGlobal('fetch', vi.fn(async () => new Response('{}')));
		const error = vi.spyOn(console, 'error').mockImplementation(() => {});
		const first = host();
		await launch(first);
		first.document.querySelector('script')!.dispatchEvent(new Event('error'));
		const last = host();
		last.document.body.innerHTML = '<div id="app"></div>';
		await launch(last);
		last.document.querySelector('script')!.dispatchEvent(new Event('error'));
		expect(first.location.reload).toHaveBeenCalledTimes(1);
		expect(last.location.reload).not.toHaveBeenCalled();
		expect(last.document.querySelector('#app')?.textContent).toContain('加载失败');
		expect(localStorage.getItem(cacheKey)).toBe('');
		expect(sessionStorage.getItem(cacheKey)).toBeNull();
		expect(error).toHaveBeenCalledTimes(1);
	});

	it('does not overwrite an already mounted app when the last node fails', async () => {
		vi.stubGlobal('fetch', vi.fn(async () => new Response('{}')));
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const target = host({ cdns: [roots[0]] });
		target.document.body.innerHTML = '<div id="app" data-v-app>mounted</div>';
		await launch(target);
		target.document.querySelector('link')!.dispatchEvent(new Event('error'));
		expect(target.document.querySelector('#app')?.textContent).toBe('mounted');
	});

	it('does not reload if retry state cannot be saved', async () => {
		vi.stubGlobal('fetch', vi.fn(async () => new Response('{}')));
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const target = host();
		Object.defineProperty(target, 'sessionStorage', { get: () => { throw new DOMException('Blocked', 'SecurityError'); } });
		await launch(target);
		target.document.querySelector('script')!.dispatchEvent(new Event('error'));
		expect(target.location.reload).not.toHaveBeenCalled();
	});

	it('ignores corrupt retry state', async () => {
		sessionStorage.setItem(cacheKey, 'invalid');
		vi.stubGlobal('fetch', vi.fn(async () => new Response('{}')));
		const target = host();
		await launch(target);
		expect(target.$docs.runtime?.cdn).toBe(roots[0]);
	});

	it('never restores a failed node from a late silent probe', async () => {
		localStorage.setItem(cacheKey, roots[0]);
		let finish!: (response: Response) => void;
		vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((resolve) => { finish = resolve; })));
		const target = host({ cdns: [roots[0]] });
		vi.spyOn(console, 'error').mockImplementation(() => {});
		await launch(target);
		target.document.querySelector('script')!.dispatchEvent(new Event('error'));
		finish(new Response('{}'));
		await new Promise(resolve => setTimeout(resolve, 0));
		expect(localStorage.getItem(cacheKey)).toBe('');
	});

	it('rejects invalid retry state that leaves no candidates', async () => {
		sessionStorage.setItem(cacheKey, JSON.stringify(roots));
		await expect(launch(host())).rejects.toThrow('No CDN available');
	});

	it('reports resource failures from the automatic entry', async () => {
		vi.resetModules();
		vi.stubGlobal('fetch', vi.fn(async () => new Response('{}')));
		vi.stubGlobal('$docs', { locales: {}, routes: {}, cdns: [roots[0]] });
		const error = vi.spyOn(console, 'error').mockImplementation(() => {});
		const app = document.createElement('div');
		app.id = 'app';
		document.body.appendChild(app);
		try {
			await import('../src');
			await vi.waitFor(() => expect(document.querySelector(`script[src="${roots[0]}@deot/docs-client/+esm"]`)).not.toBeNull());
			document.querySelector('script')!.dispatchEvent(new Event('error'));
			expect(error).toHaveBeenCalledWith('[docs-launch] Failed to load', roots[0], expect.any(Event));
		} finally {
			app.remove();
			document.querySelectorAll('link,script').forEach(node => node.remove());
			Reflect.deleteProperty(window, Symbol.for('@deot/docs-launch'));
		}
	});

	it('reports initialization failures from the automatic entry', async () => {
		vi.resetModules();
		sessionStorage.setItem(cacheKey, JSON.stringify(roots));
		vi.stubGlobal('$docs', { locales: {}, routes: {} });
		const error = vi.spyOn(console, 'error').mockImplementation(() => {});
		const app = document.createElement('div');
		app.id = 'app';
		document.body.appendChild(app);
		try {
			await import('../src');
			await vi.waitFor(() => expect(error).toHaveBeenCalledWith('[docs-launch] Failed to launch', expect.any(Error)));
		} finally {
			app.remove();
			Reflect.deleteProperty(window, Symbol.for('@deot/docs-launch'));
		}
	});
});
