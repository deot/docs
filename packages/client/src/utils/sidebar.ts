import { getDefaultLanguage } from './resolver';
import type { DocsConfig, DocsSidebar, SidebarItem } from '../types';

const findLanguageItems = (
	items: Record<string, SidebarItem[]>,
	language: string
) => {
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
	return findLanguageItems(sidebar, lang)
		|| findLanguageItems(sidebar, getDefaultLanguage(config))
		|| null;
};
