// @vitest-environment jsdom

import { flushPromises, mount } from '@vue/test-utils';
import PlaygroundResourcePage from '../src/pages/playground-resource/index.vue';
import type { PlaygroundResourceRow } from '../src/modules/playground-resource';
import { SourceEditor } from '../src/pages/playground-resource/components/portal';

const {
	getPage,
	save,
	reset,
	clear,
	prefetch,
	retry,
	subscribeStatus,
	statusListeners,
	messageSuccess,
	messageError,
	messageInfo,
	routerBack,
	routerPush,
	row
} = vi.hoisted(() => {
	const fixture: PlaygroundResourceRow = {
		kind: 'import',
		alias: 'vue',
		defaultUrl: 'https://cdn.example.com/vue-default.js',
		currentUrl: 'https://cdn.example.com/vue.js',
		overridden: true,
		requestStatus: 'success',
		updatedAt: 1,
		checkedAt: 2,
		lastAction: 'save'
	};
	const listeners = new Set<() => void>();
	return {
		row: fixture,
		getPage: vi.fn(async () => ({ rows: [{ ...fixture }], bytes: 128 })),
		save: vi.fn(async () => undefined),
		reset: vi.fn(async () => undefined),
		clear: vi.fn(async () => undefined),
		prefetch: vi.fn(async () => ({ total: 1, fulfilled: 1, rejected: 0 })),
		retry: vi.fn(async () => null),
		subscribeStatus: vi.fn((listener: () => void) => {
			listeners.add(listener);
			return () => listeners.delete(listener);
		}),
		statusListeners: listeners,
		messageSuccess: vi.fn(),
		messageError: vi.fn(),
		messageInfo: vi.fn(),
		routerBack: vi.fn(),
		routerPush: vi.fn()
	};
});

vi.mock('vue-router', async original => ({
	...await original<typeof import('vue-router')>(),
	useRoute: () => ({ params: { lang: 'zh-CN' } }),
	useRouter: () => ({ back: routerBack, push: routerPush })
}));

vi.mock('../src/pages/playground-resource/api', () => ({
	getPage,
	save,
	reset,
	clear,
	prefetch,
	retry,
	subscribeStatus
}));

vi.mock('@deot/vc', async () => {
	const { createVcStubs } = await import('./fixtures/vc');
	return createVcStubs({
		message: {
			success: messageSuccess,
			error: messageError,
			info: messageInfo
		}
	});
});

const click = async (wrapper: ReturnType<typeof mount>, label: string) => {
	const button = wrapper.findAll('button').find(item => item.text().trim() === label);
	expect(button, `${label} button`).toBeTruthy();
	await button!.trigger('click');
	await flushPromises();
};

const clickAction = async (wrapper: ReturnType<typeof mount>, label: string) => {
	const button = wrapper.find('[data-column="Actions"]')
		.findAll('button')
		.find(item => item.text().trim() === label);
	expect(button, `action ${label}`).toBeTruthy();
	await button!.trigger('click');
	await flushPromises();
};

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

