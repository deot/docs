// @vitest-environment jsdom

import { flushPromises, mount } from '@vue/test-utils';
import DatabasePage from '../src/pages/db/index.vue';
import type { ResourceContentRecord } from '../src/modules';
import type { ResourceIdentity } from '../src/types';
import { ResourcePlan } from '../src/modules/resource-plan';
import { getList as getDatabaseList } from '../src/pages/db/api';

const {
	list,
	revalidate,
	prefetch,
	gatewayPrune,
	invalidate,
	clear,
	subscribeStatus,
	statusListeners,
	messageSuccess,
	messageError,
	routerBack,
	routerPush,
	record
} = vi.hoisted(() => {
	const fixture = {
		identity: {
			namespace: 'docs',
			lang: 'zh-CN',
			type: 'markdown',
			source: './guide.md'
		},
		url: '/site/zh-CN/guide.md',
		status: 'success' as 'waiting' | 'pending' | 'success' | 'error',
		requestStatus: 'success' as 'waiting' | 'pending' | 'success' | 'error',
		requestStatusUpdatedAt: 3,
		statusHistory: [{
			id: 'attempt-1',
			status: 'success' as const,
			createdAt: 1,
			completedAt: 1
		}],
		contentHistoryId: 'attempt-1',
		contentHistoryIndex: 0,
		content: '# Guide' as string | undefined,
		hash: 'abc123' as string | undefined,
		updatedAt: 1 as number | undefined,
		checkedAt: 2,
		accessedAt: 3
	};
	const listeners = new Set<() => void>();
	return {
		record: fixture,
		list: vi.fn(async () => [fixture]),
		revalidate: vi.fn(async () => fixture),
		prefetch: vi.fn(async (identities: unknown[]) => (
			identities.map(value => ({ status: 'fulfilled', value }))
		)),
		gatewayPrune: vi.fn(async (
			_namespace: string,
			_identities: unknown[]
		): Promise<unknown[]> => {
			void _namespace;
			void _identities;
			return [];
		}),
		invalidate: vi.fn(async () => undefined),
		clear: vi.fn(async () => undefined),
		subscribeStatus: vi.fn((listener: () => void) => {
			listeners.add(listener);
			return () => listeners.delete(listener);
		}),
		statusListeners: listeners,
		messageSuccess: vi.fn(),
		messageError: vi.fn(),
		routerBack: vi.fn(),
		routerPush: vi.fn()
	};
});

vi.mock('vue-router', async original => ({
	...await original<any>(),
	useRoute: () => ({ params: { lang: 'zh-CN' } }),
	useRouter: () => ({ back: routerBack, push: routerPush })
}));

vi.mock('../src/modules', () => ({
	Gateway: {
		list,
		revalidate,
		prefetch,
		prune: gatewayPrune,
		invalidate,
		clear,
		subscribeStatus
	}
}));
vi.mock('../src/modules/gateway', () => ({
	Gateway: {
		list,
		prefetch
	}
}));
vi.mock('@deot/vc', async () => {
	const { createVcStubs } = await import('./fixtures/vc');
	return createVcStubs({
		message: {
			success: messageSuccess,
			error: messageError
		}
	});
});

const click = async (wrapper: ReturnType<typeof mount>, label: string) => {
	const button = wrapper.findAll('button').find(item => item.text().trim() === label);
	expect(button, `${label} button`).toBeTruthy();
	await button!.trigger('click');
	await flushPromises();
};
const getFixtureSize = () => new TextEncoder().encode(JSON.stringify(record)).length;

/**
 * 创建可手动结束的 Promise，用于断言请求生命周期重叠的场景。
 * @returns Promise 及其外部 resolve/reject 控制函数。
 */
function createDeferred<T>() {
	let resolve!: (value: T | PromiseLike<T>) => void;
	let reject!: (reason?: unknown) => void;
	const promise = new Promise<T>((resolvePromise, rejectPromise) => {
		resolve = resolvePromise;
		reject = rejectPromise;
	});
	return { promise, resolve, reject };
}

