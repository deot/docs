// @vitest-environment jsdom

import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { reactive } from 'vue';
import DocsSearch from '../src/components/search/trigger.vue';

const {
	history,
	getPreparedCount,
	listHistory,
	prepare,
	push,
	query,
	record,
	removeHistory,
	statusState,
	subscribeStatus,
	togglePinned
} = vi.hoisted(() => ({
	history: [{
		id: 'history',
		namespace: 'docs',
		lang: 'zh-CN',
		path: '/zh-CN/guide',
		hash: '#install',
		title: 'Guide',
		sectionTitle: 'Install',
		pinned: false,
		visitedAt: 1
	}],
	getPreparedCount: vi.fn(),
	listHistory: vi.fn(),
	prepare: vi.fn(),
	push: vi.fn(),
	query: vi.fn(),
	record: vi.fn(),
	removeHistory: vi.fn(),
	statusState: { listener: undefined as undefined | ((record: any) => void) },
	subscribeStatus: vi.fn(),
	togglePinned: vi.fn()
}));

const route = reactive({ params: { lang: 'zh-CN' } });

vi.mock('../src/modules/search', () => ({
	Search: {
		getPreparedCount,
		listHistory,
		prepare,
		query,
		record,
		removeHistory,
		togglePinned
	}
}));

vi.mock('../src/modules', () => ({
	Gateway: { subscribeStatus }
}));

vi.mock('vue-router', async original => ({
	...await original<typeof import('vue-router')>(),
	useRoute: () => route,
	useRouter: () => ({ push })
}));

vi.mock('@deot/vc', async () => {
	const { createVcStubs } = await import('./fixtures/vc');
	return createVcStubs();
});

enableAutoUnmount(afterEach);

const resultItems = [{
	id: 'document',
	kind: 'document' as const,
	namespace: 'docs',
	lang: 'zh-CN',
	path: '/zh-CN/table',
	hash: '',
	title: 'Table',
	source: './table.md',
	excerpt: 'Table component',
	score: 1000
}, {
	id: 'section',
	kind: 'section' as const,
	namespace: 'docs',
	lang: 'zh-CN',
	path: '/zh-CN/table',
	hash: '#basic-table',
	title: 'Table',
	sectionTitle: 'Basic table',
	source: './table.md',
	excerpt: 'Basic table example',
	score: 600
}];

const dispatch = (element: Element, event: Event) => element.dispatchEvent(event);
const openSearch = async (wrapper: ReturnType<typeof mount>) => {
	await wrapper.get('.docs-search-trigger').trigger('click');
	await flushPromises();
};

