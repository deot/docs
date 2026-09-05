import type { RouteLocationNormalized, RouteLocationNormalizedGeneric } from 'vue-router';
import type { Ref } from 'vue';
import type { DocsLocaleEntry } from '@deot/docs-locale';
import type { DocsTheme, DocsThemeOptions } from '@deot/docs-theme';
import type {
	RendererDocument,
	RendererModuleSource
} from '@deot/docs-renderer';

export type { DocsLocaleEntry, Language } from '@deot/docs-locale';
export type { DocsTheme, DocsThemeOptions, DocsThemePreference } from '@deot/docs-theme';

export const DOCS_RESOURCE_TYPES = ['markdown', 'sidebar', 'page', 'sfc', 'module', 'style'] as const;
export type DocsResourceType = typeof DOCS_RESOURCE_TYPES[number];

/**
 * dever `createRuntimePlugin` 注入的 `window.__DOCS_RUNTIME__`。
 * `workspace` 是 `ResolvedDocsWorkspace.urlBase`，不是文件系统 root。
 * @see packages/dever/src/plugins/index.ts
 */
export interface DocsRuntime {
	/**
	 * 站点运行时模式。只有 development 会订阅资源热更新。
	 */
	mode: 'development' | 'production';
	/**
	 * 浏览器访问资源的规范路径前缀，对应 dever `urlBase`，不是文件系统 root。
	 */
	workspace?: string;
	/**
	 * development 下资源热更新的 SSE 地址；缺省或空字符串表示关闭。
	 */
	events?: string;
}

export interface DocsPrefetchOptions {
	/**
	 * 每个空闲批次提交的资源数量，默认 2，限制为 1～20。
	 */
	batchSize?: number;
	/**
	 * requestIdleCallback 最长等待时间，默认 1500ms。
	 */
	idleTimeout?: number;
}

export interface DocsThemeController {
	/**
	 * 当前生效主题。未启用主题功能时仍可读，但不写 DOM。
	 */
	readonly current: Readonly<Ref<DocsTheme>>;
	/**
	 * 站点是否接管主题。配置为 `false` 时不改 `data-doc-theme`。
	 */
	readonly enabled: Readonly<Ref<boolean>>;
	/**
	 * 是否已从设置存储完成首轮同步，避免用系统偏好覆盖用户选择。
	 */
	readonly ready: Readonly<Ref<boolean>>;
	set(theme: DocsTheme, origin?: HTMLElement): Promise<void>;
	toggle(origin?: HTMLElement): Promise<void>;
}

export interface DocsResourceContext {
	/**
	 * 逻辑资源地址，如 `./guide.md`，不是最终 HTTP URL。
	 */
	source: string;
	type: DocsResourceType;
	lang: string;
	/**
	 * 发起解析的文档地址，用来解析相对路径；站点级资源可省略。
	 */
	importer?: string;
	/**
	 * 部署 public base。自定义 resolver 拼绝对 URL 时使用。
	 */
	base?: string;
	runtime: Readonly<DocsRuntime>;
}

export interface DocsMarkdownContext {
	lang: string;
	/**
	 * 待渲染或待改写的 Markdown 原文。
	 */
	value: string;
	/**
	 * 真实导航的路由，或资源计划在非路由环境合成的等价 route shape。
	 */
	route: RouteLocationNormalizedGeneric;
}

export interface DocsLinkContext {
	/**
	 * Markdown 声明的原始链接地址。
	 */
	href: string;
	/**
	 * 当前文档语言。
	 */
	lang: string;
	/**
	 * 当前 Markdown 的逻辑资源地址。
	 */
	source: string;
	/**
	 * 当前 Vue Router 路由。
	 */
	route: RouteLocationNormalized;
}

/**
 * 布局插槽来源，用于 `header` / `footer` / `extra`，也被 `content` 与 `sidebar` 复用。
 *
 * - `'default'`：使用 Client 内置实现。`header` / `footer` / `extra` 挂内置组件；
 *   `sidebar` 会改写为 `./sidebar.json` 再走资源加载；`content` 先走
 *   `resolve.markdown` 得到 Markdown 逻辑地址，再走 `resolve.resource`。
 * - `string`：逻辑资源地址，如 `./guide.md`、`./App.vue`、`./pages/home.page.json`。
 *   最终请求 URL 由 `resolve.resource` 决定；`.vue` 由远程 SFC 在内部解析。
 * - `null`：关闭该插槽，不渲染。
 *
 * 字段缺省时：`content` 视为 `'default'`，其余插槽视为 `null`。
 */
