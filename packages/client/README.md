# @deot/docs-client

`@deot/docs-client` 是浏览器端文档应用壳，提供多语言路由、五个布局插槽、Markdown 与远程 SFC 渲染，以及带 IndexedDB 缓存和更新订阅的 `ResourceGateway`。

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
		modules: {}
	};
</script>

<link rel="stylesheet" href="//unpkg.com/@deot/docs-client/dist/index.style.css">
<script type="module" src="//unpkg.com/@deot/docs-client/dist/index.js"></script>
```

入口模块检测到页面存在 `#app` 时会自动调用 `bootstrap()`。也可以在不触发自动启动的环境中导入并手动调用：

```ts
import { bootstrap } from '@deot/docs-client';

const { app, router, disconnect } = bootstrap(window.$docs);
```

`disconnect()` 用于关闭当前实例创建的 SSE、空闲预加载和联网恢复监听。

## `$docs` 配置

| 字段 | 说明 |
| --- | --- |
| `locales` | 语言代码到 `{ label, client?, markdown?, playground? }` 的映射；第一项是默认文档语言。 |
| `routes` | 去掉语言前缀后的路由配置。字符串和函数表示重定向。 |
| `base` | production 资源的基准 URL。 |
| `namespace` | IndexedDB 缓存隔离标识；未设置时使用规范化后的 `base`。 |
| `modules` | 远程 SFC 中裸模块名到 URL 的映射。 |
| `prefetch` | 空闲预加载开关或 `{ batchSize, idleTimeout }` 配置，默认开启。 |
| `theme` | 主题开关或 `{ default: 'system' \| 'light' \| 'dark' }`，默认跟随系统。 |
| `resolve.markdown` | 根据 `lang`、`value` 和当前路由生成 Markdown 逻辑地址。 |
| `resolve.resource` | 将任意逻辑资源转换为最终 URL。 |
| `resolve.link` | 将 Markdown 原始链接同步转换为外链或包含语言的站内 Router 地址。 |

每个对象路由支持 `header`、`sidebar`、`content`、`footer` 和 `extra` 五个插槽：

- `null`：不渲染；
- `default`：content 使用 Markdown resolver，sidebar 加载 `./sidebar.json`，header/footer 使用内置组件；
- `.md`：渲染 Markdown；
- `.json`：解析为数据，当前主要用于递归 sidebar；
- `.vue`：通过独立 Playground iframe 渲染远程 SFC。

sidebar JSON 使用递归的 `{ label, value?, children? }` 结构。

### 默认首页

未配置 `routes['/']` 时，Client 使用内置首页；中文显示“你好 @deot/docs - 开始使用”，English 显示“Hello @deot/docs - Quick Start”。首页保留默认 Header/Footer、不展示 Sidebar，内容最小高度为 600px。

首页入口完全由业务 routes 和 Sidebar 决定：

1. 按 routes 的声明顺序选择路由模式；
2. 静态内容路由可以直接作为入口；
3. 动态路由按 Sidebar 深度优先顺序寻找第一个完整匹配的 value；
4. 当前模式无法实例化时继续下一模式。

`/packages/:name`、`/components/:name`、`/api/:version/:name` 等只是业务配置，Client 不固定前缀、参数名或参数数量。配置对象、字符串或函数形式的 `routes['/']` 可以完全覆盖内置首页。

### Locale 与 lang

`lang` 始终来自当前路由，用于文档资源寻址、搜索与缓存隔离；`locale` 只负责界面文案。Client 会在路由切换时同步 `<html lang>`。内置 `zh-CN` 和 `en-US`，自定义语言或缺少字段会逐字段回退到 `en-US`。翻译 key 必须属于 `client.*`、`markdown.*` 或 `playground.*`。

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

首屏路由就绪后，Client 默认在浏览器空闲阶段预加载已配置资源。它会先准备 sidebar、SFC 及递归依赖，再按 sidebar 的深度优先顺序加载 Markdown；当前路由请求始终使用更高优先级。每批默认提交 2 个资源，单次等待空闲最长 1500ms：

```js
window.$docs = {
	// 其他配置
	prefetch: {
		batchSize: 2,
		idleTimeout: 1500
	}
};
```

设置 `prefetch: false` 可关闭自动预加载，不影响诊断页的手动 Prefetch。诊断页默认位于 `/:lang/db`，`/db` 会跳转到默认语言；若站点声明了 `/db` 内容路由，诊断页改从 `/:lang/__docs/db` 访问。离线失败会保留历史内容和 error 状态；浏览器恢复联网后，只补充本会话失败、未完成和新发现的资源。

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

const record = await Gateway.load(identity);
const unsubscribe = Gateway.subscribe(identity, () => undefined);
```

`Gateway` 是共享的 `ResourceGateway` 实例；`Network` 是基于 `@deot/http` 的原始文本传输实例。

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

内置 Header 会搜索当前 namespace、当前语言下已进入 Gateway 缓存的 Markdown。空查询展示最近访问结果；选择文档或小节后会记录历史，并支持收藏和删除。搜索不会主动请求资源，后台空闲预加载完成后会静默扩充结果。

搜索历史独立保存在 `deot-docs-search` 数据库中，最多保留 20 条，Gateway 的 Clear 和 Prune 不会删除这些导航历史。

## 其他公共导出

- Runtime：`initializeDocsRuntime`、`getDocsConfig`、`getDocsRuntime`。
- Resolver：`getDocsBase`、`getDocsDeploymentBase`、`getDefaultLanguage`、`getDocsNamespace`、`resolveResource`、`createResourceIdentity`、`resourceIdentityKey`。
- 类型：`DocsConfig`、`DocsPrefetchOptions`、`DocsRoute`、`DocsRuntime`、`DocsLinkContext`、`ResourceIdentity`、`ResourceRecord`、`ResourceContentRecord`、`ResourceLoadOptions`、`ResourcePrefetchOptions` 等。

## 仓库内验证

在仓库根目录执行：

```bash
npm run test -- --package-name client
npm run build -- --package-name client
```

## 许可证

MIT
