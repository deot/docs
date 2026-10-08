// @vitest-environment jsdom
import { createGithubSourceResolver } from '../src/utils/github-source';

const root = 'https://raw.githubusercontent.com/deot/vc/refs/heads/main/';

afterEach(() => vi.unstubAllGlobals());

describe('GitHub remote source resolution', () => {
	it('uses actual suffixes and expands eager glob imports from a shared file list', async () => {
		const fetchTree = vi.fn(async () => ({ ok: true, json: async () => ({ tree: [
			{ type: 'blob', path: 'demo/catalogue.ts' },
			{ type: 'blob', path: 'demo/index.m.ts' },
			{ type: 'blob', path: 'demo/index.ts' },
			{ type: 'blob', path: 'demo/modules/audio.tsx' },
			{ type: 'blob', path: 'demo/modules/button.vue' },
			{ type: 'blob', path: 'demo/modules/input.vue' },
			{ type: 'blob', path: 'style/_theme.scss' }
		] }) }));
		vi.stubGlobal('fetch', fetchTree);
		const resolver = createGithubSourceResolver(`${root}demo/App.vue`, new AbortController().signal)!;
		await expect(resolver.resolve('./catalogue', `${root}demo/App.vue`, false)).resolves.toEqual([`${root}demo/catalogue.ts`]);
		await expect(resolver.resolve('./modules/audio', `${root}demo/App.vue`, false)).resolves.toEqual([`${root}demo/modules/audio.tsx`]);
		await expect(resolver.resolve('../style/theme', `${root}demo/App.vue`, true)).resolves.toEqual([`${root}style/_theme.scss`]);
		await expect(resolver.resolve('./index.m', `${root}demo/App.vue`, false)).resolves.toEqual([`${root}demo/index.m.ts`]);
		await expect(resolver.resolve('.', `${root}demo/App.vue`, false)).resolves.toEqual([`${root}demo/index.ts`]);
		const code = await resolver.expandGlob(
			`const files = import.meta.glob<{ default: Component }>('./modules/*.vue', { eager: true });`,
			`${root}demo/modules.ts`
		);
		expect(code).toContain('import * as __docs_glob_0 from "./modules/button.vue"');
		expect(code).toContain('"./modules/input.vue": __docs_glob_1');
		expect(code).not.toContain('import.meta.glob');
		expect(fetchTree).toHaveBeenCalledTimes(1);
	});

	it('falls back to path probes on 403 and uses a CDN file list only for glob imports', async () => {
		const requests = vi.fn(async (url: string) => url.startsWith('https://api.github.com/')
			? { ok: false, status: 403 }
			: { ok: true, json: async () => ({ files: [{ name: '/demo/modules/button.vue' }] }) });
		vi.stubGlobal('fetch', requests);
		const resolver = createGithubSourceResolver(`${root}demo/App.vue`)!;
		const candidates = await resolver.resolve('./catalogue', `${root}demo/App.vue`, false);
		expect(candidates).toContain(`${root}demo/catalogue.ts`);
		await resolver.resolve('./another', `${root}demo/App.vue`, false);
		expect(requests).toHaveBeenCalledTimes(1);
		const expanded = await resolver.expandGlob(`const modules = import.meta.glob('./modules/*.vue', { eager: true });`, `${root}demo/modules.ts`);
		expect(expanded).toContain('import * as __docs_glob_0 from "./modules/button.vue"');
		await resolver.expandGlob(`import.meta.glob('./modules/*.vue', { eager: true })`, `${root}demo/modules.ts`);
		expect(requests).toHaveBeenCalledTimes(2);
		expect(requests).toHaveBeenLastCalledWith('https://data.jsdelivr.com/v1/package/gh/deot/vc@main/flat', { signal: undefined });
	});

	it('falls back on a truncated tree or network failure', async () => {
		vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ truncated: true, tree: [] }) })));
		const truncated = createGithubSourceResolver(`${root}demo/App.vue`)!;
		await expect(truncated.resolve('./logic', `${root}demo/App.vue`, false)).resolves.toContain(`${root}demo/logic.js`);
		vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('offline'); }));
		const offline = createGithubSourceResolver(`${root}demo/App.vue`)!;
		await expect(offline.resolve('./logic', `${root}demo/App.vue`, false)).resolves.toContain(`${root}demo/logic.js`);
	});

	it('preserves cancellation and reports an unavailable glob fallback', async () => {
		const controller = new AbortController();
		controller.abort();
		vi.stubGlobal('fetch', vi.fn(async () => { throw new DOMException('Aborted', 'AbortError'); }));
		const cancelled = createGithubSourceResolver(`${root}demo/App.vue`, controller.signal)!;
		await expect(cancelled.resolve('./logic', `${root}demo/App.vue`, false)).rejects.toMatchObject({ name: 'AbortError' });
		vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 403 })));
		const unavailable = createGithubSourceResolver(`${root}demo/App.vue`)!;
		await expect(unavailable.expandGlob(`import.meta.glob('./*.vue', { eager: true })`, `${root}demo/App.ts`))
			.rejects.toThrow('glob 备用文件清单加载失败');
	});

	it('reports missing files and unsupported glob calls', async () => {
		vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ tree: [] }) })));
		const resolver = createGithubSourceResolver(`${root}App.vue`, new AbortController().signal)!;
		await expect(resolver.resolve('./missing', `${root}App.vue`, false)).rejects.toThrow('无法解析依赖');
		await expect(resolver.expandGlob(`import.meta.glob('./*.vue')`, `${root}App.vue`)).rejects.toThrow('不支持的 glob');
		expect(createGithubSourceResolver('https://example.com/App.vue', new AbortController().signal)).toBeNull();
	});
});
