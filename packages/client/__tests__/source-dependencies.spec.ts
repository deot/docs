import { createResourceDependencyResolver } from '../src/utils/source-dependencies';
import { ResourceRequestError } from '../src/modules/gateway/types';

describe('HTTP source dependency tracking', () => {
	const base = 'https://assets.example.com/demo/';

	it('probes suffixes, directory entries and Sass partials and reuses resolved files', async () => {
		const files = new Set([`${base}catalogue.ts`, `${base}widgets/index.tsx`, `${base}style/_theme.scss`]);
		const probe = vi.fn(async (url: string) => {
			if (!files.has(url)) throw new ResourceRequestError(404);
		});
		const resolve = createResourceDependencyResolver();
		const source = `<script>import './catalogue'; import './widgets';</script><style>@use './style/theme';</style>`;
		await expect(resolve(source, 'sfc', `${base}App.vue`, probe)).resolves.toEqual([
			`${base}catalogue.ts`, `${base}widgets/index.tsx`, `${base}style/_theme.scss`
		]);
		const count = probe.mock.calls.length;
		await expect(resolve(`import '../catalogue';`, 'module', `${base}widgets/child.ts`, probe))
			.resolves.toEqual([`${base}catalogue.ts`]);
		expect(probe).toHaveBeenCalledTimes(count);
	});

	it('resolves from a known file index without fetching during cached resource collection', async () => {
		const resolve = createResourceDependencyResolver([`${base}logic.js`, `${base}parts/index.ts`]);
		await expect(resolve(`import './logic'; export * from './parts';`, 'module', `${base}App.ts`))
			.resolves.toEqual([`${base}logic.js`, `${base}parts/index.ts`]);
	});

	it('shares concurrent probes and stops on non-404 errors', async () => {
		const probe = vi.fn(async (url: string) => {
			if (url !== `${base}shared.js`) throw new ResourceRequestError(404);
		});
		const resolve = createResourceDependencyResolver();
		await Promise.all([
			resolve(`import './shared';`, 'module', `${base}a.ts`, probe),
			resolve(`import './shared';`, 'module', `${base}b.ts`, probe)
		]);
		expect(probe.mock.calls.filter(([url]) => url === `${base}shared.js`)).toHaveLength(1);
		const denied = vi.fn(async () => { throw new ResourceRequestError(403); });
		await expect(resolve(`import './private';`, 'module', `${base}App.ts`, denied)).rejects.toMatchObject({ status: 403 });
		expect(denied).toHaveBeenCalledTimes(1);
	});

	it('does not invent a directory listing for glob imports on HTTP sources', async () => {
		const resolve = createResourceDependencyResolver();
		await expect(resolve(`const modules = import.meta.glob('./*.vue', { eager: true });`, 'module', `${base}App.ts`))
			.rejects.toThrow('无法枚举 glob 文件');
	});
});