describe('DocsSearch', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.clearAllMocks();
		window.$docs = { namespace: 'docs', locales: { 'zh-CN': { label: '简体中文' } }, routes: {} };
		listHistory.mockResolvedValue(history);
		prepare.mockResolvedValue(1);
		getPreparedCount.mockReturnValue(1);
		query.mockResolvedValue(resultItems);
		record.mockResolvedValue(true);
		removeHistory.mockResolvedValue(undefined);
		togglePinned.mockResolvedValue(undefined);
		statusState.listener = undefined;
		subscribeStatus.mockImplementation((listener) => {
			statusState.listener = listener;
			return vi.fn();
		});
		push.mockResolvedValue(undefined);
	});

	afterEach(() => {
		vi.useRealTimers();
		document.body.innerHTML = '';
	});

	it('opens with history and supports pin and remove without navigation', async () => {
		const wrapper = mount(DocsSearch, { attachTo: document.body });
		await openSearch(wrapper);

		expect(document.querySelector('.docs-search')).not.toBeNull();
		expect(document.body.textContent).toContain('Recent');
		expect(document.body.textContent).toContain('Install');
		expect(document.activeElement).toBe(document.querySelector('.docs-search__input'));

		dispatch(
			document.querySelector('[aria-label="Pin history"]')!,
			new MouseEvent('click', { bubbles: true })
		);
		await flushPromises();
		expect(togglePinned).toHaveBeenCalledWith('history');
		expect(push).not.toHaveBeenCalled();

		dispatch(
			document.querySelector('[aria-label="Remove history"]')!,
			new MouseEvent('click', { bubbles: true })
		);
		await flushPromises();
		expect(removeHistory).toHaveBeenCalledWith('history');
		expect(push).not.toHaveBeenCalled();
	});

	it('debounces queries, loops keyboard selection and navigates the selected anchor', async () => {
		const wrapper = mount(DocsSearch, { attachTo: document.body });
		await openSearch(wrapper);
		const input = document.querySelector<HTMLInputElement>('.docs-search__input')!;
		input.value = 'table';
		dispatch(input, new InputEvent('input', { bubbles: true }));
		await vi.advanceTimersByTimeAsync(80);
		await flushPromises();

		expect(query).toHaveBeenCalledWith('zh-CN', 'table');
		expect(document.querySelectorAll('.docs-search__result')).toHaveLength(2);
		dispatch(input, new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
		await flushPromises();
		dispatch(input, new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
		await flushPromises();
		dispatch(input, new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
		await flushPromises();
		dispatch(input, new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
		await flushPromises();

		expect(record).toHaveBeenCalledWith(resultItems[1]);
		expect(push).toHaveBeenCalledWith({ path: '/zh-CN/table', hash: '#basic-table' });
		expect(document.querySelector('.docs-search')).toBeNull();
		expect(document.activeElement).toBe(wrapper.get('.docs-search-trigger').element);
	});

	it('ignores Enter during IME composition and closes with Escape', async () => {
		const wrapper = mount(DocsSearch, { attachTo: document.body });
		await openSearch(wrapper);
		const input = document.querySelector<HTMLInputElement>('.docs-search__input')!;
		dispatch(input, new CompositionEvent('compositionstart', { bubbles: true }));
		dispatch(input, new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
		await flushPromises();
		expect(push).not.toHaveBeenCalled();
		dispatch(input, new CompositionEvent('compositionend', { bubbles: true }));
		await vi.advanceTimersByTimeAsync(80);

		dispatch(input, new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		await flushPromises();
		expect(document.querySelector('.docs-search')).toBeNull();
	});

	it('does not restore an obsolete open session after preparation finishes', async () => {
		let resolvePrepare: ((value: number) => void) | undefined;
		prepare.mockImplementationOnce(() => new Promise<number>((resolve) => {
			resolvePrepare = resolve;
		}));
		const wrapper = mount(DocsSearch, { attachTo: document.body });
		await wrapper.get('.docs-search-trigger').trigger('click');
		await flushPromises();
		await document.querySelector<HTMLButtonElement>('.docs-search__close')?.click();
		resolvePrepare?.(1);
		await flushPromises();

		expect(document.querySelector('.docs-search')).toBeNull();
		expect(subscribeStatus).not.toHaveBeenCalled();
	});

	it('refreshes after successful Gateway updates and supports clear and mouse selection', async () => {
		const wrapper = mount(DocsSearch, { attachTo: document.body });
		await openSearch(wrapper);
		const input = document.querySelector<HTMLInputElement>('.docs-search__input')!;
		input.value = 'table';
		dispatch(input, new InputEvent('input', { bubbles: true }));
		await vi.advanceTimersByTimeAsync(80);
		await flushPromises();

		dispatch(
			document.querySelectorAll('.docs-search__result')[1],
			new MouseEvent('mouseenter', { bubbles: true })
		);
		statusState.listener?.({
			identity: { lang: 'en-US', type: 'markdown' },
			requestStatus: 'success'
		});
		statusState.listener?.({
			identity: { lang: 'zh-CN', type: 'sidebar' },
			requestStatus: 'success'
		});
		statusState.listener?.({
			identity: { lang: 'zh-CN', type: 'markdown' },
			requestStatus: 'success'
		});
		await vi.advanceTimersByTimeAsync(80);
		await flushPromises();
		expect(query).toHaveBeenCalledTimes(2);

		dispatch(
			document.querySelector('.docs-search__clear')!,
			new MouseEvent('click', { bubbles: true })
		);
		await flushPromises();
		expect((input as HTMLInputElement).value).toBe('');
		expect(document.body.textContent).toContain('Recent');
	});

	it('clears an in-flight query without leaving the dialog in loading state', async () => {
		let resolveQuery: ((value: typeof resultItems) => void) | undefined;
		query.mockImplementationOnce(() => new Promise((resolve) => {
			resolveQuery = resolve;
		}));
		const wrapper = mount(DocsSearch, { attachTo: document.body });
		await openSearch(wrapper);
		const input = document.querySelector<HTMLInputElement>('.docs-search__input')!;
		input.value = 'table';
		dispatch(input, new InputEvent('input', { bubbles: true }));
		await vi.advanceTimersByTimeAsync(80);
		expect(document.body.textContent).toContain('Searching…');

		dispatch(
			document.querySelector('.docs-search__clear')!,
			new MouseEvent('click', { bubbles: true })
		);
		await flushPromises();
		expect(document.body.textContent).toContain('Recent');
		expect(document.body.textContent).not.toContain('Searching…');

		resolveQuery?.(resultItems);
		await flushPromises();
		expect(document.body.textContent).toContain('Recent');
		expect(document.querySelectorAll('.docs-search__result')).toHaveLength(0);
	});

	it('refreshes the cached document count after background updates', async () => {
		prepare.mockResolvedValueOnce(0);
		getPreparedCount.mockReturnValue(2);
		query.mockResolvedValue([]);
		const wrapper = mount(DocsSearch, { attachTo: document.body });
		await openSearch(wrapper);
		const input = document.querySelector<HTMLInputElement>('.docs-search__input')!;
		input.value = 'missing';
		dispatch(input, new InputEvent('input', { bubbles: true }));
		await vi.advanceTimersByTimeAsync(80);
		await flushPromises();

		expect(document.body.textContent).toContain('No results found.');
		expect(document.body.textContent).not.toContain('No cached documents yet.');
	});

	it('shows storage and query failures without breaking navigation', async () => {
		listHistory.mockRejectedValueOnce('history failed');
		prepare.mockRejectedValueOnce(new Error('prepare failed'));
		const wrapper = mount(DocsSearch, { attachTo: document.body });
		await openSearch(wrapper);
		expect(document.body.textContent).toContain('Unable to load search history.');

		query.mockRejectedValueOnce('query failed');
		const input = document.querySelector<HTMLInputElement>('.docs-search__input')!;
		input.value = 'failed';
		dispatch(input, new InputEvent('input', { bubbles: true }));
		await vi.advanceTimersByTimeAsync(80);
		await flushPromises();
		expect(document.body.textContent).toContain('Unable to search cached documents.');

		query.mockResolvedValueOnce(resultItems);
		input.value = 'table';
		dispatch(input, new InputEvent('input', { bubbles: true }));
		await vi.advanceTimersByTimeAsync(80);
		await flushPromises();
		record.mockRejectedValueOnce(new Error('history unavailable'));
		dispatch(
			document.querySelector('.docs-search__result')!,
			new MouseEvent('click', { bubbles: true })
		);
		await flushPromises();
		expect(push).toHaveBeenCalled();
	});
});
