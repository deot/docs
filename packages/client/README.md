# @deot/docs-client

`@deot/docs-client` 是浏览器端文档应用壳，提供多语言路由、五个布局插槽、Markdown、远程 SFC 与模块化页面渲染，以及带 IndexedDB 缓存和更新订阅的 `ResourceGateway`。

## 安装

```bash
pnpm add @deot/docs-client
```

## 快速开始

页面需要先声明 `#app` 和 `window.$docs`，再加载样式与 ES module：

```html
<div id="app"></div>

<script>
	window.$docs = {
		base: new URL('./', document.baseURI).href,
		namespace: 'my-docs',
		layout: {
			header: {
				brand: {
					logo: './logo.svg',
					label: { 'zh-CN': '组件文档', 'en-US': 'Component Docs' },
					value: '/guide'
				}
			}
		},
		locales: {
			'zh-CN': {
				label: '简体中文',
				client: {
					search: { placeholder: '搜索文档' }
				}
			},
			'en-US': { label: 'English' }
		},
		routes: {
			'/components/:name': {
				content: 'default',
				sidebar: './sidebar.json',
				header: 'default',
				footer: 'default',
				extra: null
			},
			'*': '/components/installation'
		},
		resolve: {
			markdown: ({ value }) => `./${value}.md`
		},
		modules: {},
		styles: {}
	};
</script>

<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@deot/docs-client/dist/index.style.css">
<script type="module" src="https://cdn.jsdelivr.net/npm/@deot/docs-client/dist/index.js"></script>
```

入口模块检测到页面存在 `#app` 时会自动调用 `bootstrap()`。也可以在不触发自动启动的环境中导入并手动调用：

```ts
import { bootstrap } from '@deot/docs-client';

const { app, router, disconnect } = await bootstrap(window.$docs);
```

`disconnect()` 用于关闭当前实例创建的 SSE、空闲预加载和联网恢复监听。

## Redirect 约定

`sessionStorage['@deot/docs:redirect']` 是文档站点的深链约定：把待还原的**同站绝对路径**交给 Client，启动后再导航到部署目录内的对应路由。

静态托管通常只会把未知路径交给入口 HTML 或自定义 404 页，不会像 `doc dev` / `doc preview` 那样做 history fallback。任意入口（常见是与 `index.html` 配套的 `404.html`）写入该键后跳转到**站点入口**（部署目录，例如 `'/'` 或 `'/docs/'`）：

```html
<script>
	sessionStorage['@deot/docs:redirect'] = location.pathname + location.search + location.hash;
</script>
<meta http-equiv="refresh" content="0;URL='/'" />
```

`bootstrap()` 在路由就绪后读取并清除该键。路径必须以 `/` 开头且不能是 `//`，且必须落在当前部署目录内；随后 `router.push` 去掉部署前缀后的路由。非法或越界值会被丢弃，但键仍会清除，避免下次启动误跳。仓库根目录 [`404.html`](../../404.html) 是一份可直接部署的实现，其中刷新地址是本仓库的 `/docs/`；其他站点应改成自己的入口。

## `$docs` 配置

| 字段 | 说明 |
| --- | --- |
| `locales` | 语言代码到 `{ label, client?, markdown?, playground?, renderer? }` 的映射；第一项是默认文档语言。 |
| `routes` | 去掉语言前缀后的路由配置。字符串和函数表示重定向。 |
| `base` | production 资源的基准 URL。 |
| `namespace` | IndexedDB 缓存隔离标识；未设置时使用规范化后的 `base`。 |
| `repository` | 当前文档项目的 GitHub 仓库页面；内置 Footer 据此生成 Issues、需求与 Releases 链接。 |
| `modules` | 站点级裸模块名到 URL 的映射，对所有 Playground（含 Markdown）生效；远程 SFC 仍可通过实例 `builtinImportMap` 覆盖。 |
| `styles` | 站点级预览 CSS 默认地址；同名 key 覆盖内置样式表，也可追加。管理页 `/:lang/__docs/playground-resource` 与 `modules` 同一张表管理。 |
| `prefetch` | 空闲预加载开关或 `{ batchSize, idleTimeout }` 配置，默认开启。 |
| `theme` | 主题开关或 `{ default: 'system' \| 'light' \| 'dark' }`，默认跟随系统。 |
| `layout.header` | 内置 Header 配置；`brand.logo`、`brand.label` 和 `brand.value` 均支持固定值或按语言配置。文案未配置时回退到 `namespace` 和内置翻译，链接未配置时指向当前语言首页。站内链接自动补语言前缀，外链在新窗口打开。 |
| `layout.footer` | Footer 内容；未配置或 `default` 使用内置分组，`false` 全局隐藏，也可配置 `{ groups, poweredBy }`。两项均支持按语言代码配置，`groups` 复用 Sidebar 的 `{ label, value?, children? }` 结构。 |
| `home` | 可选的 `{ locales }` 首页配置；语言值是 Renderer 文档或 `.page.json` 地址。未配置时首页为空。 |
| `renderers` | 业务自定义 Renderer 模块注册项；type 必须使用非 `docs:` 的命名空间。 |
| `resolve.markdown` | 根据 `lang`、`value` 和当前路由生成 Markdown 逻辑地址。 |
| `resolve.resource` | 将任意逻辑资源转换为最终 URL。 |
| `resolve.link` | 将 Markdown 原始链接同步转换为外链或包含语言的站内 Router 地址。 |

