import type { RouteLocationNormalized } from 'vue-router';
import type { Ref } from 'vue';
import type { DocsLocaleEntry } from '@deot/docs-locale';
import type { DocsTheme, DocsThemeOptions } from '@deot/docs-theme';

export type { DocsLocaleEntry, Language } from '@deot/docs-locale';
export type { DocsTheme, DocsThemeOptions, DocsThemePreference } from '@deot/docs-theme';

export type DocsResourceType = 'markdown' | 'sidebar' | 'sfc' | 'module' | 'style';

export interface DocsRuntime {
	mode: 'development' | 'production';
	workspace?: string;
	events?: string;
}

export interface DocsPrefetchOptions {
	/** 每个空闲批次提交的资源数量，默认 2，限制为 1～20。 */
	batchSize?: number;
	/** requestIdleCallback 最长等待时间，默认 1500ms。 */
	idleTimeout?: number;
}

export interface DocsThemeController {
	readonly current: Readonly<Ref<DocsTheme>>;
	readonly enabled: Readonly<Ref<boolean>>;
	readonly ready: Readonly<Ref<boolean>>;
	set(theme: DocsTheme, origin?: HTMLElement): Promise<void>;
	toggle(origin?: HTMLElement): Promise<void>;
}

export interface DocsResourceContext {
	source: string;
	type: DocsResourceType;
	lang: string;
	importer?: string;
	base?: string;
	runtime: Readonly<DocsRuntime>;
}

export interface DocsMarkdownContext {
	lang: string;
	value: string;
	route: RouteLocationNormalized;
}

export interface DocsLinkContext {
	/** Markdown 声明的原始链接地址。 */
	href: string;
	/** 当前文档语言。 */
	lang: string;
	/** 当前 Markdown 的逻辑资源地址。 */
	source: string;
	/** 当前 Vue Router 路由。 */
	route: RouteLocationNormalized;
}

export type DocsSlot = 'default' | string | null;

/** Sidebar 可继续使用资源地址，也可以直接声明当前语言或多语言的数据。 */
export type DocsSidebar = DocsSlot
	| SidebarItem[]
	| Record<string, SidebarItem[]>;

export interface DocsRoute {
	value?: string | ((to: RouteLocationNormalized) => string);
	content?: DocsSlot;
	sidebar?: DocsSidebar;
	header?: DocsSlot;
	footer?: DocsSlot;
	extra?: DocsSlot;
}

export type DocsRouteConfig = DocsRoute
	| string
	| ((to: RouteLocationNormalized) => string);

export interface DocsConfig {
	locales: Record<string, DocsLocaleEntry>;
	routes: Record<string, DocsRouteConfig>;
	base?: string;
	namespace?: string;
	modules?: Record<string, string>;
	prefetch?: boolean | DocsPrefetchOptions;
	theme?: boolean | DocsThemeOptions;
	resolve?: {
		markdown?: (context: DocsMarkdownContext) => string | Promise<string>;
		resource?: (context: DocsResourceContext) => string | Promise<string>;
		link?: (context: DocsLinkContext) => string | null | undefined;
	};
	runtime?: Readonly<DocsRuntime>;
}

export interface ResourceIdentity {
	namespace: string;
	lang: string;
	type: DocsResourceType;
	source: string;
}

export interface SidebarItem {
	label: string;
	value?: string;
	children?: SidebarItem[];
}

declare global {
	interface Window {
		$docs: DocsConfig;
		__DOCS_RUNTIME__?: Readonly<DocsRuntime>;
	}
}