export type DocsSlot = 'default' | string | null;

/**
 * 页面主内容：在 `DocsSlot` 之上允许内联 Renderer 文档。
 *
 * - `'default'` / `string` / `null`：行为与 `DocsSlot` 相同。Markdown、SFC、
 *   `.page.json` 都写成字符串；只有字符串会走 `resolve.resource`。
 * - `RendererDocument`：内联页面文档，直接交给 Renderer / HomePage，不请求资源。
 *   用对象上的 `schemaVersion` 与语言映射区分，避免把 `Record<lang, DocsContent>`
 *   当成文档。
 *
 * `DocsRoute.content` 的类型是 `DocsLocalized<DocsContent>`，因此还可以写成
 * `Record<lang, DocsContent>`。映射里每个值都是完整的 `DocsContent`。
 * 根路由 `pathname === '/'` 缺语言回退 `en-US`；其它路由回退站点默认语言。
 *
 * 根路由 `routes['/']` 的 `content` 若为 Renderer 文档、`.page.json` 或二者的
 * 语言映射，仍使用内置 HomePage；若为 `'default'` / Markdown / SFC / `null`，
 * 则覆盖内置首页，走普通 ResourceSlot。
 */
export type DocsContent = DocsSlot | RendererDocument;

/**
 * 单值或多语言映射。`T` 对所有语言生效；`Record<lang, T>` 按当前语言取值。
 * 语言映射缺失时通常回退站点默认语言；首页 `content` 回退 `en-US`。
 * 判断语言映射时排除数组，并用有无 `schemaVersion` 区分 Renderer 文档。
 */
export type DocsLocalized<T> = T | Record<string, T>;

/**
 * Sidebar 数据来源：在 `DocsSlot` 之上允许内联条目。
 *
 * - `'default'`：加载 `./sidebar.json`。
 * - `string`：Sidebar 资源地址，走 Gateway / `resolve.resource`。
 * - `null`：关闭 Sidebar。
 * - `SidebarItem[]`：所有语言共用这份内联数据，不请求资源。
 * - `Record<lang, SidebarItem[]>`：按语言的内联数据；当前语言缺失时回退站点
 *   默认语言。
 *
 * 用 `Array.isArray` 区分条目数组与语言映射。字段缺省视为 `null`。
 */
export type DocsSidebar = DocsSlot
	| SidebarItem[]
	| Record<string, SidebarItem[]>;

export interface DocsRoute {
	/**
	 * 路由展示名。字符串直接用；函数按当前路由计算。缺省时由路径推导。
	 */
	value?: string | ((to: RouteLocationNormalizedGeneric) => string);
	/**
	 * 主内容。缺省视为 `'default'`。取值与语言回退见 `DocsContent` /
	 * `DocsLocalized`。
	 */
	content?: DocsLocalized<DocsContent>;
	/**
	 * 侧栏。缺省视为 `null`。取值见 `DocsSidebar`。
	 */
	sidebar?: DocsSidebar;
	/**
	 * 页头。缺省视为 `null`。`'default'` 用内置 Header，字符串走资源地址，
	 * `null` 关闭。
	 */
	header?: DocsSlot;
	/**
	 * 页脚。缺省视为 `null`。`'default'` 用内置 Footer，字符串走资源地址，
	 * `null` 关闭。
	 */
	footer?: DocsSlot;
	/**
	 * 额外插槽。缺省视为 `null`。`'default'` 走内置组件，字符串走资源地址，
	 * `null` 关闭。
	 */
	extra?: DocsSlot;
}

/**
 * 路由声明。对象是插槽配置；字符串或函数是重定向目标（相对当前语言前缀）。
 * 根路径 `routes['/']` 为字符串 / 函数时覆盖内置首页，不是 HomePage。
 */
export type DocsRouteConfig = DocsRoute
	| string
	| ((to: RouteLocationNormalizedGeneric) => string);

/**
 * Footer 提供方文案。`'default'` 用内置文案，字符串为自定义文案，`false` 关闭。
 */
export type DocsFooterPoweredBy = 'default' | string | false;

export interface DocsFooterOptions {
	/**
	 * Footer 导航，结构与 Sidebar 内联数据一致：可以是 `SidebarItem[]`，
	 * 也可以是按语言的映射。
	 */
	nav?: DocsLocalized<SidebarItem[]>;
	/**
	 * 底部提供方信息。默认文案、自定义文案，或关闭。
	 */
	poweredBy?: DocsLocalized<DocsFooterPoweredBy>;
}