每个对象路由支持 `header`、`sidebar`、`content`、`footer` 和 `extra` 五个插槽：

- `null`：不渲染；
- `default`：content 使用 Markdown resolver，sidebar 加载 `./sidebar.json`，header/footer 使用内置组件；
- `.md`：渲染 Markdown；
- `.json`：解析为数据，当前主要用于递归 sidebar；
- `.vue`：通过独立 Playground iframe 渲染远程 SFC。
- `.page.json`：使用 `@deot/docs-renderer` 渲染模块化页面，并订阅 Gateway 内容更新。

Sidebar 使用递归的 `{ label, value?, children? }` 结构。原有 JSON/Gateway
加载方式保持不变，也可以直接传入 JavaScript 数组：

```js
const routes = {
	'/components/:name': {
		sidebar: [
			{ label: '开始使用', value: '/components/installation' },
			{
				label: '组件',
				children: [
					{ label: 'Button', value: '/components/button' }
				]
			}
		]
	}
};
```

多语言站点可以传入以 lang 为键的数据映射；当前语言缺失时回退到站点默认语言：

```js
const sidebar = {
	'zh-CN': [{ label: '简介', value: '/guide' }],
	'en-US': [{ label: 'Introduction', value: '/guide' }]
};
```

### 首页

未配置 `routes['/']` 时，Client 渲染 `$docs.home`。首页文档必须由站点自己提供，Client 不内置示例页：

```js
window.$docs = {
	home: {
		locales: {
			'zh-CN': './pages/home.page.json',
			'en-US': {
				schemaVersion: 2,
				meta: { id: 'home-en', title: 'Home' },
				layout: {
					mode: 'sortable',
					maxWidth: 1920,
					minHeight: 600,
					background: '#fff'
				},
				blocks: []
			}
		}
	}
};
```

未配置 `home` 时首页画布为空，仍保留默认 Header/Footer、不展示 Sidebar。`routes['/']` 可以完全覆盖该首页路由。

首页入口链接由站点文档自己声明。业务 routes 和 Sidebar 只决定内容页怎么走：

1. 按 routes 的声明顺序选择路由模式；
2. 静态内容路由可以直接作为入口；
3. 动态路由按 Sidebar 深度优先顺序寻找第一个完整匹配的 value；
4. 当前模式无法实例化时继续下一模式。

`/packages/:name`、`/components/:name`、`/api/:version/:name` 等只是业务配置，Client 不固定前缀、参数名或参数数量。

路由的 `content` 也可直接传入 Renderer 文档。`/:lang/__docs/renderer-editor` 在所有运行模式下都会注册；可从 Header 进入，编辑 Markdown、远程 SFC、内置模块和业务通过 `renderers` 声明的模块。development 下保存会 `PUT /__docs/page`，body 为 `{ lang, source, document }`，只写入工作区内带语言前缀的 `.page.json`；production 不开放该接口，仍可使用导入、导出和预览。Combo 草稿写入 IndexedDB 库 `deot-docs-renderer`，与 Gateway 的 `deot-docs` 分库。

对照组合与短路径 `/:lang/renderer-editor-demos` 仅在 development 注入；目录页列出全部演示，`?name=landing` 进入对应 Combo。若站点占用了 `/renderer-editor-demos`，改从 `/:lang/__docs/renderer-editor-demos` 访问。production 不注册这些演示路由。工厂函数也可直接赋给 `$docs.home` 或路由 `content`：

