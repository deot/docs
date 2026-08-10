// @vitest-environment jsdom

import { flushPromises, mount } from '@vue/test-utils';
import Paging, { PagingFake } from '../src/components/paging';
import type { PagingFilterModule, PagingKeywords } from '../src/components/paging';

vi.mock('@deot/vc', async () => {
	const { createVcStubs } = await import('./fixtures/vc');
	return createVcStubs();
});

interface Row {
	id: number;
	title: string;
	type: string;
}

const modules: PagingFilterModule[] = [
	{ type: 'input', field: 'title', label: 'Title' },
	{
		type: 'select',
		field: 'type',
		label: 'Type',
		data: [
			{ label: 'Alpha', value: 'alpha' },
			{ label: 'Beta', value: 'beta' }
		]
	},
	{ type: 'date-picker', field: 'createdAt', label: 'Created' },
	{ type: 'range', field: ['min', 'max'], label: 'Score' }
];
const rows: Row[] = Array.from({ length: 15 }, (_, id) => ({
	id,
	title: `Item ${id}`,
	type: id % 2 ? 'beta' : 'alpha'
}));
const filter = (row: Row, keywords: PagingKeywords) => (
	(!keywords.title || row.title.includes(String(keywords.title)))
	&& (!keywords.type || row.type === keywords.type)
);
const createLoadData = () => vi.fn(async (
	_page: number,
	_pageSize: number,
	keywords: PagingKeywords
) => rows.filter(row => filter(row, keywords)));
let loadData: ReturnType<typeof createLoadData>;
const createWrapper = () => {
	loadData = createLoadData();
	return mount(Paging<Row>, {
		props: { loadData, filterModules: modules },
		slots: { default: () => <span class="column">Columns</span> }
	});
};

const click = async (wrapper: ReturnType<typeof createWrapper>, label: string) => {
	const button = wrapper.findAll('button').find(item => item.text().trim() === label);
	expect(button, `${label} button`).toBeTruthy();
	await button!.trigger('click');
	await flushPromises();
};

