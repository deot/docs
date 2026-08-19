// @vitest-environment jsdom

import 'fake-indexeddb/auto';
import {
	clearPlaygroundMaps,
	createBuiltinImports,
	createBuiltinStyles,
	getPlaygroundImportMapOverrides,
	getPlaygroundSiteModules,
	getPlaygroundSiteStyles,
	getPlaygroundStyleOverrides,
	setPlaygroundImportMapOverrides,
	setPlaygroundSiteModules,
	setPlaygroundStyleOverrides
} from '@deot/docs-playground';
import {
	PlaygroundResource,
	PlaygroundResourceCache,
	measurePlaygroundResourceBytes
} from '../src/modules/playground-resource';

const listRows = async (...args: Parameters<typeof PlaygroundResource.listPage>) => (
	(await PlaygroundResource.listPage(...args)).rows
);

const deleteDatabase = () => new Promise<void>((resolve, reject) => {
	const request = indexedDB.deleteDatabase('deot-docs-playground-resource');
	request.onsuccess = () => resolve();
	request.onerror = () => reject(request.error);
});

describe('PlaygroundResourceCache', () => {
	beforeEach(async () => {
		await deleteDatabase();
		clearPlaygroundMaps();
	});

	afterAll(async () => {
		await deleteDatabase();
		clearPlaygroundMaps();
	});

	it('persists overrides across cache instances and isolates namespaces', async () => {
		const writer = new PlaygroundResourceCache();
		await writer.set('site-a', 'vue', 'https://cdn.example.com/vue.js', 'import');
		await writer.set('site-a', 'lodash-es', 'https://cdn.example.com/lodash.js', 'import');
		await writer.set(
			'site-a',
			'@deot/style/dist/index.css',
			'https://cdn.example.com/index.css',
			'style'
		);
		await writer.set('site-b', 'vue', 'https://other.example.com/vue.js', 'import');

		const reader = new PlaygroundResourceCache();
		expect(await reader.list('site-a')).toEqual([
			expect.objectContaining({
				alias: '@deot/style/dist/index.css',
				url: 'https://cdn.example.com/index.css',
				namespace: 'site-a',
				kind: 'style'
			}),
			expect.objectContaining({
				alias: 'lodash-es',
				url: 'https://cdn.example.com/lodash.js',
				namespace: 'site-a',
				kind: 'import'
			}),
			expect.objectContaining({
				alias: 'vue',
				url: 'https://cdn.example.com/vue.js',
				namespace: 'site-a',
				kind: 'import'
			})
		]);
		expect(await reader.list('site-b')).toEqual([
			expect.objectContaining({
				alias: 'vue',
				url: 'https://other.example.com/vue.js',
				namespace: 'site-b',
				kind: 'import'
			})
		]);

		await reader.remove('site-a', 'vue', 'import');
		expect((await reader.list('site-a')).map(item => item.alias)).toEqual([
			'@deot/style/dist/index.css',
			'lodash-es'
		]);
	});

	it('hydrates playground memory overrides on start and clears them on stop', async () => {
		const cache = new PlaygroundResourceCache();
		await cache.set('docs', 'vue', 'https://cdn.example.com/vue.js', 'import');
		await cache.set(
			'docs',
			'@deot/style/dist/index.css',
			'https://cdn.example.com/index.css',
			'style'
		);

		const stop = await PlaygroundResource.start({
			locales: { 'zh-CN': { label: '简体中文' } },
			routes: {},
			namespace: 'docs',
			modules: { 'site-lib': 'https://cdn.example.com/site-lib.js' },
			styles: {
				'@deot/style/dist/index.css': 'https://cdn.example.com/theme-default.css',
				'@my/ui/dist/index.css': '/assets/ui.css'
			}
		});
		expect(getPlaygroundSiteModules()).toEqual({
			'site-lib': 'https://cdn.example.com/site-lib.js'
		});
		expect(getPlaygroundSiteStyles()).toEqual({
			'@deot/style/dist/index.css': 'https://cdn.example.com/theme-default.css',
			'@my/ui/dist/index.css': '/assets/ui.css'
		});
		expect(getPlaygroundImportMapOverrides()).toEqual({
			vue: 'https://cdn.example.com/vue.js'
		});
		expect(getPlaygroundStyleOverrides()).toEqual({
			'@deot/style/dist/index.css': 'https://cdn.example.com/index.css'
		});

		await PlaygroundResource.set('docs', 'custom', 'https://cdn.example.com/custom.js', 'import');
		expect(getPlaygroundImportMapOverrides().custom).toBe('https://cdn.example.com/custom.js');

		await PlaygroundResource.set(
			'docs',
			'@deot/vc-components/dist/index.style.css',
			'https://cdn.example.com/vc.css',
			'style'
		);
		expect(getPlaygroundStyleOverrides()['@deot/vc-components/dist/index.style.css'])
			.toBe('https://cdn.example.com/vc.css');

		await PlaygroundResource.remove('docs', 'vue', 'import');
		expect(getPlaygroundImportMapOverrides().vue).toBeUndefined();
		expect(getPlaygroundImportMapOverrides().custom).toBe('https://cdn.example.com/custom.js');

		await PlaygroundResource.remove('docs', '@deot/style/dist/index.css', 'style');
		expect(getPlaygroundStyleOverrides()['@deot/style/dist/index.css']).toBeUndefined();

		await PlaygroundResource.waitForIdle();
		await cache.clear('docs');
		expect(await cache.list('docs')).toEqual([]);

		stop();
		expect(getPlaygroundSiteModules()).toEqual({});
		expect(getPlaygroundSiteStyles()).toEqual({});
		expect(getPlaygroundImportMapOverrides()).toEqual({});
		expect(getPlaygroundStyleOverrides()).toEqual({});
	});

	it('treats a matching default url as not overridden', async () => {
		const fetchMock = vi.fn(async () => ({ ok: true, status: 200 } as Response));
		vi.stubGlobal('fetch', fetchMock);
		try {
			const defaultVue = createBuiltinImports().vue;
			const defaultStyle = createBuiltinStyles()['@deot/style/dist/index.css']!;
			const config = {
				locales: { 'zh-CN': { label: '简体中文' } },
				routes: {},
				namespace: 'docs',
				modules: { 'site-lib': 'https://cdn.example.com/site-lib.js' }
			};
			const cache = new PlaygroundResourceCache();
			await cache.set('docs', 'vue', defaultVue, 'import');
			await cache.set('docs', 'site-lib', 'https://cdn.example.com/site-lib.js', 'import');
			await cache.set('docs', '@deot/style/dist/index.css', defaultStyle, 'style');
			await cache.set('docs', 'custom', 'https://cdn.example.com/custom.js', 'import');

			const leftover = await listRows(config);
			expect(leftover.find(item => item.alias === 'vue')).toEqual(expect.objectContaining({
				overridden: false,
				currentUrl: defaultVue
			}));
			expect((await PlaygroundResource.list('docs')).map(item => item.alias))
				.toEqual(expect.arrayContaining([
					'@deot/style/dist/index.css',
					'custom',
					'site-lib',
					'vue'
				]));

			await PlaygroundResource.start(config);
			expect(getPlaygroundImportMapOverrides()).toEqual({
				custom: 'https://cdn.example.com/custom.js'
			});
			expect(getPlaygroundStyleOverrides()).toEqual({});
			expect((await PlaygroundResource.list('docs')).find(item => item.alias === 'custom'))
				.toEqual(expect.objectContaining({
					url: 'https://cdn.example.com/custom.js',
					source: 'override'
				}));
			expect((await PlaygroundResource.list('docs')).find(item => item.alias === 'vue'))
				.toEqual(expect.objectContaining({
					url: defaultVue,
					source: 'default'
				}));

			const rows = await listRows(config);
			expect(rows.find(item => item.alias === 'vue')).toEqual(expect.objectContaining({
				overridden: false,
				currentUrl: defaultVue
			}));
			expect(rows.find(item => item.alias === 'site-lib')).toEqual(expect.objectContaining({
				overridden: false,
				currentUrl: 'https://cdn.example.com/site-lib.js'
			}));
			expect(rows.find(item => item.alias === 'custom')).toEqual(expect.objectContaining({
				overridden: true,
				currentUrl: 'https://cdn.example.com/custom.js'
			}));

			await PlaygroundResource.save(
				'docs',
				'vue',
				'https://cdn.example.com/vue-override.js',
				'import',
				defaultVue
			);
			expect(getPlaygroundImportMapOverrides().vue).toBe('https://cdn.example.com/vue-override.js');
			expect((await listRows(config)).find(item => item.alias === 'vue'))
				.toEqual(expect.objectContaining({
					overridden: true,
					currentUrl: 'https://cdn.example.com/vue-override.js'
				}));

			await PlaygroundResource.save('docs', 'vue', `  ${defaultVue}  \n`, 'import', defaultVue);
			expect(getPlaygroundImportMapOverrides().vue).toBeUndefined();
			expect((await PlaygroundResource.list('docs')).find(item => item.alias === 'vue'))
				.toEqual(expect.objectContaining({
					url: defaultVue,
					source: 'default'
				}));
			expect((await listRows(config)).find(item => item.alias === 'vue'))
				.toEqual(expect.objectContaining({
					overridden: false,
					currentUrl: defaultVue
				}));
		} finally {
			vi.unstubAllGlobals();
		}
	});

	it('manages $docs.styles as default css rows and rolls back to them', async () => {
		const fetchMock = vi.fn(async () => ({ ok: true, status: 200 } as Response));
		vi.stubGlobal('fetch', fetchMock);
		try {
			const config = {
				locales: { 'zh-CN': { label: '简体中文' } },
				routes: {},
				namespace: 'docs',
				styles: {
					'@deot/style/dist/index.css': 'https://cdn.example.com/theme.css',
					'@my/ui/dist/index.css': '/assets/ui.css'
				}
			};
			await PlaygroundResource.start(config);
			expect(getPlaygroundStyleOverrides()).toEqual({});
			expect(getPlaygroundSiteStyles()).toEqual(config.styles);

			const rows = await listRows(config);
			expect(rows.find(item => item.alias === '@deot/style/dist/index.css')).toEqual(
				expect.objectContaining({
					kind: 'style',
					overridden: false,
					defaultUrl: 'https://cdn.example.com/theme.css',
					currentUrl: 'https://cdn.example.com/theme.css'
				})
			);
			expect(rows.find(item => item.alias === '@my/ui/dist/index.css')).toEqual(
				expect.objectContaining({
					kind: 'style',
					overridden: false,
					defaultUrl: '/assets/ui.css',
					currentUrl: '/assets/ui.css'
				})
			);

			await PlaygroundResource.save(
				'docs',
				'@my/ui/dist/index.css',
				'https://cdn.example.com/ui-next.css',
				'style',
				'/assets/ui.css'
			);
			expect(getPlaygroundStyleOverrides()['@my/ui/dist/index.css'])
				.toBe('https://cdn.example.com/ui-next.css');
			expect((await listRows(config)).find(item => (
				item.alias === '@my/ui/dist/index.css'
			))).toEqual(expect.objectContaining({
				overridden: true,
				currentUrl: 'https://cdn.example.com/ui-next.css'
			}));

			await PlaygroundResource.reset(
				'docs',
				'@my/ui/dist/index.css',
				'style',
				'/assets/ui.css'
			);
			expect(getPlaygroundStyleOverrides()['@my/ui/dist/index.css']).toBeUndefined();
			expect((await listRows(config)).find(item => (
				item.alias === '@my/ui/dist/index.css'
			))).toEqual(expect.objectContaining({
				overridden: false,
				currentUrl: '/assets/ui.css'
			}));
		} finally {
			vi.unstubAllGlobals();
		}
	});

	it('syncs stale default records and drops custom aliases without a default', async () => {
		const fetchMock = vi.fn(async () => ({ ok: true, status: 200 } as Response));
		vi.stubGlobal('fetch', fetchMock);
		try {
			const defaultVue = createBuiltinImports().vue;
			const cache = new PlaygroundResourceCache();
			await cache.set('docs', 'vue', 'https://cdn.example.com/vue-stale.js', 'import', {
				source: 'default'
			});
			await PlaygroundResource.set('docs', 'vue', defaultVue, 'import');
			expect(getPlaygroundImportMapOverrides().vue).toBeUndefined();

			const config = {
				locales: { 'zh-CN': { label: '简体中文' } },
				routes: {},
				namespace: 'docs',
				modules: { 'site-lib': 'https://cdn.example.com/site-lib-next.js' },
				styles: { '@my/ui/dist/index.css': '/assets/ui-next.css' }
			};
			await cache.set('docs', 'site-lib', 'https://cdn.example.com/site-lib-old.js', 'import', {
				source: 'default'
			});
			await cache.set('docs', '@my/ui/dist/index.css', '/assets/ui-old.css', 'style', {
				source: 'default'
			});
			const rows = await listRows(config);
			expect(rows.find(item => item.alias === 'vue')).toEqual(expect.objectContaining({
				overridden: false,
				currentUrl: defaultVue
			}));
			expect(rows.find(item => item.alias === 'site-lib')).toEqual(expect.objectContaining({
				overridden: false,
				currentUrl: 'https://cdn.example.com/site-lib-next.js'
			}));
			expect((await PlaygroundResource.list('docs')).find(item => item.alias === 'site-lib'))
				.toEqual(expect.objectContaining({
					url: 'https://cdn.example.com/site-lib-next.js',
					source: 'default'
				}));
			expect(rows.find(item => item.alias === '@my/ui/dist/index.css')).toEqual(
				expect.objectContaining({
					overridden: false,
					currentUrl: '/assets/ui-next.css'
				})
			);
			expect((await PlaygroundResource.list('docs')).find(item => (
				item.alias === '@my/ui/dist/index.css'
			))).toEqual(expect.objectContaining({
				url: '/assets/ui-next.css',
				source: 'default'
			}));

			await PlaygroundResource.set('docs', 'gone', 'https://cdn.example.com/gone.js', 'import');
			await PlaygroundResource.reset('docs', 'gone', 'import', '');
			expect((await PlaygroundResource.list('docs')).find(item => item.alias === 'gone'))
				.toBeUndefined();
			expect(getPlaygroundImportMapOverrides().gone).toBeUndefined();
		} finally {
			vi.unstubAllGlobals();
		}
	});

	it('measures stored record bytes for the namespace cache size', async () => {
		const config = {
			locales: { 'zh-CN': { label: '简体中文' } },
			routes: {},
			namespace: 'docs'
		};
		const page = await PlaygroundResource.listPage(config);
		const listed = await PlaygroundResource.list('docs');
		expect(listed.length).toBeGreaterThan(0);
		expect(page.bytes).toBe(measurePlaygroundResourceBytes(listed));
	});

	it('ignores blank aliases and keeps defaults when restore fails', async () => {
		expect(await PlaygroundResource.set('docs', '  ', 'https://cdn.example.com/vue.js', 'import')).toBeNull();
		expect(await PlaygroundResource.set('docs', 'vue', '  ', 'import')).toBeNull();
		expect(await PlaygroundResource.set('docs', '', 'https://cdn.example.com/vue.js', 'import')).toBeNull();
		expect(getPlaygroundImportMapOverrides()).toEqual({});
		expect(await PlaygroundResource.list('docs')).toEqual([]);

		setPlaygroundImportMapOverrides({ vue: 'https://cdn.example.com/vue.js' });
		setPlaygroundStyleOverrides({
			'@deot/style/dist/index.css': 'https://cdn.example.com/index.css'
		});
		setPlaygroundSiteModules({ 'site-lib': 'https://cdn.example.com/site-lib.js' });
		const spy = vi.spyOn(PlaygroundResourceCache.prototype, 'list')
			.mockRejectedValueOnce(new Error('IndexedDB blocked'));
		try {
			const stop = await PlaygroundResource.start({
				locales: { 'zh-CN': { label: '简体中文' } },
				routes: {},
				namespace: 'docs',
				modules: { 'site-lib': 'https://cdn.example.com/site-lib.js' },
				styles: { '@my/ui/dist/index.css': '/assets/ui.css' }
			});
			expect(getPlaygroundSiteModules()).toEqual({});
			expect(getPlaygroundSiteStyles()).toEqual({});
			expect(getPlaygroundImportMapOverrides()).toEqual({});
			expect(getPlaygroundStyleOverrides()).toEqual({});
			stop();
		} finally {
			spy.mockRestore();
		}
	});

	it('filters invalid rows and ignores stale start/stop sessions', async () => {
		const cache = new PlaygroundResourceCache();
		await cache.set('docs', 'vue', 'https://cdn.example.com/vue.js', 'import');
		const store = (cache as unknown as {
			store: {
				set: (id: string, value: unknown) => Promise<void>;
			};
		}).store;
		await store.set('docs|broken', { id: 'docs|broken', namespace: 'docs' });
		await store.set('docs|null', null);
		expect((await cache.list('docs')).map(item => item.alias)).toEqual(['vue']);

		const records = [{
			id: 'docs|import|vue',
			namespace: 'docs',
			alias: 'vue',
			url: 'https://cdn.example.com/vue-v2.js',
			kind: 'import' as const,
			updatedAt: 2
		}];
		let resolveFirst!: (value: typeof records) => void;
		let rejectThird!: (error: Error) => void;
		const firstList = new Promise<typeof records>((resolve) => {
			resolveFirst = resolve;
		});
		const thirdList = new Promise<typeof records>((_resolve, reject) => {
			rejectThird = reject;
		});
		const spy = vi.spyOn(PlaygroundResourceCache.prototype, 'list')
			.mockImplementationOnce(() => firstList)
			.mockResolvedValueOnce(records)
			.mockImplementationOnce(() => thirdList)
			.mockResolvedValueOnce(records);

		try {
			const firstStart = PlaygroundResource.start({
				locales: { 'zh-CN': { label: '简体中文' } },
				routes: {},
				namespace: 'docs'
			});
			const secondStop = await PlaygroundResource.start({
				locales: { 'zh-CN': { label: '简体中文' } },
				routes: {},
				namespace: 'docs'
			});
			expect(getPlaygroundImportMapOverrides()).toEqual({
				vue: 'https://cdn.example.com/vue-v2.js'
			});

			resolveFirst([{
				id: 'docs|import|vue',
				namespace: 'docs',
				alias: 'vue',
				url: 'https://cdn.example.com/vue-stale.js',
				kind: 'import',
				updatedAt: 1
			}]);
			const firstStop = await firstStart;
			expect(getPlaygroundImportMapOverrides()).toEqual({
				vue: 'https://cdn.example.com/vue-v2.js'
			});
			firstStop();
			expect(getPlaygroundImportMapOverrides()).toEqual({
				vue: 'https://cdn.example.com/vue-v2.js'
			});

			const failedStart = PlaygroundResource.start({
				locales: { 'zh-CN': { label: '简体中文' } },
				routes: {},
				namespace: 'docs'
			});
			const newerStop = await PlaygroundResource.start({
				locales: { 'zh-CN': { label: '简体中文' } },
				routes: {},
				namespace: 'docs'
			});
			rejectThird(new Error('late failure'));
			await failedStart;
			expect(getPlaygroundImportMapOverrides()).toEqual({
				vue: 'https://cdn.example.com/vue-v2.js'
			});
			newerStop();
			secondStop();
		} finally {
			spy.mockRestore();
		}
	});

	it('probes urls on save/prefetch and persists default status in idb', async () => {
		const fetchMock = vi.fn(async (url: RequestInfo | URL) => {
			const href = String(url);
			if (href.includes('fail')) {
				return { ok: false, status: 500 } as Response;
			}
			return { ok: true, status: 200 } as Response;
		});
		vi.stubGlobal('fetch', fetchMock);
		const statusSpy = vi.fn();
		const unsubscribe = PlaygroundResource.subscribeStatus(statusSpy);

		try {
			const config = {
				locales: { 'zh-CN': { label: '简体中文' } },
				routes: {},
				namespace: 'docs',
				modules: { 'site-lib': 'https://cdn.example.com/site-lib.js' }
			};
			await PlaygroundResource.start(config);

			await PlaygroundResource.save(
				'docs',
				'vue',
				'https://cdn.example.com/vue.js',
				'import'
			);
			expect(getPlaygroundImportMapOverrides().vue).toBe('https://cdn.example.com/vue.js');
			const overridden = (await PlaygroundResource.list('docs'))
				.find(item => item.alias === 'vue');
			expect(overridden?.requestStatus).toBe('success');
			expect(overridden?.checkedAt).toEqual(expect.any(Number));

			const rows = await listRows(config);
			const defaultRow = rows.find(item => item.alias === 'site-lib');
			expect(defaultRow?.overridden).toBe(false);
			expect(defaultRow?.requestStatus).toBe('waiting');

			const summary = await PlaygroundResource.prefetch('docs', [
				{
					kind: 'import',
					alias: 'site-lib',
					defaultUrl: 'https://cdn.example.com/site-lib.js',
					currentUrl: 'https://cdn.example.com/site-lib-fail.js',
					overridden: false,
					requestStatus: 'waiting'
				},
				{
					kind: 'import',
					alias: 'vue',
					defaultUrl: '',
					currentUrl: 'https://cdn.example.com/vue.js',
					overridden: true,
					requestStatus: 'success'
				}
			]);
			expect(summary).toEqual({ total: 2, fulfilled: 1, rejected: 1 });
			const afterPrefetch = await listRows(config);
			expect(afterPrefetch.find(item => item.alias === 'site-lib')).toEqual(
				expect.objectContaining({
					overridden: false,
					requestStatus: 'error',
					reason: 'HTTP 500'
				})
			);
			expect((await PlaygroundResource.list('docs')).find(item => item.alias === 'site-lib'))
				.toEqual(expect.objectContaining({
					url: 'https://cdn.example.com/site-lib.js',
					source: 'default',
					requestStatus: 'error',
					reason: 'HTTP 500'
				}));
			expect(statusSpy).toHaveBeenCalled();
		} finally {
			unsubscribe();
			vi.unstubAllGlobals();
		}
	});

	it('retries write failures and re-probes probe failures', async () => {
		const fetchMock = vi.fn(async () => ({ ok: true, status: 200 } as Response));
		vi.stubGlobal('fetch', fetchMock);
		const setSpy = vi.spyOn(PlaygroundResourceCache.prototype, 'set')
			.mockRejectedValueOnce(new Error('idb write failed'));
		try {
			await expect(PlaygroundResource.save(
				'docs',
				'vue',
				'https://cdn.example.com/vue.js',
				'import'
			)).rejects.toThrow('idb write failed');

			const failedRows = await listRows({
				locales: { 'zh-CN': { label: '简体中文' } },
				routes: {},
				namespace: 'docs'
			});
			const failed = failedRows.find(item => item.alias === 'vue')!;
			expect(failed.requestStatus).toBe('error');
			expect(failed.overridden).toBe(false);

			await PlaygroundResource.retry('docs', failed);
			expect(getPlaygroundImportMapOverrides().vue).toBe('https://cdn.example.com/vue.js');

			fetchMock.mockResolvedValueOnce({ ok: false, status: 404 } as Response);
			await PlaygroundResource.prefetch('docs', [{
				kind: 'import',
				alias: 'vue',
				defaultUrl: '',
				currentUrl: 'https://cdn.example.com/vue.js',
				overridden: true,
				requestStatus: 'success',
				lastAction: 'save'
			}]);
			const probeFailed = (await listRows({
				locales: { 'zh-CN': { label: '简体中文' } },
				routes: {},
				namespace: 'docs'
			})).find(item => item.alias === 'vue')!;
			expect(probeFailed.requestStatus).toBe('error');
			expect(probeFailed.overridden).toBe(true);

			fetchMock.mockResolvedValueOnce({ ok: true, status: 200 } as Response);
			const saveCallsBefore = setSpy.mock.calls.length;
			await PlaygroundResource.retry('docs', probeFailed);
			// 探测失败只重探测，不再次写入覆盖。
			expect(setSpy.mock.calls.length).toBe(saveCallsBefore);
			expect((await PlaygroundResource.list('docs')).find(item => item.alias === 'vue')?.requestStatus)
				.toBe('success');
		} finally {
			setSpy.mockRestore();
			vi.unstubAllGlobals();
		}
	});

	it('stores alias and url on the raw IndexedDB object', async () => {
		const fetchMock = vi.fn(async () => ({ ok: true, status: 200 } as Response));
		vi.stubGlobal('fetch', fetchMock);
		try {
			await PlaygroundResource.save(
				'docs',
				'vue',
				'https://cdn.example.com/vue.js',
				'import'
			);
			const raw = await new Promise<Array<Record<string, unknown>>>((resolve, reject) => {
				const request = indexedDB.open('deot-docs-playground-resource', 1);
				request.onerror = () => reject(request.error);
				request.onsuccess = () => {
					const db = request.result;
					const rows: Array<Record<string, unknown>> = [];
					const cursor = db.transaction('resources').objectStore('resources').openCursor();
					cursor.onerror = () => {
						db.close();
						reject(cursor.error);
					};
					cursor.onsuccess = () => {
						const current = cursor.result;
						if (current) {
							rows.push(current.value as Record<string, unknown>);
							current.continue();
							return;
						}
						db.close();
						resolve(rows);
					};
				};
			});
			expect(raw).toEqual([expect.objectContaining({
				__id: 'docs|import|vue',
				alias: 'vue',
				url: 'https://cdn.example.com/vue.js',
				kind: 'import',
				source: 'override',
				namespace: 'docs'
			})]);
		} finally {
			vi.unstubAllGlobals();
		}
	});

	it('rejects unsafe urls and clears overrides with session status', async () => {
		const fetchMock = vi.fn();
		vi.stubGlobal('fetch', fetchMock);
		try {
			await PlaygroundResource.save('docs', 'vue', 'javascript:alert(1)', 'import');
			const listed = await PlaygroundResource.list('docs');
			expect(listed[0]).toEqual(expect.objectContaining({
				alias: 'vue',
				url: 'javascript:alert(1)',
				requestStatus: 'error',
				reason: 'Unsafe URL'
			}));
			expect(fetchMock).not.toHaveBeenCalled();
			expect(getPlaygroundImportMapOverrides().vue).toBeUndefined();

			await PlaygroundResource.start({
				locales: { 'zh-CN': { label: '简体中文' } },
				routes: {},
				namespace: 'docs'
			});
			expect(getPlaygroundImportMapOverrides().vue).toBeUndefined();

			await PlaygroundResource.clear('docs');
			expect(await PlaygroundResource.list('docs')).toEqual([]);
			expect(getPlaygroundImportMapOverrides()).toEqual({});
		} finally {
			vi.unstubAllGlobals();
		}
	});

	it('retries failed reset writes and surfaces non-error reset failures', async () => {
		const fetchMock = vi.fn(async () => ({ ok: true, status: 200 } as Response));
		vi.stubGlobal('fetch', fetchMock);
		await PlaygroundResource.save(
			'docs',
			'vue',
			'https://cdn.example.com/vue.js',
			'import'
		);
		const setSpy = vi.spyOn(PlaygroundResourceCache.prototype, 'set')
			.mockRejectedValueOnce('reset blocked');
		try {
			await expect(PlaygroundResource.reset(
				'docs',
				'vue',
				'import',
				'https://cdn.example.com/vue-default.js'
			)).rejects.toBe('reset blocked');

			const failed = (await listRows({
				locales: { 'zh-CN': { label: '简体中文' } },
				routes: {},
				namespace: 'docs'
			})).find(item => item.alias === 'vue')!;
			expect(failed).toEqual(expect.objectContaining({
				overridden: true,
				requestStatus: 'error',
				lastAction: 'reset',
				reason: 'Rollback failed'
			}));

			await PlaygroundResource.retry('docs', failed);
			expect(getPlaygroundImportMapOverrides().vue).toBeUndefined();
		} finally {
			setSpy.mockRestore();
			vi.unstubAllGlobals();
		}
	});

	it('probes relative urls, network errors and style overrides', async () => {
		const fetchMock = vi.fn(async (url: RequestInfo | URL) => {
			if (String(url).includes('network')) throw new Error('offline');
			if (String(url).includes('throw-string')) throw 'boom';
			return { ok: true, status: 200 } as Response;
		});
		vi.stubGlobal('fetch', fetchMock);
		const badListener = () => {
			throw new Error('listener failed');
		};
		const unsubscribe = PlaygroundResource.subscribeStatus(badListener);
		try {
			await PlaygroundResource.save(
				'docs',
				'@deot/style/dist/index.css',
				'/local/index.css',
				'style'
			);
			expect(getPlaygroundStyleOverrides()['@deot/style/dist/index.css']).toBe('/local/index.css');
			expect((await PlaygroundResource.list('docs'))[0]?.requestStatus).toBe('success');

			const config = {
				locales: { 'zh-CN': { label: '简体中文' } },
				routes: {},
				namespace: 'docs'
			};
			const vue = (await listRows(config)).find(item => item.alias === 'vue')!;
			await PlaygroundResource.prefetch('docs', [{
				...vue,
				currentUrl: 'https://cdn.example.com/network.js'
			}]);
			expect((await listRows(config)).find(item => item.alias === 'vue')?.reason)
				.toBe('offline');

			await PlaygroundResource.prefetch('docs', [{
				...vue,
				currentUrl: 'https://cdn.example.com/throw-string.js'
			}]);
			expect((await listRows(config)).find(item => item.alias === 'vue')?.reason)
				.toBe('Probe failed');
		} finally {
			unsubscribe();
			vi.unstubAllGlobals();
		}
	});
});