| 查询 | 内容 |
|---|---|
| （无 `name`） | 演示目录；第九格进入空白 `/renderer-editor` |
| `?name=sortable` | 空白流式画布 |
| `?name=landing` | Hero → Features → Steps → FAQ → CTA |
| `?name=shared` | Title / Text / List / Image / Actions / Space |
| `?name=promo` | 广告位四种样式（模块 type 仍是 `ads`） |
| `?name=docs` | `docs:markdown` + `docs:sfc` |
| `?name=combo` | 落地模块 + Markdown + 广告位 |
| `?name=draggable` | 自由画布 |
| `?name=selection` | 预置 selection 组合框 |

演示文档可由 `createRendererEditorDemoDocument(name, lang)` 生成（`@deot/docs-client` 导出），也可直接指向保存后的 `.page.json`：

```ts
window.$docs = {
	home: {
		locales: {
			'zh-CN': './home.page.json'
		}
	}
};
```

### Locale 与 lang

`lang` 始终来自当前路由，用于文档资源寻址、搜索与缓存隔离；`locale` 只负责界面文案。Client 会在路由切换时同步 `<html lang>`。内置 `zh-CN` 和 `en-US`，自定义语言或缺少字段会逐字段回退到 `en-US`。翻译 key 必须属于 `client.*`、`markdown.*`、`playground.*` 或 `renderer.*`。

### Theme

内置 Header 在启用主题时展示切换入口。Client 同步维护 `<body data-doc-theme>` 与 `<body data-vc-theme>`，因此 Docs 和 `@deot/vc` 会使用同一套 Light/Dark 状态。用户选择按站点 namespace 保存到 IndexedDB；首次进入时依次使用已保存设置、HTML 预设、配置默认值和系统偏好。

公共主题类型、`--docs-*` 语义变量和 SCSS 工具由 `@deot/docs-theme` 提供；Client 仅负责运行时状态、持久化和切换动画。Markdown、Playground 和 Client 的构建都会内联同一份变量样式，不要求页面额外加载主题 CSS。

```js
window.$docs = {
	// 其他配置
	theme: {
		default: 'system'
	}
};
```

设置 `theme: false` 可关闭内置主题控制。自定义 Header 可以从 `@deot/docs-client` 导入共享的 `Theme`，读取 `current/enabled/ready`，或调用 `Theme.set()`、`Theme.toggle()`；传入触发元素时，支持 View Transition 的浏览器会以该元素为圆心切换。

### 空闲预加载

首屏路由就绪后，Client 默认在浏览器空闲阶段预加载已配置资源。它会先准备 sidebar、SFC 及递归依赖，再按 sidebar 的深度优先顺序加载 Markdown 与页面文档；页面文档还会带上其引用的 Markdown / SFC。当前路由请求始终使用更高优先级。每批默认提交 2 个资源，单次等待空闲最长 1500ms：

```js
window.$docs = {
	// 其他配置
	prefetch: {
		batchSize: 2,
		idleTimeout: 1500
	}
};
```

设置 `prefetch: false` 可关闭自动预加载，不影响诊断页的手动 Prefetch。诊断页位于 `/:lang/__docs/database`。Playground 资源管理页位于 `/:lang/__docs/playground-resource`，可覆盖模块 import 与预览 CSS，并对当前地址做探测（阶段状态 waiting/pending/success/error）；`$docs.modules` 与 `$docs.styles` 作为站点默认对所有 Playground 生效，并出现在同一张管理表中。默认地址、探测结果与覆盖都保存在独立的 `deot-docs-playground-resource` IndexedDB 中；当前地址与默认不同才算覆盖，启动时只有覆盖会灌进内存。保存后对新打开的 Playground 生效；已挂载的 Playground 不会热更新 import map。回滚覆盖后回退默认地址。离线失败会保留历史内容和 error 状态；浏览器恢复联网后，只补充本会话失败、未完成和新发现的资源。

## Runtime 与资源寻址

production 页面不需要声明 runtime。`doc dev` 会在其他页面脚本前注入：

```js
window.__DOCS_RUNTIME__ = Object.freeze({
	mode: 'development',
	workspace: '/site/',
	events: '/__docs/events'
});
```

客户端会将它归一化到 `window.$docs.runtime`。默认寻址规则：

- development：`./guide.md` 解析为 `/site/{lang}/guide.md`；
- production：相对于 `$docs.base` 生成绝对 URL；未配置时，客户端会在路由启动前推导并固定部署目录；
- 相对依赖：相对于 `importer` URL 解析。

组件不应自行拼接资源 URL；应使用 `resolveResource()` 和 `createResourceIdentity()`。

同一份配置也可以按 runtime 切换数据源。例如源码仓库的 development 可返回本地子包 README，preview 和直接部署则返回仓库 Raw URL：