describe('paging', () => {
	it('renders local pages and handles page and page-size changes', async () => {
		const wrapper = createWrapper();
		await flushPromises();
		expect(wrapper.find('.table').text()).toContain('0,1,2,3,4,5,6,7,8,9');
		expect(loadData).toHaveBeenLastCalledWith(1, 10, {});

		await wrapper.find('[data-page="2"]').trigger('click');
		await flushPromises();
		expect(wrapper.find('.table').text()).toContain('10,11,12,13,14');
		expect(loadData).toHaveBeenLastCalledWith(2, 10, {});

		await wrapper.find('[data-page-size="20"]').trigger('click');
		await flushPromises();
		expect(wrapper.find('.table').text()).toContain('0,1,2,3,4,5,6,7,8,9,10,11,12,13,14');
		expect(loadData).toHaveBeenLastCalledWith(1, 20, {});
	});

	it('affixes the table header and pagination when enabled', async () => {
		const wrapper = mount(Paging<Row>, {
			props: { loadData: createLoadData(), affix: true }
		});
		await flushPromises();

		expect(wrapper.find('.table').attributes('data-affix')).toContain(
			'[{"disabled":false,"placement":"top","offset":0},false]'
		);
		expect(wrapper.find('[data-placement="bottom"]').attributes('data-disabled')).toBe('false');
		wrapper.vm.refreshAffix();
	});

	it('supports input and select filters with search and reset', async () => {
		const wrapper = createWrapper();
		await wrapper.find('[data-filter="title"]').setValue('Item 1');
		await click(wrapper, 'Search');
		expect(wrapper.find('.table').text()).toContain('1,10,11,12,13,14');

		await wrapper.find('[data-filter="type"]').setValue('alpha');
		await flushPromises();
		expect(wrapper.find('.table').text()).toContain('10,12,14');

		await click(wrapper, 'Reset');
		expect(wrapper.find('.table').text()).toContain('0,1,2,3,4,5,6,7,8,9');
	});

	it('drops values for filter modules removed at runtime', async () => {
		const wrapper = createWrapper();
		await wrapper.find('[data-filter="title"]').setValue('Item 1');
		await wrapper.find('[data-filter="type"]').setValue('beta');
		await flushPromises();
		expect(loadData).toHaveBeenLastCalledWith(1, 10, {
			title: 'Item 1',
			type: 'beta',
			createdAt: undefined,
			min: undefined,
			max: undefined
		});

		await wrapper.setProps({ filterModules: modules.filter(module => module.field !== 'type') });
		await flushPromises();
		await click(wrapper, 'Search');

		expect(loadData).toHaveBeenLastCalledWith(1, 10, {
			title: 'Item 1',
			createdAt: undefined,
			min: undefined,
			max: undefined
		});
	});

	it('collects date-picker and numeric range values', async () => {
		const wrapper = createWrapper();
		await wrapper.find('[data-filter="createdAt"]').setValue('2026-08-10');
		await wrapper.find('[data-filter="min"]').setValue('10');
		await wrapper.find('[data-filter="max"]').setValue('20');
		await click(wrapper, 'Search');

		const searches = wrapper.emitted('search');
		expect(searches).toBeTruthy();
		expect(searches!.at(-1)?.[0]).toMatchObject({
			createdAt: '2026-08-10',
			min: 10,
			max: 20
		});
	});

	it('adapts static data through PagingFake', async () => {
		const wrapper = mount(PagingFake<Row>, {
			props: { data: rows, filterModules: modules, filter },
			slots: { default: () => <span class="column">Columns</span> }
		});
		await flushPromises();
		expect(wrapper.find('.table').text()).toContain('0,1,2,3,4,5,6,7,8,9');
		expect(wrapper.find('.column').exists()).toBe(true);

		await wrapper.find('[data-filter="type"]').setValue('beta');
		await flushPromises();
		expect(wrapper.find('.table').text()).toContain('1,3,5,7,9,11,13');

		await wrapper.setProps({ data: rows.slice(0, 3) });
		await flushPromises();
		expect(wrapper.find('.table').text()).toContain('1');
		expect(wrapper.find('.table').text()).not.toContain('3');
		expect(wrapper.vm.getData()).toHaveLength(1);
		await wrapper.vm.reset(true);
		await wrapper.vm.load();
	});

	it('normalizes server paging and wrapped list responses', async () => {
		const serverLoad = vi.fn(async () => ({
			records: rows.slice(3, 5),
			current: 2,
			pages: 8,
			total: 15
		}));
		const wrapper = mount(Paging<Row>, {
			props: { loadData: serverLoad },
			slots: { default: () => <span>Columns</span> }
		});
		await flushPromises();
		expect(wrapper.find('.table').text()).toContain('3,4');
		expect(wrapper.find('.pagination').text()).toContain('2/15/10');
		expect(wrapper.find('.docs-paging__pagination-control').exists()).toBe(true);
		expect(wrapper.vm.getData()).toEqual(rows.slice(3, 5));

		await wrapper.setProps({
			loadData: async () => ({
				data: {
					list: rows.slice(5, 7),
					page: { current: 3, total: 8, count: 15 }
				}
			})
		});
		await wrapper.vm.load();
		await flushPromises();
		expect(wrapper.find('.table').text()).toContain('5,6');
		expect(wrapper.find('.pagination').text()).toContain('3/15/10');
	});

	it('forwards fake table and footer slots', async () => {
		const wrapper = mount(PagingFake<Row>, {
			props: { data: [] },
			slots: {
				'default': () => <span class="column">Columns</span>,
				'empty': () => <span class="empty">Empty</span>,
				'append': () => <span class="append">Append</span>,
				'footer-extra': () => <span class="footer-extra">Extra</span>
			}
		});
		await flushPromises();
		expect(wrapper.find('.column').exists()).toBe(true);
		expect(wrapper.find('.empty').exists()).toBe(true);
		expect(wrapper.find('.append').exists()).toBe(true);
		expect(wrapper.find('.footer-extra').exists()).toBe(true);
	});

	it('emits load errors for invalid or rejected results', async () => {
		const wrapper = mount(Paging<Row>, {
			props: { loadData: async () => ({ invalid: true }) as never }
		});
		await flushPromises();
		expect(wrapper.emitted('load-error')?.[0]?.[0]).toBeInstanceOf(TypeError);
		expect(wrapper.emitted('loading-change')).toEqual([[true], [false]]);

		await wrapper.setProps({ loadData: async () => Promise.reject(new Error('Load failed')) });
		await wrapper.vm.load();
		expect(wrapper.emitted('load-error')?.at(-1)?.[0]).toEqual(new Error('Load failed'));
	});
});
