// @vitest-environment jsdom

import * as api from '../src/pages/playground-resource/api';
import type { PlaygroundResourceRow } from '../src/modules/playground-resource';

const {
	listPage,
	save,
	reset,
	clear,
	prefetch,
	retry,
	subscribeStatus
} = vi.hoisted(() => ({
	listPage: vi.fn(async (): Promise<{
		rows: import('../src/modules/playground-resource').PlaygroundResourceRow[];
		bytes: number;
	}> => ({ rows: [], bytes: 0 })),
	save: vi.fn(async () => null),
	reset: vi.fn(async () => undefined),
	clear: vi.fn(async () => undefined),
	prefetch: vi.fn(async () => ({ total: 0, fulfilled: 0, rejected: 0 })),
	retry: vi.fn(async () => null),
	subscribeStatus: vi.fn(() => () => undefined)
}));

vi.mock('../src/modules/playground-resource', () => ({
	PlaygroundResource: {
		listPage,
		save,
		reset,
		clear,
		prefetch,
		retry,
		subscribeStatus
	}
}));

describe('playground resource page api', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		window.$docs = {
			locales: { 'zh-CN': { label: '简体中文' } },
			routes: {},
			namespace: 'docs'
		};
	});

	it('delegates list save reset clear prefetch retry and subscribe', async () => {
		const row: PlaygroundResourceRow = {
			kind: 'import',
			alias: 'vue',
			defaultUrl: 'https://cdn.example.com/vue-default.js',
			currentUrl: 'https://cdn.example.com/vue.js',
			overridden: true,
			requestStatus: 'waiting'
		};
		listPage.mockResolvedValueOnce({ rows: [row], bytes: 256 });
		expect(await api.getPage()).toEqual({ rows: [row], bytes: 256 });
		expect(listPage).toHaveBeenCalledWith(window.$docs);

		await api.save(row, 'https://cdn.example.com/vue-next.js');
		expect(save).toHaveBeenCalledWith(
			'docs',
			'vue',
			'https://cdn.example.com/vue-next.js',
			'import',
			'https://cdn.example.com/vue-default.js'
		);

		await api.reset(row);
		expect(reset).toHaveBeenCalledWith(
			'docs',
			'vue',
			'import',
			'https://cdn.example.com/vue-default.js'
		);

		await api.clear();
		expect(clear).toHaveBeenCalledWith('docs');

		await api.prefetch([row]);
		expect(prefetch).toHaveBeenCalledWith('docs', [row]);

		await api.retry(row);
		expect(retry).toHaveBeenCalledWith('docs', row);

		const listener = vi.fn();
		api.subscribeStatus(listener);
		expect(subscribeStatus).toHaveBeenCalledWith(listener);
	});
});
