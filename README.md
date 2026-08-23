# @deot/docs

`@deot/docs` 是一套面向 Vue 3 的文档站点工具链。它以 `window.$docs` 作为页面协议，将 Markdown、页面文档（`.page.json`）、递归 Sidebar、远程 Vue SFC、主题、Locale、搜索和离线缓存组合成可直接部署的文档应用。

## 特性

- **Production-first**：页面默认加载已发布的 Client，可以直接部署；仅 `doc dev` 注入本地开发 Runtime。
- **统一资源网关**：Markdown、JSON、`.page.json`、SFC、JS、TS 和 CSS 经过同一套寻址、缓存、更新与订阅流程。
- **增量开发体验**：开发模式监听已加载资源，通过 SSE 触发目标插槽更新，无需刷新整个页面。
- **多语言路由**：`lang` 隔离路由、资源和缓存，Locale 独立负责界面翻译；内置 `zh-CN` 与 `en-US`。
- **Markdown 与远程 SFC**：支持标题锚点、文档指示器、代码高亮、提示容器和按需加载的 Playground。
- **缓存与预加载**：使用 IndexedDB 保存资源版本，支持离线回退、空闲预加载、批量更新和缓存诊断。
- **Light / Dark Theme**：Docs 与 `@deot/vc` 共享主题状态，支持系统偏好、持久化和切换动画。
- **内置文档搜索**：搜索当前语言下已缓存的 Markdown 与页面文档，支持小节定位、历史记录和收藏。
- **模块化页面**：Renderer 使用 JSON 页面协议组合 Hero、特性和业务模块，Combo 提供上下排序与自由布局装修工作台。

## 包结构

| 包 | 说明 |
| --- | --- |
| [`@deot/docs`](packages/index/README.md) | 聚合入口，导出 Dever、Locale、Renderer 和 Theme。 |
| [`@deot/docs-cli`](packages/cli/README.md) | 提供 `doc dev`、`doc build` 和 `doc preview` 命令。 |
| [`@deot/docs-dever`](packages/dever/README.md) | Development、build 和 preview 的运行层。 |
| [`@deot/docs-client`](packages/client/README.md) | Vue 应用壳、Router、布局、搜索和 ResourceGateway。 |
| [`@deot/docs-renderer`](packages/renderer/README.md) | 页面文档协议、只读 Renderer 和装修 Combo。 |
| [`@deot/docs-markdown`](packages/markdown/README.md) | Markdown 渲染、指示器、代码高亮与 Playground 容器。 |
| [`@deot/docs-playground`](packages/playground/README.md) | 远程 SFC 编译、编辑器和 iframe 预览。 |
| [`@deot/docs-locale`](packages/locale/README.md) | 分包命名空间 Locale、翻译函数和 Vue Provider。 |
| [`@deot/docs-theme`](packages/theme/README.md) | 公共主题协议、CSS 变量与 SCSS 工具。 |

`@deot/docs` 聚合包仅 re-export `Dever`、`Locale`、`Renderer` 与 `Theme` 四个命名空间；Markdown、Playground、Client 与 CLI 需按上表单独安装，见各子包 README。

## 快速开始

### 1. 安装 CLI

```bash
pnpm add -D @deot/docs-cli
```

### 2. 创建文档目录

```text
site/
├── index.html
├── 404.html                 # 静态托管深链：写入 @deot/docs:redirect 后跳转入口
├── en-US/
│   ├── index.md
│   ├── sidebar.json
│   └── pages/                 # 可选：Renderer 页面文档
│       └── home.page.json
└── zh-CN/
    ├── index.md
    └── sidebar.json
```

`sidebar.json` 使用递归的 `{ label, value?, children? }` 结构：

```json
[
  {
    "label": "开始使用",
    "value": "/guide/installation"
  },
  {
    "label": "指南",
    "children": [
      {
        "label": "安装",
        "value": "/guide/installation"
      }
    ]
  }
]
```

### 3. 配置 `site/index.html`

