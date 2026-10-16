// @vitest-environment jsdom
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as http from 'node:http';
import * as vm from 'node:vm';
import { launch } from '../../launch/src';
import { createPreviewRequestHandler } from '../src/preview';

it('loads both Client resources locally through the unchanged HTML startup and real launch', async () => {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), 'docs-preview-launch-'));
	const startup = fs.readFileSync(path.resolve('index.html'), 'utf8').split('<script>').at(-1)!.split('</script>')[0];
	for (const name of ['client', 'launch']) fs.mkdirSync(path.join(root, name));
	fs.writeFileSync(path.join(root, 'index.html'), `<div id="app"></div><script>${startup}</script>`);
	fs.writeFileSync(path.join(root, 'client/index.js'), 'export const current = true;');
	fs.writeFileSync(path.join(root, 'client/index.style.css'), '.docs-renderer { display: grid; }');
	const server = http.createServer(createPreviewRequestHandler({
		workspace: root, clientDist: path.join(root, 'client'), launchDist: path.join(root, 'launch')
	}));
	await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
	const base = `http://127.0.0.1:${(server.address() as import('node:net').AddressInfo).port}`;
	const doc = document.implementation.createHTMLDocument();
	doc.head.innerHTML = `<base href="${base}/">`;
	const timers: ReturnType<typeof setTimeout>[] = [];
	try {
		doc.body.innerHTML = await (await fetch(base)).text();
		vm.runInNewContext(doc.querySelector('script')!.textContent!, {
			document: doc, clearTimeout,
			setTimeout: (callback: () => void, delay: number) => {
				const timer = setTimeout(callback, delay);
				timers.push(timer);
				return timer;
			}
		});
		const entry = doc.querySelector<HTMLScriptElement>('script[src]')!;
		expect(entry.src).toBe(`${base}/@deot/docs-launch/+esm`);
		const adapter = await (await fetch(entry.src)).text();
		entry.dispatchEvent(new Event('load'));
		const target = { document: doc, localStorage, sessionStorage, $docs: {}, location: { reload: vi.fn() } };
		vm.runInNewContext(adapter.replace(/^import\(.*$/mu, ''), { window: target });
		const fetcher = fetch;
		vi.stubGlobal('fetch', vi.fn(async () => new Response('{}')));
		await launch(target as unknown as Window);
		const style = doc.querySelector<HTMLLinkElement>('link[rel="stylesheet"]')!;
		const script = doc.querySelector<HTMLScriptElement>('script[src$="/@deot/docs-client/dist/bundle/index.js"]')!;
		expect(style.href).toBe(`${base}/@deot/docs-client/dist/bundle/index.style.css`);
		expect(script.src).toBe(`${base}/@deot/docs-client/dist/bundle/index.js`);
		expect(doc.querySelectorAll('link[rel="stylesheet"]')).toHaveLength(1);
		expect(await (await fetcher(style.href)).text()).toContain('display: grid');
		expect(await (await fetcher(script.src)).text()).toContain('current = true');
	} finally {
		doc.querySelectorAll('link,script').forEach(node => node.dispatchEvent(new Event('load')));
		timers.forEach(timer => clearTimeout(timer));
		vi.unstubAllGlobals();
		localStorage.clear();
		sessionStorage.clear();
		await new Promise<void>(resolve => server.close(() => resolve()));
		fs.rmSync(root, { recursive: true, force: true });
	}
});
