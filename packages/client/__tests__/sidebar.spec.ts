import {
	findSidebarNeighbors,
	findSidebarSection,
	findSidebarTrail,
	flattenSidebarPages,
	isSidebarItemActive
} from '../src/utils/sidebar';
import type { SidebarItem } from '../src/types';

const items: SidebarItem[] = [
	{ label: 'Introduction', value: '/packages/guide' },
	{
		label: 'Packages',
		children: [
			{ label: 'Client', value: '/packages/client' },
			{ label: 'CLI', value: '/packages/cli' }
		]
	},
	{
		label: 'Guide',
		value: '/guide',
		children: [{ label: 'Install', value: '/guide/install' }]
	}
];

describe('sidebar trail helpers', () => {
	it('matches localized sidebar values and ignores external links', () => {
		expect(isSidebarItemActive('/zh-CN/packages/client', 'zh-CN', '/packages/client')).toBe(true);
		expect(isSidebarItemActive('/zh-CN/packages/client/extra', 'zh-CN', '/packages/client')).toBe(true);
		expect(isSidebarItemActive('/zh-CN/packages/cli', 'zh-CN', '/packages/client')).toBe(false);
		expect(isSidebarItemActive('/zh-CN/packages/client', 'zh-CN', 'https://example.com')).toBe(false);
	});

	it('returns the trail from a section group to the current page', () => {
		expect(findSidebarTrail(items, '/zh-CN/packages/client', 'zh-CN').map(item => item.label))
			.toEqual(['Packages', 'Client']);
		expect(findSidebarSection(items, '/zh-CN/packages/client', 'zh-CN')?.label).toBe('Packages');
	});

	it('uses a linked parent as the section when the group itself has a value', () => {
		expect(findSidebarTrail(items, '/zh-CN/guide/install', 'zh-CN').map(item => item.label))
			.toEqual(['Guide', 'Install']);
		expect(findSidebarSection(items, '/zh-CN/guide/install', 'zh-CN')?.label).toBe('Guide');
	});

	it('hides the section eyebrow for top-level pages without a parent', () => {
		expect(findSidebarTrail(items, '/zh-CN/packages/guide', 'zh-CN').map(item => item.label))
			.toEqual(['Introduction']);
		expect(findSidebarSection(items, '/zh-CN/packages/guide', 'zh-CN')).toBeUndefined();
		expect(findSidebarSection(items, '/zh-CN/missing', 'zh-CN')).toBeUndefined();
	});

	it('walks sidebar pages in order and returns previous and next neighbors', () => {
		expect(flattenSidebarPages(items).map(item => item.label))
			.toEqual(['Introduction', 'Client', 'CLI', 'Guide', 'Install']);
		expect(findSidebarNeighbors(items, '/zh-CN/packages/client', 'zh-CN')).toEqual({
			previous: expect.objectContaining({ label: 'Introduction' }),
			next: expect.objectContaining({ label: 'CLI' })
		});
		expect(findSidebarNeighbors(items, '/zh-CN/packages/guide', 'zh-CN').previous).toBeUndefined();
		expect(findSidebarNeighbors(items, '/zh-CN/guide/install', 'zh-CN').next).toBeUndefined();
		expect(findSidebarNeighbors(items, '/zh-CN/missing', 'zh-CN')).toEqual({});
	});
});