export interface DocsHeaderBrandOptions {
	/**
	 * 品牌 Logo 地址。按语言配置时与文案使用相同回退规则。
	 */
	logo?: DocsLocalized<string>;
	/**
	 * 品牌文案。缺省时依次回退到 namespace 和内置翻译。
	 */
	label?: DocsLocalized<string>;
	/**
	 * 品牌链接。缺省时跳转到当前语言首页。
	 */
	value?: DocsLocalized<string>;
}

export interface DocsHeaderOptions {
	/**
	 * 内置 Header 的品牌展示与跳转配置。
	 */
	brand?: DocsHeaderBrandOptions;
	/**
	 * Header 横向导航，结构与 Sidebar / Footer nav 保持一致。
	 */
	nav?: DocsLocalized<SidebarItem[]>;
}

export interface DocsLayoutOptions {
	/**
	 * 内置 Header 配置。
	 */
	header?: DocsHeaderOptions;
	/**
	 * 未配置或 `'default'` 使用内置 Footer；`false` 全局关闭。
	 */
	footer?: 'default' | DocsFooterOptions | false;
}

export interface DocsConfig {
	locales: Record<string, DocsLocaleEntry>;
	/**
	 * 路径模式到路由配置。键为 Vue Router 风格 path，如 `/guide/:id`。
	 */
	routes: Record<string, DocsRouteConfig>;
	/**
	 * 站点 public base，与 Vite `base` 对齐。
	 */
	base?: string;
	/**
	 * 当前文档项目的远程仓库页面。Header 据此展示仓库入口；
	 * GitHub 地址还会用于生成默认 Footer 反馈链接。
	 */
	repository?: string;
	/**
	 * Gateway 缓存与 IndexedDB 分区名。多站点同域时必须区分。
	 */
	namespace?: string;
	/**
	 * 远程 SFC 的 Playground import 映射，也会作为全站 Playground 的 import 默认。
	 * 同名 key 覆盖内置 CDN，也可追加。远程 SFC 会再把它传给实例 `builtinImportMap`。
	 */
	modules?: Record<string, string>;
	/**
	 * Playground 预览 CSS 的站点默认地址。同名 key 覆盖内置样式表，也可追加新表。
	 */
	styles?: Record<string, string>;
	/**
	 * 空闲预加载。`false` 关闭；`true` 用默认批次。
	 */
	prefetch?: boolean | DocsPrefetchOptions;
	/**
	 * 主题接管。`false` 不写 `data-doc-theme`；`true` 用默认偏好。
	 */
	theme?: boolean | DocsThemeOptions;
	/**
	 * Markdown 排版皮肤，与 `theme`（light/dark）正交。缺省 `default`。
	 */
	markdownTheme?: 'default' | 'traditional';
	/**
	 * 内置页面布局配置。
	 */
	layout?: DocsLayoutOptions;
	/**
	 * 业务侧注册的 Renderer 模块，启动时注入 Combo / Renderer。
	 */
	renderers?: RendererModuleSource[];
	/**
	 * 可选解析钩子。返回 `null` / `undefined` 时回退内置行为。
	 */
	resolve?: {
		markdown?: (context: DocsMarkdownContext) => string | Promise<string>;
		resource?: (
			context: DocsResourceContext
		) => string | null | undefined | Promise<string | null | undefined>;
		link?: (context: DocsLinkContext) => string | null | undefined;
	};
	/**
	 * 启动后写入的运行时快照。配置文件里不必手写。
	 */
	runtime?: Readonly<DocsRuntime>;
}

export interface ResourceIdentity {
	/**
	 * 与 `DocsConfig.namespace` 对齐的缓存分区。
	 */
	namespace: string;
	lang: string;
	type: DocsResourceType;
	/**
	 * 逻辑资源地址，如 `./guide.md`。同一 namespace 内与 type 一起构成缓存键。
	 */
	source: string;
}

export interface SidebarItem {
	label: string;
	/**
	 * 点击后跳转的站内路径。可带语言前缀；缺省时只作分组标题。
	 */
	value?: string;
	children?: SidebarItem[];
}

declare global {
	interface Window {
		$docs: DocsConfig;
		__DOCS_RUNTIME__?: Readonly<DocsRuntime>;
	}
}