```html
<!DOCTYPE html>
<html>
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width,initial-scale=1">
	<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@deot/docs-client/dist/index.style.css">
	<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@deot/docs-renderer/dist/index.style.css">
	<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@deot/docs-markdown/dist/index.style.css">
	<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@deot/docs-playground/dist/index.style.css">
	<title>My Docs</title>
</head>
<body>
	<div id="app"></div>

	<script>
		window.$docs = {
			base: new URL('./', document.baseURI).href,
			namespace: 'my-docs',
			locales: {
				'zh-CN': { label: '简体中文' },
				'en-US': { label: 'English' }
			},
			routes: {
				'/guide/:name': {
					value: to => `guide/${to.params.name}`,
					content: 'default',
					sidebar: './sidebar.json',
					header: 'default',
					footer: 'default',
					extra: null
				},
				'*': '/guide/installation'
			},
			resolve: {
				markdown: ({ value }) => `./${value}.md`
			},
			theme: { default: 'system' },
			prefetch: {
				batchSize: 2,
				idleTimeout: 1500
			},
			modules: {},
			styles: {}
		};
	</script>
	<script type="module" src="https://cdn.jsdelivr.net/npm/@deot/docs-client/dist/index.js"></script>
</body>
</html>
```

默认资源寻址会将 `./guide/installation.md` 转换为：

- development：`/site/{lang}/guide/installation.md`
- production：相对于 `$docs.base` 的 `{lang}/guide/installation.md`

需要从仓库、CDN 或其他网关加载内容时，可以通过 `resolve.markdown`、`resolve.resource` 和 `resolve.link` 定义逻辑地址、最终 URL 与 Markdown 站内链接。

静态托管若不能做 HTML history fallback，请在 workspace 根目录同时提供 `404.html`：把当前 URL 写入 `sessionStorage['@deot/docs:redirect']`，再跳转到站点入口。跳转地址应是部署目录本身（根站用 `'/'`，子路径部署用 `'/docs/'` 这类前缀）。约定与实现见 [`@deot/docs-client`](packages/client/README.md)。

### 4. 启动开发服务

```bash
pnpm exec doc dev
```

未传 workspace 时优先使用 `site/index.html`，不存在时回退到项目根
`index.html`。也可以显式指定任意项目内子目录：

```bash
pnpm exec doc dev --workspace site
```

若 `index.html` 和文档资源直接位于项目根，则使用：

```bash
pnpm exec doc dev --workspace .
```

显式 workspace 必须包含自己的 `index.html`，不会回退到其他目录；项目外路径和
逃逸项目的符号链接会被拒绝。为保证 build 始终生成 `index.html`，入口文件本身
不能是符号链接。

## 运行模式

| 命令 | 行为 |
| --- | --- |
| `doc dev` | 启动 Vite，注入 `window.__DOCS_RUNTIME__`，开启本地资源响应、watcher 和 SSE 更新。 |
| `doc preview` | 直接以 production Runtime 预览 workspace，不启用 Vite、watcher、HMR 或 SSE。 |
| `doc build` | 以 workspace 的 `index.html` 为入口生成静态站点，复制独立内容资源（含 `.page.json`）后退出。 |

`window.__DOCS_RUNTIME__` 是开发服务与 Client 之间的内部环境信号；应用配置应始终写在 `window.$docs` 中。直接部署和 production build 不需要声明 Runtime。

## 首页

未配置 `routes['/']` 时，Client 渲染 `$docs.home` 中的页面文档。这份文档要写在站点的 `index.html` 里（内联 JSON 或 `.page.json` 地址），Client 不提供内置示例页。未配置时首页画布为空。页面协议、内置模块和 Combo 见 [`@deot/docs-renderer`](packages/renderer/README.md)；开发模式下保存会调用 `PUT /__docs/page`，由 [`@deot/docs-dever`](packages/dever/README.md) 写入语言目录下的 `.page.json`。

`routes['/']` 可以完全覆盖该首页路由。内容页入口仍由业务 routes 和 Sidebar 决定：Client 先按 routes 声明顺序选择路由模式，再从 Sidebar 中按深度优先顺序取得该路由的第一个具体 value。