describe('playground resource page', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		statusListeners.clear();
		SourceEditor.destroy();
		window.$docs = {
			locales: { 'zh-CN': { label: '简体中文' } },
			routes: {},
			namespace: 'docs',
			modules: { 'extra-lib': 'https://cdn.example.com/extra.js' }
		};
		getPage.mockResolvedValue({ rows: [{ ...row }], bytes: 128 });
		save.mockResolvedValue(undefined);
		reset.mockResolvedValue(undefined);
		clear.mockResolvedValue(undefined);
		prefetch.mockResolvedValue({ total: 1, fulfilled: 1, rejected: 0 });
		retry.mockResolvedValue(null);
		subscribeStatus.mockImplementation((listener: () => void) => {
			statusListeners.add(listener);
			return () => statusListeners.delete(listener);
		});
	});

	afterEach(() => {
		SourceEditor.destroy();
	});

	it('lists rows with paging toolbar and navigates', async () => {
		const wrapper = mount(PlaygroundResourcePage);
		await flushPromises();

		expect(wrapper.find('h1').text()).toContain('Playground Resource');
		expect(wrapper.find('.docs-playground-resource__header p').text())
			.toContain('1 entries · docs cache 128 B');
		expect(wrapper.text()).toContain('vue');
		expect(wrapper.find('.pagination').text()).toContain('1/1/20');
		expect(wrapper.find('[data-column="Current URL"]').text())
			.toContain('https://cdn.example.com/vue.js');
		expect(wrapper.find('.docs-tag[data-type="success"]').text()).toBe('SUCCESS');

		const labels = ['Back', 'Home', 'Columns', 'Refresh', 'Prefetch', 'Clear'];
		const buttons = wrapper.find('.docs-playground-resource__toolbar').findAll('button')
			.filter(button => labels.includes(button.text().trim()));
		expect(buttons.map(button => button.text().trim())).toEqual(labels);
		expect(buttons.slice(0, 5).every(button => button.attributes('data-type') === 'primary')).toBe(true);
		expect(buttons.at(-1)!.attributes('data-type')).toBe('error');

		await click(wrapper, 'Back');
		expect(routerBack).toHaveBeenCalledOnce();
		await click(wrapper, 'Home');
		expect(routerPush).toHaveBeenCalledWith('/zh-CN');
	});

	it('formats stored cache size in KB and MB', async () => {
		getPage.mockResolvedValueOnce({ rows: [{ ...row }], bytes: 2048 });
		const kbWrapper = mount(PlaygroundResourcePage);
		await flushPromises();
		expect(kbWrapper.find('.docs-playground-resource__header p').text())
			.toContain('2.0 KB');
		kbWrapper.unmount();

		getPage.mockResolvedValueOnce({ rows: [{ ...row }], bytes: 1024 * 1024 });
		const mbWrapper = mount(PlaygroundResourcePage);
		await flushPromises();
		expect(mbWrapper.find('.docs-playground-resource__header p').text())
			.toContain('1.0 MB');
		mbWrapper.unmount();
	});

	it('filters by alias kind override and request status', async () => {
		getPage.mockResolvedValue({
			rows: [
				{ ...row },
				{
					...row,
					alias: 'lodash-es',
					kind: 'style' as const,
					overridden: false,
					requestStatus: 'error' as const,
					reason: 'HTTP 404',
					currentUrl: 'https://cdn.example.com/lodash.css'
				}
			],
			bytes: 128
		});
		const wrapper = mount(PlaygroundResourcePage);
		await flushPromises();

		await wrapper.find('[data-filter="alias"]').setValue('lodash');
		await click(wrapper, 'Search');
		expect(wrapper.find('[data-column="Name"]').text()).toContain('lodash-es');
		expect(wrapper.find('[data-column="Name"]').text()).not.toContain('vue');

		await wrapper.find('[data-filter="alias"]').setValue('');
		await click(wrapper, 'Search');

		await wrapper.find('[data-filter="kind"]').setValue('style');
		await flushPromises();
		expect(wrapper.find('[data-column="Name"]').text()).toContain('lodash-es');
		expect(wrapper.find('[data-column="Name"]').text()).not.toContain('vue');

		await wrapper.find('[data-filter="kind"]').setValue('');
		await wrapper.find('[data-filter="overridden"]').setValue('0');
		await flushPromises();
		expect(wrapper.find('[data-column="Name"]').text()).toContain('lodash-es');

		await wrapper.find('[data-filter="overridden"]').setValue('');
		await wrapper.find('[data-filter="requestStatus"]').setValue('error');
		await flushPromises();
		expect(wrapper.find('.docs-tag[data-type="error"]').text()).toBe('ERROR');
		expect(wrapper.text()).toContain('HTTP 404');
	});

	it('toggles optional columns', async () => {
		const wrapper = mount(PlaygroundResourcePage);
		await flushPromises();
		expect(wrapper.find('[data-column="Default URL"]').exists()).toBe(false);
		await wrapper.find('[data-column-toggle="Default URL"]').trigger('click');
		await flushPromises();
		expect(wrapper.find('[data-column="Default URL"]').text())
			.toContain('https://cdn.example.com/vue-default.js');
		await wrapper.find('[data-column-toggle="Updated"]').trigger('click');
		await wrapper.find('[data-column-toggle="Checked"]').trigger('click');
		await flushPromises();
		expect(wrapper.find('[data-column="Updated"]').exists()).toBe(true);
		expect(wrapper.find('[data-column="Checked"]').exists()).toBe(true);
		await wrapper.find('[data-column-toggle="Updated"]').trigger('click');
		await flushPromises();
		expect(wrapper.find('[data-column="Updated"]').exists()).toBe(false);
	});

	it('refreshes clears and prefetches rows', async () => {
		const wrapper = mount(PlaygroundResourcePage);
		await flushPromises();

		await click(wrapper, 'Refresh');
		expect(messageSuccess).toHaveBeenCalledWith('Refreshed');

		await click(wrapper, 'Clear');
		expect(clear).toHaveBeenCalledOnce();
		expect(messageSuccess).toHaveBeenCalledWith('Cleared overrides');

		await click(wrapper, 'Prefetch');
		expect(prefetch).toHaveBeenCalledWith([expect.objectContaining({ alias: 'vue' })]);
		expect(messageSuccess).toHaveBeenCalledWith('Prefetched 1 entries');

		prefetch.mockResolvedValueOnce({ total: 2, fulfilled: 1, rejected: 1 });
		await click(wrapper, 'Prefetch');
		expect(messageError).toHaveBeenCalledWith('Prefetch: 1 succeeded, 1 failed');
	});

	it('rolls back and retries error rows', async () => {
		getPage.mockResolvedValue({
			rows: [{
				...row,
				requestStatus: 'error',
				reason: 'Probe failed'
			}],
			bytes: 128
		});
		const wrapper = mount(PlaygroundResourcePage);
		await flushPromises();

		await clickAction(wrapper, 'Rollback');
		expect(reset).toHaveBeenCalledWith(expect.objectContaining({ alias: 'vue' }));
		expect(messageSuccess).toHaveBeenCalledWith('vue rolled back');

		await clickAction(wrapper, 'Retry');
		expect(retry).toHaveBeenCalledWith(expect.objectContaining({ alias: 'vue' }));
		expect(messageSuccess).toHaveBeenCalledWith('vue retried');
	});

	it('edits url through portal confirm and cancel', async () => {
		const wrapper = mount(PlaygroundResourcePage);
		await flushPromises();

		await clickAction(wrapper, 'Edit');
		expect(document.body.querySelector('.modal')).toBeTruthy();
		const textarea = document.body.querySelector('textarea') as HTMLTextAreaElement;
		expect(textarea.value).toBe('https://cdn.example.com/vue.js');
		textarea.value = 'https://cdn.example.com/vue-next.js';
		textarea.dispatchEvent(new Event('input'));
		await flushPromises();
		(document.body.querySelector('[data-modal="ok"]') as HTMLButtonElement).click();
		await flushPromises();
		expect(save).toHaveBeenCalledWith(
			expect.objectContaining({ alias: 'vue' }),
			'https://cdn.example.com/vue-next.js'
		);
		expect(messageSuccess).toHaveBeenCalledWith('vue saved');

		await clickAction(wrapper, 'Edit');
		const empty = document.body.querySelector('textarea') as HTMLTextAreaElement;
		empty.value = '   \n  ';
		empty.dispatchEvent(new Event('input'));
		await flushPromises();
		save.mockClear();
		(document.body.querySelector('[data-modal="ok"]') as HTMLButtonElement).click();
		await flushPromises();
		expect(save).not.toHaveBeenCalled();
		expect(document.body.querySelector('.modal')).toBeTruthy();

		(document.body.querySelector('[data-modal="cancel"]') as HTMLButtonElement).click();
		await flushPromises();
		expect(document.body.querySelector('.modal')).toBeFalsy();
		wrapper.unmount();
	});

	it('prompts when rolling back a default row', async () => {
		getPage.mockResolvedValue({ rows: [{ ...row, overridden: false }], bytes: 128 });
		const wrapper = mount(PlaygroundResourcePage);
		await flushPromises();

		const button = wrapper.find('[data-column="Actions"]')
			.findAll('button')
			.find(item => item.text().trim() === 'Rollback')!;
		expect(button.attributes('disabled')).toBeUndefined();
		await clickAction(wrapper, 'Rollback');
		expect(reset).not.toHaveBeenCalled();
		expect(messageInfo).toHaveBeenCalledWith('Already using the default URL');
	});

	it('edits style rows and ignores empty confirms', async () => {
		getPage.mockResolvedValue({
			rows: [{
				...row,
				kind: 'style',
				alias: '@deot/style/dist/index.css',
				defaultUrl: 'https://cdn.example.com/index.css',
				currentUrl: 'https://cdn.example.com/index.css',
				overridden: false,
				requestStatus: 'waiting'
			}],
			bytes: 128
		});
		const wrapper = mount(PlaygroundResourcePage);
		await flushPromises();
		await clickAction(wrapper, 'Edit');
		expect(document.body.textContent).toContain('CSS');
		const textarea = document.body.querySelector('textarea') as HTMLTextAreaElement;
		textarea.value = '';
		textarea.dispatchEvent(new Event('input'));
		await flushPromises();
		(document.body.querySelector('[data-modal="ok"]') as HTMLButtonElement).click();
		await flushPromises();
		expect(save).not.toHaveBeenCalled();
		(document.body.querySelector('[data-modal="cancel"]') as HTMLButtonElement).click();
		await flushPromises();
		(document.body.querySelector('[data-modal="cancel"]') as HTMLButtonElement | null)?.click();
		wrapper.unmount();
	});

	it('surfaces load save reset prefetch and retry failures', async () => {
		getPage.mockRejectedValueOnce(new Error('boom'));
		const wrapper = mount(PlaygroundResourcePage);
		await flushPromises();
		expect(messageError).toHaveBeenCalledWith('boom');

		getPage.mockResolvedValue({ rows: [{ ...row, requestStatus: 'error' }], bytes: 128 });
		await click(wrapper, 'Refresh');
		messageError.mockClear();

		save.mockRejectedValueOnce(new Error('save failed'));
		await clickAction(wrapper, 'Edit');
		(document.body.querySelector('[data-modal="ok"]') as HTMLButtonElement).click();
		await flushPromises();
		expect(messageError).toHaveBeenCalledWith('save failed');

		messageError.mockClear();
		reset.mockRejectedValueOnce(new Error('rollback failed'));
		await clickAction(wrapper, 'Rollback');
		expect(messageError).toHaveBeenCalledWith('rollback failed');

		messageError.mockClear();
		retry.mockRejectedValueOnce(new Error('retry failed'));
		await clickAction(wrapper, 'Retry');
		expect(messageError).toHaveBeenCalledWith('retry failed');

		messageError.mockClear();
		prefetch.mockRejectedValueOnce(new Error('prefetch failed'));
		await click(wrapper, 'Prefetch');
		expect(messageError).toHaveBeenCalledWith('prefetch failed');
	});

	it('keeps controls disabled until overlapping status refresh settles', async () => {
		vi.useFakeTimers();
		try {
			const wrapper = mount(PlaygroundResourcePage);
			await vi.runAllTimersAsync();
			await flushPromises();
			const clearRequest = createDeferred<undefined>();
			const statusRequest = createDeferred<{ rows: PlaygroundResourceRow[]; bytes: number }>();
			clear.mockImplementationOnce(() => clearRequest.promise);
			getPage.mockImplementationOnce(() => statusRequest.promise);
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
			expect(refreshButton.element).toHaveProperty('disabled', true);

			statusRequest.resolve({ rows: [{ ...row }], bytes: 128 });
			await flushPromises();
			expect(refreshButton.element).toHaveProperty('disabled', false);
		} finally {
			vi.useRealTimers();
		}
	});
});
