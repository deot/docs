// @vitest-environment jsdom

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vm from 'node:vm';
import { rewriteLaunchUrls } from '../../dever/src/local-assets';
import type { DocsConfig } from '../../client/src/types';

const startup = fs.readFileSync(path.resolve('index.html'), 'utf8').split('<script>').at(-1)!.split('</script>')[0];
const roots = ['https://cdn.jsdelivr.net/npm/', 'https://esm.unpkg.com/'];
const entries = [`${roots[0]}@deot/docs-launch/+esm`, `${roots[1]}@deot/docs-launch/dist/index.js`];
const response = (source: string) => new Response(source, { headers: { 'Content-Type': 'text/javascript' } });
const start = (source = startup) => {
	const doc = document.implementation.createHTMLDocument();
	doc.body.innerHTML = '<div id="app"></div>';
	const target: { $docs: Partial<DocsConfig> } = { $docs: {} };
	const task = vm.runInNewContext(source, {
		window: target, document: doc, fetch, AbortController, setTimeout, clearTimeout
	}) as Promise<void>;
	return { doc, target, task };
};

describe('HTML launch entries', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it.each([0, 1])('downloads both entries concurrently, selects entry %s and aborts the other request', async (winner) => {
		const requests: { resolve: (value: Response) => void; signal: AbortSignal }[] = [];
		vi.stubGlobal('fetch', vi.fn((_url: string, options: RequestInit) => new Promise<Response>((resolve, reject) => {
			const signal = options.signal as AbortSignal;
			requests.push({ resolve, signal });
			signal.addEventListener('abort', () => reject(new Error('Aborted')));
		})));
		const { doc, target, task } = start();
		expect(fetch).toHaveBeenCalledTimes(2);
		expect(vi.mocked(fetch).mock.calls.map(([url]) => url)).toEqual(entries);
		expect(target.$docs.runtime).toBeUndefined();
		expect(doc.querySelector('script')).toBeNull();
		const append = doc.body.appendChild.bind(doc.body);
		vi.spyOn(doc.body, 'appendChild').mockImplementation((node) => {
			expect(target.$docs.runtime?.cdn).toBe(roots[winner]);
			return append(node);
		});
		requests[winner].resolve(response('export const selected = true;'));
		await task;
		expect(target.$docs.runtime).toEqual({ mode: 'production', cdn: roots[winner] });
		expect(doc.querySelector('script')?.type).toBe('module');
		expect(doc.querySelector('script')?.textContent).toBe('export const selected = true;');
		expect(doc.querySelector('script')?.hasAttribute('src')).toBe(false);
		expect(doc.querySelectorAll('script')).toHaveLength(1);
		expect(requests.every(request => request.signal.aborted)).toBe(true);
		expect(fetch).toHaveBeenCalledTimes(2);
	});

	it('waits for the full response body and ignores a slower entry that finishes after cancellation', async () => {
		const bodies: ((source: string) => void)[] = [];
		const signals: AbortSignal[] = [];
		vi.stubGlobal('fetch', vi.fn(async (_url: string, options: RequestInit) => {
			signals.push(options.signal as AbortSignal);
			return {
				ok: true, headers: new Headers({ 'Content-Type': 'application/javascript; charset=utf-8' }),
				text: () => new Promise<string>((resolve) => { bodies.push(resolve); })
			};
		}));
		const { doc, target, task } = start();
		await vi.waitFor(() => expect(bodies).toHaveLength(2));
		expect(doc.querySelector('script')).toBeNull();
		bodies[1]('export const selected = 2;');
		await task;
		expect(signals.every(signal => signal.aborted)).toBe(true);
		bodies[0]('export const selected = 1;');
		await Promise.resolve();
		expect(target.$docs.runtime?.cdn).toBe(roots[1]);
		expect(doc.querySelectorAll('script')).toHaveLength(1);
		expect(doc.querySelector('script')?.textContent).toBe('export const selected = 2;');
	});

	it.each(['404', 'html', 'network', 'body'])('ignores a fast %s failure and waits for the successful entry', async (failure) => {
		let finish!: (value: Response) => void;
		vi.stubGlobal('fetch', vi.fn(async (url: string) => {
			if (url === entries[1]) return new Promise<Response>((resolve) => { finish = resolve; });
			if (failure === 'network') throw new Error('Offline');
			if (failure === '404') return new Response('', { status: 404 });
			if (failure === 'html') return new Response('<html></html>', { headers: { 'Content-Type': 'text/html' } });
			return { ok: true, headers: new Headers({ 'Content-Type': 'text/javascript' }), text: async () => { throw new Error('Broken body'); } };
		}));
		const { doc, target, task } = start();
		await Promise.resolve();
		expect(doc.querySelector('script')).toBeNull();
		finish(response('export const ready = true;'));
		await task;
		expect(target.$docs.runtime?.cdn).toBe(roots[1]);
	});

	it('shows a failure when both entries fail', async () => {
		vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 404 })));
		const { doc, target, task } = start();
		await task;
		expect(doc.querySelector('#app')?.textContent).toContain('入口加载失败');
		expect(doc.querySelector('script')).toBeNull();
		expect(target.$docs.runtime).toBeUndefined();
	});

	it('aborts both stalled downloads after fifteen seconds', async () => {
		vi.useFakeTimers();
		const signals: AbortSignal[] = [];
		vi.stubGlobal('fetch', vi.fn((_url: string, options: RequestInit) => new Promise<Response>((_resolve, reject) => {
			const signal = options.signal as AbortSignal;
			signals.push(signal);
			signal.addEventListener('abort', () => reject(new Error('Aborted')));
		})));
		const { doc, task } = start();
		await vi.advanceTimersByTimeAsync(15000);
		await task;
		expect(signals).toHaveLength(2);
		expect(signals.every(signal => signal.aborted)).toBe(true);
		expect(doc.querySelector('#app')?.textContent).toContain('入口加载失败');
	});

	it('clears the download timeout after selection and reports module execution errors', async () => {
		vi.useFakeTimers();
		vi.stubGlobal('fetch', vi.fn(async () => response('export const ready = true;')));
		const { doc, task } = start();
		await task;
		await vi.advanceTimersByTimeAsync(30000);
		expect(doc.querySelector('#app')?.textContent).toBe('');
		doc.querySelector('script')!.dispatchEvent(new Event('error'));
		expect(doc.querySelector('#app')?.textContent).toContain('入口加载失败');
	});

	it.each(['/packages/client/src/index.ts', '/@deot/docs-launch/+esm'])('keeps the local entry rewrite to %s', async (entry) => {
		vi.stubGlobal('fetch', vi.fn(async () => response('export const local = true;')));
		const { doc, target, task } = start(rewriteLaunchUrls(startup, entry));
		await task;
		expect(vi.mocked(fetch).mock.calls.every(([url]) => url === entry)).toBe(true);
		expect(target.$docs.runtime?.cdn).toBeUndefined();
		expect(doc.querySelector('script')?.textContent).toBe('export const local = true;');
	});
});
