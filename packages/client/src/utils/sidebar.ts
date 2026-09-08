import { getDefaultLanguage } from './resolver';
import { localizeRoutePath } from './route';
import type { DocsConfig, DocsSidebar, SidebarItem } from '../types';

export const findLanguageValue = <T>(
	items: Record<string, T>,
	language: string
): T | undefined => {
	const normalized = language.replace(/_/g, '-').toLowerCase();
	const key = Object.keys(items).find(candidate => (
		candidate.replace(/_/g, '-').toLowerCase() === normalized
	));
	return key ? items[key] : undefined;
};

/**
 * 解析直接写入路由的 Sidebar 数据。数组对所有语言生效；语言映射优先取
 * 当前 lang，缺失时回退到站点默认语言。字符串仍交给原有 Gateway 流程。
 * @param sidebar 路由声明的 Sidebar 配置。
 * @param lang 当前文档语言。
 * @param config 当前站点配置。
 * @returns 可直接渲染的条目；资源型配置返回 null。
 */
export const resolveInlineSidebar = (
	sidebar: DocsSidebar | undefined,
	lang: string,
	config: DocsConfig
): SidebarItem[] | null => {
	if (Array.isArray(sidebar)) return sidebar;
	if (!sidebar || typeof sidebar !== 'object') return null;
	return findLanguageValue(sidebar, lang)
		|| findLanguageValue(sidebar, getDefaultLanguage(config))
		|| null;
};

const isExternalSidebarValue = (value: string) => (
	/^[a-z][a-z\d+.-]*:/i.test(value) || value.startsWith('//')
);

/**
 * 判断当前路由是否命中 Sidebar 条目（含语言前缀，允许前缀子路径）。
 * @param routePath 当前路由路径。
 * @param lang 当前文档语言。
 * @param value Sidebar 条目的目标路径。
 * @returns 是否视为当前页或其子路径。
 */
export const isSidebarItemActive = (routePath: string, lang: string, value: string) => {
	if (isExternalSidebarValue(value)) return false;
	const target = localizeRoutePath(lang, value);
	return routePath === target || routePath.startsWith(`${target}/`);
};

/**
 * 从根到当前文档的 Sidebar 路径，用于页眉分组与后续面包屑。
 * @param items Sidebar 根条目。
 * @param routePath 当前路由路径。
 * @param lang 当前文档语言。
 * @returns 从根到当前文档的条目链。
 */
export const findSidebarTrail = (
	items: SidebarItem[],
	routePath: string,
	lang: string
): SidebarItem[] => {
	for (const item of items) {
		if (item.children?.length) {
			const nested = findSidebarTrail(item.children, routePath, lang);
			if (nested.length) return [item, ...nested];
		}
		if (item.value && isSidebarItemActive(routePath, lang, item.value)) {
			return [item];
		}
	}
	return [];
};

/**
 * 当前文档所属的 Sidebar 分组（无 value 的祖先，或非叶子的直接父级）。
 * @param items Sidebar 根条目。
 * @param routePath 当前路由路径。
 * @param lang 当前文档语言。
 * @returns 最近的分组条目；没有分组时为空。
 */
export const findSidebarSection = (
	items: SidebarItem[],
	routePath: string,
	lang: string
): SidebarItem | undefined => {
	const trail = findSidebarTrail(items, routePath, lang);
	if (trail.length < 2) return;
	return [...trail.slice(0, -1)].reverse().find(item => !item.value) || trail[0];
};

/**
 * 按侧栏深度优先顺序收集可导航文档页（跳过外链与纯分组）。
 * @param items Sidebar 根条目。
 * @returns 可导航文档页列表。
 */
export const flattenSidebarPages = (items: SidebarItem[]): SidebarItem[] => {
	const pages: SidebarItem[] = [];
	const walk = (nodes: SidebarItem[]) => {
		for (const item of nodes) {
			if (item.value && !isExternalSidebarValue(item.value)) pages.push(item);
			if (item.children?.length) walk(item.children);
		}
	};
	walk(items);
	return pages;
};

/**
 * 当前文档在侧栏中的上一篇 / 下一篇。
 * @param items Sidebar 根条目。
 * @param routePath 当前路由路径。
 * @param lang 当前文档语言。
 * @returns 相邻文档；位于端点时对应方向为空。
 */
export const findSidebarNeighbors = (
	items: SidebarItem[],
	routePath: string,
	lang: string
): { previous?: SidebarItem; next?: SidebarItem } => {
	const pages = flattenSidebarPages(items);
	const index = pages.findIndex(item => (
		Boolean(item.value) && localizeRoutePath(lang, item.value as string) === routePath
	));
	if (index < 0) return {};
	return {
		previous: index > 0 ? pages[index - 1] : undefined,
		next: index < pages.length - 1 ? pages[index + 1] : undefined
	};
};