路由前缀、参数名称和参数数量均由业务决定：

```js
const routes = {
	'/components/:name': {},
	'/api/:version/:name': {},
	'/guides/:group/:article': {}
};
```

例如 `/components/:name` 对应的第一个 Sidebar value 是 `/components/button`，即可作为当前语言的内容入口。

## `$docs` 核心配置

| 字段 | 说明 |
| --- | --- |
| `locales` | 文档语言及 Header 展示名称；第一项是默认语言。界面文案可覆盖 `client` / `markdown` / `playground` / `renderer` 命名空间。 |
| `routes` | 去掉语言前缀后的路由和五插槽配置。 |
| `base` | Production 资源基准 URL。 |
| `namespace` | IndexedDB 缓存隔离标识。 |
| `modules` | 远程 SFC 裸模块名到 URL 的映射。 |
| `styles` | Playground 预览 CSS 的站点默认地址；同名 key 覆盖内置样式表。 |
| `theme` | 主题开关或默认主题配置。 |
| `prefetch` | 空闲预加载开关或批次配置。 |
| `home` | 可选的多语言首页页面文档或 `.page.json` 地址；未配置时首页为空。 |
| `renderers` | 业务自定义 Renderer 模块注册项。 |
| `resolve.markdown` | 根据 `lang`、路由值和当前路由产生 Markdown 逻辑地址。 |
| `resolve.resource` | 将任意逻辑资源转换为最终请求 URL。 |
| `resolve.link` | 将 Markdown 链接转换为外链或本地化 Router 地址。 |

完整 Client 配置、Gateway API 和资源状态模型请查看 [`@deot/docs-client`](packages/client/README.md)。

## 本仓库开发

上方「快速开始」面向**新建文档站点**的通用 `site/` 模板（含 `sidebar.json`、`index.md` 等）。本仓库自带的演示是 **README 聚合**：根目录 [`index.html`](index.html) 内联 Sidebar 与首页 Renderer 文档，开发模式下读取根目录与各子包 README；因此克隆后找不到 `site/zh-CN/index.md` 或 `sidebar.json` 是预期行为。未指定 `--workspace` 时 CLI 仍优先探测 `site/index.html`，本仓库没有 `site/` 时回退到根 `index.html`。

静态托管若不能做 HTML history fallback，请同时托管 [`404.html`](404.html)。它会把当前 URL 写入 `sessionStorage['@deot/docs:redirect']` 再跳转入口，由 [`@deot/docs-client`](packages/client/README.md) 按约定还原深链。本仓库这份 `404.html` 跳转到 `/docs/`（当前演示的部署目录）；新建站点应改成自己的入口。`doc dev` 与 `doc preview` 已自带 history fallback，不必依赖该键。

```bash
pnpm install

# 启动本仓库示例文档站点（doc dev，读根 index.html）
npm run cli:dev

# 启动 Markdown / Playground 包 examples（扫 packages/*/examples）
npm run dev

# Production Runtime 预览（同样自动命中根 index.html）
npm run cli:preview

# 本仓库演示不要用 cli:build 发布：根 workspace 会把 monorepo 源码复制进 dist。
# 直接部署时托管根 index.html；需要深链回退时同时托管 404.html（写入 @deot/docs:redirect）。

# 类型、测试与构建
npm run typecheck
npm run test -- --package-name '*'
npm run build -- --package-name '<folder>'   # 单包：cli、client、dever、index、markdown、playground、renderer、locale、theme
npm run build                                 # 全量；declaration 可能打印上游类型告警，以各包 Success 为准

# 代码与样式检查
npm run lint
npm run lint:fix
npm run lint:style
```

[`index.html`](index.html) 展示了按 Runtime 在本地文件与 GitHub Raw URL 之间切换的完整 resolver 配置，并用内联 Renderer 文档作为首页。

贡献代码前请阅读 [贡献指南](.github/CONTRIBUTING.md)。

## 许可证

[MIT](LICENSE)