describe('database page', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		statusListeners.clear();
		window.$docs = {
			locales: { 'zh-CN': { label: '简体中文' } },
			routes: {},
			base: 'https://docs.example.com/',
			namespace: 'docs'
		};
		list.mockResolvedValue([record]);
		revalidate.mockResolvedValue(record);
		prefetch.mockImplementation(async identities => (
			identities.map((value: unknown) => ({ status: 'fulfilled', value }))
		));
		gatewayPrune.mockResolvedValue([]);
	});

	it('shows IndexedDB records and supports record operations', async () => {
		const wrapper = mount(DatabasePage);
		await flushPromises();
		expect(wrapper.text()).toContain('deot-docs / resources · 1 records');
		expect(wrapper.find('.pagination').text()).toContain('1/1/20');
		expect(wrapper.find('.table').attributes('data-affix')).toContain(
			'[{"disabled":false,"placement":"top","offset":0},false]'
		);
		expect(wrapper.find('[data-placement="bottom"]').attributes('data-disabled')).toBe('false');
		expect(wrapper.find('[data-column="URL"]').text()).toContain('/site/zh-CN/guide.md');
		expect(wrapper.find('.docs-database__header p').text())
			.toContain(`docs cache ${getFixtureSize()} B`);

		await click(wrapper, 'Back');
		expect(routerBack).toHaveBeenCalledOnce();
		await click(wrapper, 'Home');
		expect(routerPush).toHaveBeenCalledWith('/zh-CN');

		await click(wrapper, 'Update');
		expect(revalidate).toHaveBeenCalledWith(record.identity, {
			url: record.url,
			priority: 100
		});
		expect(messageSuccess).toHaveBeenCalledWith('./guide.md updated');

		await click(wrapper, 'Delete');
		expect(invalidate).toHaveBeenCalledWith(record.identity);
		expect(messageSuccess).toHaveBeenCalledWith('./guide.md deleted');
	});

	it('shows 20 rows by default and applies the 50-row page size', async () => {
		const manyRecords = Array.from({ length: 55 }, (_, index) => ({
			...record,
			identity: {
				...record.identity,
				source: `./guide-${index}.md`
			},
			url: `/site/zh-CN/guide-${index}.md`
		}));
		list.mockResolvedValue(manyRecords);
		const wrapper = mount(DatabasePage);
		await flushPromises();

		expect(wrapper.findAll('[data-column="URL"] > div')).toHaveLength(20);
		expect(wrapper.find('.pagination').text()).toContain('1/55/20');

		await wrapper.find('[data-page-size="50"]').trigger('click');
		await flushPromises();

		expect(wrapper.findAll('[data-column="URL"] > div')).toHaveLength(50);
		expect(wrapper.find('.pagination').text()).toContain('1/55/50');
	});

	it('keeps destructive actions at the far right and highlights other tools', async () => {
		const wrapper = mount(DatabasePage);
		await flushPromises();
		const labels = [
			'Back',
			'Home',
			'Columns',
			'Refresh',
			'Update all',
			'Prefetch',
			'Clear',
			'Prune'
		];
		const buttons = wrapper.find('.docs-database__toolbar').findAll('button')
			.filter(button => labels.includes(button.text().trim()));

		expect(buttons.map(button => button.text().trim())).toEqual(labels);
		expect(buttons.slice(0, 6).every(button => (
			button.attributes('data-type') === 'primary'
		))).toBe(true);
		expect(buttons.slice(6).every(button => (
			button.attributes('data-type') === 'error'
		))).toBe(true);
		expect(wrapper.find('.docs-database__toolbar-danger').text())
			.toContain('Clear');
		expect(wrapper.find('.docs-database__toolbar-danger').text())
			.toContain('Prune');
	});

	it('sums complete cached records only for the current namespace', async () => {
		list.mockResolvedValue([
			record,
			{
				...record,
				identity: { ...record.identity, namespace: 'other' },
				content: 'x'.repeat(2048)
			}
		]);
		const wrapper = mount(DatabasePage);
		await flushPromises();

		expect(wrapper.find('.docs-database__header p').text())
			.toContain(`2 records · docs cache ${getFixtureSize()} B`);
	});

	it('keeps controls disabled until overlapping refreshes have all settled', async () => {
		vi.useFakeTimers();
		try {
			const wrapper = mount(DatabasePage);
			await vi.runAllTimersAsync();
			await flushPromises();
			const clearRequest = createDeferred<undefined>();
			const statusRequest = createDeferred<typeof record[]>();
			clear.mockImplementationOnce(() => clearRequest.promise);
			list.mockImplementationOnce(() => statusRequest.promise);
			const clearButton = wrapper.findAll('button')
				.find(button => button.text().trim() === 'Clear')!;
			const refreshButton = wrapper.findAll('button')
				.find(button => button.text().trim() === 'Refresh')!;

			await clearButton.trigger('click');
			await flushPromises();
			expect(refreshButton.element).toHaveProperty('disabled', true);

			statusListeners.forEach(listener => listener());
			await vi.advanceTimersByTimeAsync(80);
			clearRequest.resolve(undefined);
			await flushPromises();
			// 工具栏操作已经完成，但与其重叠的状态刷新仍在进行。
			expect(refreshButton.element).toHaveProperty('disabled', true);

			statusRequest.resolve([record]);
			await flushPromises();
			expect(refreshButton.element).toHaveProperty('disabled', false);
		} finally {
			vi.useRealTimers();
		}
	});

	it('refreshes, reloads and clears all records', async () => {
		const wrapper = mount(DatabasePage);
		await flushPromises();

		await click(wrapper, 'Refresh');
		await click(wrapper, 'Update all');
		expect(revalidate).toHaveBeenCalledWith(record.identity, {
			url: record.url,
			priority: 50
		});
		await click(wrapper, 'Clear');
		expect(clear).toHaveBeenCalledOnce();
		expect(messageSuccess).toHaveBeenCalledWith('Cleared all');
	});

	it('prefetches configured resources and recursively discovered sidebar pages', async () => {
		window.$docs.routes = {
			'/:name': {
				content: 'default',
				sidebar: './sidebar.json'
			},
			'/demo': {
				content: './demo.vue'
			}
		};
		window.$docs.resolve = {
			markdown: async ({ value }) => `./${value}.md`
		};
		const sidebar = {
			...record,
			identity: {
				...record.identity,
				type: 'sidebar',
				source: './sidebar.json'
			},
			content: JSON.stringify([{
				label: 'Guide',
				value: '/guide',
				children: [{ label: 'Nested', value: '/nested' }]
			}])
		};
		list
			.mockResolvedValueOnce([record])
			.mockResolvedValueOnce([sidebar])
			.mockResolvedValue([sidebar]);
		const wrapper = mount(DatabasePage);
		await flushPromises();

		await click(wrapper, 'Prefetch');
		const sources = prefetch.mock.calls.flatMap(([identities]) => (
			(identities as Array<{ source: string }>).map(item => item.source)
		));
		expect(sources).toEqual(expect.arrayContaining([
			'./sidebar.json',
			'./demo.vue',
			'./guide.md',
			'./nested.md'
		]));
		expect(new Set(sources)).toHaveProperty('size', 4);
		expect(messageSuccess).toHaveBeenCalledWith('Prefetched 4');
	});

	it('sorts configured sidebar routes depth first and leaves garbage at the end', async () => {
		window.$docs.routes = {
			'/:name': {
				content: 'default',
				sidebar: './sidebar.json'
			}
		};
		const createRow = (source: string, type = 'markdown', accessedAt = 1) => ({
			...record,
			identity: { ...record.identity, source, type },
			url: `https://docs.example.com/zh-CN/${source.replace(/^\.\//, '')}`,
			accessedAt
		});
		const sidebar = {
			...createRow('./sidebar.json', 'sidebar'),
			content: JSON.stringify([{
				label: 'Parent',
				value: '/parent',
				children: [{
					label: 'Nested',
					value: '/nested',
					children: [{ label: 'Deep', value: '/deep' }]
				}, { label: 'Sibling', value: '/sibling' }]
			}])
		};
		list.mockResolvedValue([
			createRow('./garbage.md', 'markdown', 100),
			createRow('./sibling.md'),
			createRow('./deep.md'),
			sidebar,
			createRow('./parent.md'),
			createRow('./nested.md')
		]);

		const rows = await getDatabaseList();
		expect(rows.map(row => row.identity.source)).toEqual([
			'./sidebar.json',
			'./parent.md',
			'./nested.md',
			'./deep.md',
			'./sibling.md',
			'./garbage.md'
		]);
	});

	it('places resource dependencies immediately after their importer', async () => {
		window.$docs.routes = {
			'/demo': { content: './demo.vue' }
		};
		const createRow = (source: string, type: string, content: string) => ({
			...record,
			identity: { ...record.identity, source, type },
			url: `https://docs.example.com/zh-CN/${source.replace(/^\.\//, '')}`,
			content
		});
		list.mockResolvedValue([
			createRow('./b.ts', 'module', 'export default 2'),
			createRow('./deep.css', 'style', '.deep {}'),
			createRow('./demo.vue', 'sfc', '<script>import "./a.ts"; import "./b.ts";</script>'),
			createRow('./a.ts', 'module', 'import "./deep.css";')
		]);

		const rows = await getDatabaseList();
		expect(rows.map(row => row.identity.source)).toEqual([
			'./demo.vue',
			'./a.ts',
			'./deep.css',
			'./b.ts'
		]);
	});

	it('adds recursive SFC dependencies to the prefetch and prune graph', async () => {
		window.$docs.routes = {
			'/demo': { content: './demo.vue' }
		};
		const sfc = {
			...record,
			identity: { ...record.identity, type: 'sfc', source: './demo.vue' },
			url: 'https://docs.example.com/zh-CN/demo.vue',
			content: '<script src="./logic.ts"></script>'
		};
		const module = {
			...record,
			identity: { ...record.identity, type: 'module', source: './logic.ts' },
			url: 'https://docs.example.com/zh-CN/logic.ts',
			content: 'import "./theme.css"'
		};
		const style = {
			...record,
			identity: { ...record.identity, type: 'style', source: './theme.css' },
			url: 'https://docs.example.com/zh-CN/theme.css',
			content: '.demo { color: red; }'
		};
		list.mockResolvedValueOnce([record]).mockResolvedValue([sfc, module, style]);
		const wrapper = mount(DatabasePage);
		await flushPromises();

		await click(wrapper, 'Prefetch');
		const sources = prefetch.mock.calls.flatMap(([identities]) => (
			(identities as Array<{ source: string }>).map(item => item.source)
		));
		expect(sources).toEqual(['./demo.vue', './logic.ts', './theme.css']);
		expect(messageSuccess).toHaveBeenCalledWith('Prefetched 3');
	});

	it('loads graph descriptors before Markdown for automatic idle plans', async () => {
		const importedAgain = await import('../src/modules/resource-plan');
		expect(importedAgain.ResourcePlan).toBe(ResourcePlan);
		window.$docs.routes = {
			'/guide': { content: './guide.md' },
			'/demo': { content: './demo.vue' }
		};
		const sfc = {
			...record,
			identity: { ...record.identity, type: 'sfc', source: './demo.vue' },
			url: 'https://docs.example.com/zh-CN/demo.vue',
			content: '<template>demo</template>'
		};
		list.mockResolvedValue([sfc]);

		await ResourcePlan.build({
			config: window.$docs,
			graphFirst: true
		});

		expect(prefetch.mock.calls.map(([identities]) => (
			(identities as Array<{ source: string }>).map(item => item.source)
		))).toEqual([
			['./demo.vue'],
			['./guide.md']
		]);
	});

	it('rejects a strict plan when a discovered dependency is unavailable', async () => {
		window.$docs.routes = {
			'/demo': { content: './demo.vue' }
		};
		const sfc = {
			...record,
			identity: { ...record.identity, type: 'sfc' as const, source: './demo.vue' },
			url: 'https://docs.example.com/zh-CN/demo.vue',
			content: '<script src="./logic.ts"></script>'
		};
		list.mockResolvedValue([sfc]);
		const fulfilledValue: ResourceContentRecord = {
			...sfc,
			status: 'success',
			requestStatus: 'success',
			hash: 'sfc-hash',
			updatedAt: 1
		};
		const loadResources = vi.fn(async (
			identities: ResourceIdentity[]
		): Promise<PromiseSettledResult<ResourceContentRecord>[]> => (
			identities.map(identity => identity.source === './logic.ts'
				? { status: 'rejected' as const, reason: new Error('offline') }
				: { status: 'fulfilled' as const, value: fulfilledValue })
		));

		await expect(ResourcePlan.build({
			config: window.$docs,
			prefetchResources: loadResources,
			strict: true
		})).rejects.toThrow(
			'Cannot build a complete prefetch plan: dependency unavailable (./logic.ts)'
		);
	});

	it('reports partial prefetch failures and ignores invalid sidebar content', async () => {
		window.$docs.routes = {
			'/demo': {
				content: './demo.vue',
				sidebar: './sidebar.json'
			}
		};
		const invalidSidebar = {
			...record,
			identity: {
				...record.identity,
				type: 'sidebar',
				source: './sidebar.json'
			},
			content: 'invalid json'
		};
		list
			.mockResolvedValueOnce([record])
			.mockResolvedValueOnce([invalidSidebar])
			.mockResolvedValue([invalidSidebar]);
		prefetch.mockImplementationOnce(async identities => identities.map((value, index) => (
			index
				? { status: 'fulfilled', value }
				: { status: 'rejected', reason: new Error('offline'), value: undefined }
		)));
		const wrapper = mount(DatabasePage);
		await flushPromises();

		await click(wrapper, 'Prefetch');
		expect(messageError).toHaveBeenCalledWith('Prefetch: 1 ok, 1 failed');
	});

	it('prunes records outside the complete prefetch plan', async () => {
		window.$docs.routes = {
			'/:name': {
				content: 'default',
				sidebar: './sidebar.json'
			}
		};
		window.$docs.resolve = {
			markdown: ({ value }) => `./${value}.md`
		};
		const sidebar = {
			...record,
			identity: {
				...record.identity,
				type: 'sidebar',
				source: './sidebar.json'
			},
			content: JSON.stringify([{ label: 'Guide', value: '/guide' }])
		};
		list
			.mockResolvedValueOnce([record])
			.mockResolvedValueOnce([sidebar])
			.mockResolvedValue([sidebar]);
		gatewayPrune.mockResolvedValue([
			{ ...record, identity: { ...record.identity, source: './garbage-1.md' } },
			{ ...record, identity: { ...record.identity, source: './garbage-2.md' } }
		]);
		const wrapper = mount(DatabasePage);
		await flushPromises();

		await click(wrapper, 'Prune');
		const [namespace, identities] = gatewayPrune.mock.calls[0];
		expect(namespace).toBe('docs');
		expect((identities as Array<{ source: string }>).map(item => item.source))
			.toEqual(expect.arrayContaining(['./sidebar.json', './guide.md']));
		const downloadedSources = prefetch.mock.calls.flatMap(([batch]) => (
			(batch as Array<{ source: string }>).map(item => item.source)
		));
		expect(downloadedSources).toEqual(['./sidebar.json']);
		expect(messageSuccess).toHaveBeenCalledWith('Pruned 2');
	});

	it('retains configured Markdown during prune without downloading it', async () => {
		window.$docs.routes = {
			'/guide': { content: 'default' }
		};
		window.$docs.resolve = {
			markdown: ({ value }) => `./${value}.md`
		};
		const wrapper = mount(DatabasePage);
		await flushPromises();

		await click(wrapper, 'Prune');
		expect(prefetch).not.toHaveBeenCalled();
		const identities = gatewayPrune.mock.calls[0][1] as Array<{ source: string }>;
		expect(identities.map(item => item.source)).toEqual(['./guide.md']);
		expect(messageSuccess).toHaveBeenCalledWith('Pruned 0');
	});

	it('does not invent a Markdown resource for the built-in home', async () => {
		window.$docs.locales = {};
		window.$docs.routes = {};
		const wrapper = mount(DatabasePage);
		await flushPromises();

		await click(wrapper, 'Prune');
		expect(prefetch).not.toHaveBeenCalled();
		const identities = gatewayPrune.mock.calls[0][1] as Array<{
			lang: string;
			source: string;
		}>;
		expect(identities).toEqual([]);
	});

	it('refuses cleanup when dynamic Markdown routes cannot be enumerated', async () => {
		window.$docs.routes = {
			'/:name': { content: 'default' }
		};
		const wrapper = mount(DatabasePage);
		await flushPromises();

		await click(wrapper, 'Prune');
		expect(gatewayPrune).not.toHaveBeenCalled();
		expect(messageError).toHaveBeenCalledWith(
			'Cannot build a complete prefetch plan: dynamic routes require a sidebar resource'
		);
	});

	it('retains the destination of a sidebar route redirect', async () => {
		window.$docs.routes = {
			'/legacy/:name': to => `/components/${String(to.params.name)}`,
			'/components/:name': {
				content: 'default',
				sidebar: './sidebar.json'
			}
		};
		const sidebar = {
			...record,
			identity: {
				...record.identity,
				type: 'sidebar',
				source: './sidebar.json'
			},
			content: JSON.stringify([{ label: 'Guide', value: '/legacy/guide' }])
		};
		list.mockResolvedValueOnce([record]).mockResolvedValue([sidebar]);
		const wrapper = mount(DatabasePage);
		await flushPromises();

		await click(wrapper, 'Prune');
		const identities = gatewayPrune.mock.calls[0][1] as Array<{ source: string }>;
		expect(identities.map(item => item.source)).toEqual([
			'./sidebar.json',
			'./guide.md'
		]);
	});

	it('refuses cleanup when configured redirects form a cycle', async () => {
		window.$docs.routes = {
			'/old': '/new',
			'/new': '/old'
		};
		const wrapper = mount(DatabasePage);
		await flushPromises();

		await click(wrapper, 'Prune');
		expect(gatewayPrune).not.toHaveBeenCalled();
		expect(messageError).toHaveBeenCalledWith(
			'Cannot build a complete prefetch plan: redirect cycle (/old)'
		);
	});

	it('passes the localized route shape to custom Markdown resolvers', async () => {
		window.$docs.routes = {
			'/guide': { content: 'default' }
		};
		window.$docs.resolve = {
			markdown: ({ route }) => `.${route.path}.md`
		};
		const wrapper = mount(DatabasePage);
		await flushPromises();

		await click(wrapper, 'Prune');
		const identities = gatewayPrune.mock.calls[0][1] as Array<{ source: string }>;
		expect(identities.map(item => item.source)).toEqual([
			'./zh-CN/guide.md'
		]);
	});

	it('refuses garbage cleanup when a configured SFC is unavailable', async () => {
		window.$docs.routes = {
			'/demo': { content: './demo.vue' }
		};
		prefetch.mockResolvedValueOnce([{
			status: 'rejected',
			value: undefined
		}]);
		const wrapper = mount(DatabasePage);
		await flushPromises();

		await click(wrapper, 'Prune');
		expect(gatewayPrune).not.toHaveBeenCalled();
		expect(messageError).toHaveBeenCalledWith(
			'Cannot build a complete prefetch plan: configured resource unavailable (./demo.vue)'
		);
	});

	it('refuses garbage cleanup when a configured sidebar is invalid', async () => {
		window.$docs.routes = {
			'/:name': {
				content: 'default',
				sidebar: './sidebar.json'
			}
		};
		const invalidSidebar = {
			...record,
			identity: {
				...record.identity,
				type: 'sidebar',
				source: './sidebar.json'
			},
			content: 'invalid json'
		};
		list
			.mockResolvedValueOnce([record])
			.mockResolvedValue([invalidSidebar]);
		const wrapper = mount(DatabasePage);
		await flushPromises();

		await click(wrapper, 'Prune');
		expect(gatewayPrune).not.toHaveBeenCalled();
		expect(messageError).toHaveBeenCalledWith(
			'Cannot build a complete prefetch plan: sidebar unavailable or invalid'
		);
	});

	it('reports operation failures through Message.error', async () => {
		revalidate.mockRejectedValueOnce(new Error('Reload failed'));
		const wrapper = mount(DatabasePage);
		await flushPromises();

		await click(wrapper, 'Update');
		expect(messageError).toHaveBeenCalledWith('Reload failed');
	});

	it('reports list, toolbar and prefetch failures with contextual fallbacks', async () => {
		list.mockRejectedValueOnce('offline');
		const wrapper = mount(DatabasePage);
		await flushPromises();
		expect(messageError).toHaveBeenCalledWith('Load failed');

		list.mockResolvedValue([record]);
		await click(wrapper, 'Refresh');
		clear.mockRejectedValueOnce('offline');
		await click(wrapper, 'Clear');
		expect(messageError).toHaveBeenCalledWith('Operation failed');

		window.$docs.routes = { '/guide': { content: './guide.md' } };
		prefetch.mockRejectedValueOnce(new Error('Plan failed'));
		await click(wrapper, 'Prefetch');
		expect(messageError).toHaveBeenCalledWith('Plan failed');
	});

	it('filters by source, type and language', async () => {
		const rows = Array.from({ length: 12 }, (_, index) => ({
			...record,
			identity: {
				...record.identity,
				lang: index % 2 ? 'en-US' : 'zh-CN',
				type: index % 2 ? 'sfc' : 'markdown',
				source: `./guide-${index}.md`
			},
			url: `/guide-${index}.md`,
			accessedAt: index
		}));
		list.mockResolvedValue(rows);
		const wrapper = mount(DatabasePage);
		await flushPromises();
		await wrapper.find('[data-column-toggle="Source"]').trigger('click');

		expect(wrapper.find('.table').text()).toContain('./guide-11.md');
		expect(wrapper.find('.table').text()).toContain('./guide-0.md');

		await wrapper.find('[data-filter="type"]').setValue('markdown');
		await flushPromises();
		expect(wrapper.find('.table').text()).not.toContain('sfc');

		await wrapper.find('[data-filter="type"]').setValue('');
		await wrapper.find('[data-filter="language"]').setValue('en-US');
		await flushPromises();
		expect(wrapper.find('.table').text()).not.toContain('zh-CN');

		await wrapper.find('[data-filter="source"]').setValue('guide-3');
		await click(wrapper, 'Search');
		expect(wrapper.find('.table').text()).toContain('./guide-3.md');
		expect(wrapper.find('.table').text()).not.toContain('./guide-1.md');
	});

	it('shows content and request states independently and filters both', async () => {
		const failedRefresh = {
			...record,
			requestStatus: 'error' as const,
			reason: 'Network unavailable'
		};
		const waiting = {
			...record,
			identity: { ...record.identity, source: './waiting.md' },
			url: '/waiting.md',
			status: 'waiting' as const,
			requestStatus: 'waiting' as const,
			content: undefined,
			hash: undefined,
			updatedAt: undefined
		};
		const pending = {
			...waiting,
			identity: { ...record.identity, source: './pending.md' },
			url: '/pending.md',
			status: 'pending' as const,
			requestStatus: 'pending' as const
		};
		list.mockResolvedValue([failedRefresh, waiting, pending]);
		const wrapper = mount(DatabasePage);
		await flushPromises();
		await wrapper.find('[data-column-toggle="Content"]').trigger('click');

		expect(wrapper.text()).toContain('Network unavailable');
		expect(wrapper.find('[data-column="Content"]').text()).toContain('-');
		expect(wrapper.find('.docs-tag[data-type="success"]').text()).toBe('SUCCESS');
		expect(wrapper.find('.docs-tag[data-type="error"]').text()).toBe('ERROR');
		expect(wrapper.find('.docs-tag[data-type="waiting"]').text()).toBe('WAITING');
		expect(wrapper.find('.docs-tag[data-type="pending"]').text()).toBe('PENDING');
		const errorPopovers = wrapper.findAll('.popover[data-disabled="false"]');
		expect(errorPopovers.some(item => item.text().includes('Network unavailable'))).toBe(true);

		await wrapper.find('[data-filter="status"]').setValue('success');
		await flushPromises();
		expect(wrapper.find('.table').text()).toContain('/site/zh-CN/guide.md');
		expect(wrapper.find('.table').text()).not.toContain('/waiting.md');

		await wrapper.find('[data-filter="requestStatus"]').setValue('error');
		await flushPromises();
		expect(wrapper.find('.table').text()).toContain('Network unavailable');
	});

	it('keeps URL first and toggles optional columns that are hidden by default', async () => {
		const wrapper = mount(DatabasePage);
		await flushPromises();
		const getColumns = () => wrapper.findAll('[data-column]')
			.map(item => item.attributes('data-column'));

		expect(getColumns()[0]).toBe('URL');
		expect(getColumns()).not.toEqual(expect.arrayContaining([
			'Source', 'Namespace', 'Language', 'Type', 'Hash', 'Content'
		]));

		await wrapper.find('[data-column-toggle="Source"]').trigger('click');
		await wrapper.find('[data-column-toggle="Hash"]').trigger('click');
		expect(getColumns()[0]).toBe('URL');
		expect(getColumns()).toEqual(expect.arrayContaining(['Source', 'Hash']));

		await wrapper.find('[data-column-toggle="Source"]').trigger('click');
		expect(getColumns()).not.toContain('Source');
	});

	it('coalesces status notifications and stops refreshing after unmount', async () => {
		vi.useFakeTimers();
		const wrapper = mount(DatabasePage);
		await vi.runAllTimersAsync();
		await flushPromises();
		const initialCalls = list.mock.calls.length;

		statusListeners.forEach(listener => listener());
		statusListeners.forEach(listener => listener());
		await vi.advanceTimersByTimeAsync(79);
		expect(list).toHaveBeenCalledTimes(initialCalls);
		await vi.advanceTimersByTimeAsync(1);
		await flushPromises();
		expect(list).toHaveBeenCalledTimes(initialCalls + 1);

		statusListeners.forEach(listener => listener());
		wrapper.unmount();
		await vi.advanceTimersByTimeAsync(80);
		expect(list).toHaveBeenCalledTimes(initialCalls + 1);
		vi.useRealTimers();
	});
});
