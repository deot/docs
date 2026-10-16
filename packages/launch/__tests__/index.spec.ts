// @vitest-environment jsdom

import { launch } from '../src';
import type { DocsConfig } from '../../client/src/types';

const root = 'https://cdn.jsdelivr.net/npm/';
const targets: Window[] = [];
const host = (config: Partial<DocsConfig> = {}) => {
	const target = {
		document: document.implementation.createHTMLDocument(),
		$docs: { locales: {}, routes: {}, ...config }
	} as unknown as Window;
	targets.push(target);
	return target;
};
const loaded = (target: Window) => target.document.querySelectorAll('link,script')
	.forEach(node => node.dispatchEvent(new Event('load')));

describe('docs launch', () => {
	afterEach(() => {
		targets.splice(0).forEach(loaded);
		vi.unstubAllGlobals();
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it('defaults to jsDelivr without probing or storage and inserts CSS before Client JS', async () => {
		const fetcher = vi.fn();
		vi.stubGlobal('fetch', fetcher);
		const target = host();
		Reflect.deleteProperty(target, '$docs');
		const order: string[] = [];
		const head = target.document.head;
		const body = target.document.body;
		const appendHead = head.appendChild.bind(head);
		const appendBody = body.appendChild.bind(body);
		vi.spyOn(head, 'appendChild').mockImplementation((node) => {
			expect(target.$docs.runtime).toEqual({ mode: 'production', cdn: root });
			order.push(node.nodeName);
			return appendHead(node);
		});
		vi.spyOn(body, 'appendChild').mockImplementation((node) => {
			order.push(node.nodeName);
			return appendBody(node);
		});
		await launch(target);
		expect(fetcher).not.toHaveBeenCalled();
		expect(order).toEqual(['LINK', 'SCRIPT']);
		expect(head.querySelector('link')?.href).toBe(`${root}@deot/docs-client/dist/bundle/index.style.css`);
		expect(body.querySelector('script')?.src).toBe(`${root}@deot/docs-client/dist/bundle/index.js`);
		expect(body.querySelector('script')?.type).toBe('module');
	});

	it('uses the HTML-selected CDN, preserves runtime fields and reuses the startup task', async () => {
		const cdn = vi.fn(({ url }: { url: string }) => `${url}?custom=1`);
		const target = host({
			runtime: { mode: 'development', workspace: '/docs/', cdn: ' https://esm.unpkg.com/// ' },
			resolve: { cdn }
		});
		const task = launch(target);
		expect(launch(target)).toBe(task);
		await task;
		expect(target.$docs.runtime).toEqual({ mode: 'development', workspace: '/docs/', cdn: 'https://esm.unpkg.com/' });
		expect(target.document.querySelector('link')?.href).toBe('https://esm.unpkg.com/@deot/docs-client/dist/bundle/index.style.css?custom=1');
		expect(target.document.querySelector('script')?.src).toBe('https://esm.unpkg.com/@deot/docs-client/dist/bundle/index.js?custom=1');
		expect(target.$docs.resolve?.cdn).toBe(cdn);
		expect(cdn).toHaveBeenCalledTimes(2);
	});

	it.each([null, undefined, ''])('keeps resource addresses when the hook returns %s', async (value) => {
		const target = host({ resolve: { cdn: () => value } });
		await launch(target);
		expect(target.document.querySelector('script')?.src).toBe(`${root}@deot/docs-client/dist/bundle/index.js`);
	});

	it.each(['script', 'link'])('shows a visible failure when %s fails and ignores late events', async (selector) => {
		const error = vi.spyOn(console, 'error').mockImplementation(() => {});
		const target = host();
		target.document.body.innerHTML = '<div id="app"></div>';
		await launch(target);
		target.document.querySelector(selector)!.dispatchEvent(new Event('error'));
		target.document.querySelector(selector)!.dispatchEvent(new Event('error'));
		loaded(target);
		expect(target.document.querySelector('#app')?.textContent).toContain('加载失败');
		expect(target.document.querySelectorAll('link,script')).toHaveLength(2);
		expect(error).toHaveBeenCalledExactlyOnceWith('[docs-launch] Failed to load', root, expect.any(Event));
	});

	it('reports a CSS failure even after the Client module has loaded', async () => {
		const error = vi.spyOn(console, 'error').mockImplementation(() => {});
		const target = host();
		await launch(target);
		target.document.querySelector('script')!.dispatchEvent(new Event('load'));
		target.document.querySelector('link')!.dispatchEvent(new Event('error'));
		expect(error).toHaveBeenCalledTimes(1);
	});

	it('reports a timeout after thirty seconds', async () => {
		vi.useFakeTimers();
		const error = vi.spyOn(console, 'error').mockImplementation(() => {});
		const target = host();
		target.document.body.innerHTML = '<div id="app"></div>';
		await launch(target);
		await vi.advanceTimersByTimeAsync(30000);
		expect(target.document.querySelector('#app')?.textContent).toContain('加载失败');
		expect(error).toHaveBeenCalledExactlyOnceWith('[docs-launch] Failed to load', root, undefined);
	});

	it('stops the timeout after both resources load', async () => {
		vi.useFakeTimers();
		const error = vi.spyOn(console, 'error').mockImplementation(() => {});
		const target = host();
		await launch(target);
		loaded(target);
		await vi.advanceTimersByTimeAsync(35000);
		expect(error).not.toHaveBeenCalled();
	});

	it('does not overwrite an already mounted app on failure', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const target = host();
		target.document.body.innerHTML = '<div id="app" data-v-app>mounted</div>';
		await launch(target);
		target.document.querySelector('link')!.dispatchEvent(new Event('error'));
		expect(target.document.querySelector('#app')?.textContent).toBe('mounted');
	});

	it.each([false, true])('reports automatic startup failures (initialization: %s)', async (initialization) => {
		vi.resetModules();
		vi.stubGlobal('$docs', {
			locales: {}, routes: {},
			resolve: { cdn: ({ url }: { url: string }) => {
				if (initialization) throw new Error('Invalid CDN hook');
				return url;
			} }
		});
		const error = vi.spyOn(console, 'error').mockImplementation(() => {});
		const app = document.createElement('div');
		app.id = 'app';
		document.body.appendChild(app);
		try {
			await import('../src');
			if (initialization) {
				await vi.waitFor(() => expect(error).toHaveBeenCalledWith('[docs-launch] Failed to launch', expect.any(Error)));
			} else {
				await launch();
				document.querySelector('script')!.dispatchEvent(new Event('error'));
				expect(error).toHaveBeenCalledWith('[docs-launch] Failed to load', root, expect.any(Event));
			}
		} finally {
			app.remove();
			document.querySelectorAll('link,script').forEach(node => node.remove());
			Reflect.deleteProperty(window, Symbol.for('@deot/docs-launch'));
		}
	});
});