```js
const resolve = {
	markdown: ({ value }) => `packages/${value}/README.md`,
	resource: ({ source, runtime }) => runtime.mode === 'development'
		? `/${source}`
		: new URL(source, 'https://raw.githubusercontent.com/example/docs/refs/heads/main/').href,
	link: ({ href, lang, source }) => {
		const target = new URL(href, new URL(source, 'https://docs.local/'));
		if (target.pathname === '/packages/cli/README.md') return `/${lang}/cli`;
	}
};
```

`resolve.link` 为同步 Resolver。返回 `null`、`undefined` 或空字符串时保留原地址；返回绝对 URL 时保持浏览器外链行为；其他结果交给 Vue Router。Client 会把 Router 生成的真实 `href` 写回元素，因此复制链接、使用 deployment subpath 或在新标签打开时也能得到正确地址。锚点不会进入该 Resolver。

## ResourceGateway

```ts
import {
	Gateway,
	createResourceIdentity
} from '@deot/docs-client';

const identity = createResourceIdentity(
	window.$docs,
	'zh-CN',
	'markdown',
	'./guide.md'
);
const page = createResourceIdentity(
	window.$docs,
	'zh-CN',
	'page',
	'./pages/home.page.json'
);

const record = await Gateway.load(identity);
const unsubscribe = Gateway.subscribe(identity, () => undefined);
```

`Gateway` 是共享的 `ResourceGateway` 实例；`Network` 是基于 `@deot/http` 的原始文本传输实例。资源 `type` 为 `markdown`、`sidebar`、`page`、`sfc`、`module` 或 `style`。

| Gateway 方法 | 说明 |
| --- | --- |
| `load(identity, options?)` | 优先返回可用缓存，并默认在后台重新校验。 |
| `revalidate(identity, options?)` | 等待一次网络校验完成。 |
| `prefetch(identities, options?)` | 将资源标记为预加载并批量加入调度队列；支持 priority 和 signal。 |
| `subscribe(identity, listener)` | 仅在成功内容 hash 变化时通知。 |
| `subscribeStatus(listener)` | 订阅 `waiting`、`pending`、`success`、`error` 请求状态。 |
| `poll(identityOrIdentities, options?)` | 显式开启单资源或批量轮询，并返回停止函数。 |
| `stopPolling(identity)` | 停止指定资源轮询。 |
| `list()` | 列出缓存记录。 |
| `invalidate(identity)` | 删除单个资源并取消对应请求。 |
| `clear()` | 清空全部资源并取消当前请求。 |
| `prune(namespace, retained)` | 删除指定 namespace 中不在保留集合内的资源。 |
| `setConcurrency(value)` | 调整全局请求并发数。 |

默认缓存数据库名为 `deot-docs`。有旧内容但最新请求失败时，内容状态仍为 `success`，请求状态为 `error`；内容订阅不会被纯请求状态变化触发。

## Header 搜索

内置 Header 会搜索当前 namespace、当前语言下已进入 Gateway 缓存的 Markdown 与页面文档。空查询展示最近访问结果；选择文档或小节后会记录历史，并支持收藏和删除。搜索不会主动请求资源，后台空闲预加载完成后会静默扩充结果。

搜索历史独立保存在 `deot-docs-search` 数据库中，最多保留 20 条，Gateway 的 Clear 和 Prune 不会删除这些导航历史。

## 其他公共导出

- Runtime：`initializeDocsRuntime`、`getDocsConfig`、`getDocsRuntime`。
- Resolver：`getDocsBase`、`getDocsDeploymentBase`、`getDefaultLanguage`、`getDocsNamespace`、`resolveResource`、`createResourceIdentity`、`resourceIdentityKey`。
- Playground 资源：`PlaygroundResource`、`PlaygroundResourceCache`。
- 演示文档：`createRendererEditorDemoDocument`、`RENDERER_EDITOR_DEMOS`、`listRendererEditorDemos`、`isRendererEditorDemo`、`rendererEditorDemoPath`。
- 类型：`DocsConfig`、`DocsPrefetchOptions`、`DocsRoute`、`DocsRuntime`、`DocsLinkContext`、`DocsResourceType`、`ResourceIdentity`、`ResourceRecord`、`ResourceContentRecord`、`ResourceLoadOptions`、`ResourcePrefetchOptions`、`PlaygroundResourceRecord` 等。

## 仓库内验证

在仓库根目录执行：

```bash
npm run test -- --package-name client
npm run build -- --package-name client
```

## 许可证

MIT
