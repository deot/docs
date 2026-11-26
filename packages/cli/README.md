# @deot/docs-cli

`@deot/docs-cli` 提供 `doc` 命令，用于启动文档开发服务、生成静态站点或预览 production 模式下的文档 workspace。

## 安装

```bash
pnpm add -D @deot/docs-cli
```

## 快速开始

workspace 必须位于当前项目内，并在自身根部包含 `index.html`。未传参数时
优先使用 `site/index.html`，不存在时回退到项目根 `index.html`；入口文件本身
不能是符号链接：

```bash
pnpm exec doc dev
```

指定其他 workspace：

```bash
pnpm exec doc dev --workspace docs
```

也可以将项目根作为完整 workspace：

```bash
pnpm exec doc dev --workspace .
```

## 命令

### `doc dev`

启动 Vite 开发服务。该模式会向 HTML 注入 `window.__DOCS_RUNTIME__`，提供本地资源寻址、`/__docs/events` SSE、已加载资源的更新通知，以及 `PUT /__docs/page` 页面保存入口。保存规则见 [`@deot/docs-dever`](../dever/README.md)。

消费项目会把 HTML 中的 launch、Client JS/CSS 地址映射到本地已安装的发布包，缺少完整产物时保留 CDN 地址；在 docs 源码仓库中仍优先加载本地源码。入口文件本身保持不变。

development 还会把工作区里带 `src/index.ts` 或 `index.ts` 的包编成浏览器 ESM，地址是 `/__docs/module/<包名>`。站点在 `index.html` 里用 `window.__DOCS_RUNTIME__?.mode !== 'development'` 决定 `$docs.modules`：开发时指向这些本地地址，直接打开 HTML 时继续用 CDN。`vue` 以及其它非工作区依赖保持裸导入，仍由 Playground 的 import map 解析。preview 和 build 不提供该地址。

```bash
pnpm exec doc dev --workspace site
```

### `doc build`

以 workspace 的 `index.html` 为入口执行一次 production 构建，并将 workspace 内的静态资源（含 `.page.json`）复制到输出目录。构建完成后进程退出，不启用 watcher 或 SSE。

```bash
pnpm exec doc build --workspace site --out-dir dist
```

### `doc preview`

直接以 production runtime 预览 workspace，不生成新的构建产物。默认端口为 `4173`，不会注入开发 runtime，也不会启用 HMR 或 SSE。该模式已提供 HTML history fallback。

若把站点部署到只能配置自定义 404 页的静态托管，请同时提供 `404.html`：把当前 URL 写入 `sessionStorage['@deot/docs:redirect']` 后跳转入口，由 [`@deot/docs-client`](../client/README.md) 还原深链。

```bash
pnpm exec doc preview --workspace site
```

### `doc check`

冒烟检查：启动开发服务（或用 `--url` 检查已在运行的站点），用无头浏览器逐页打开文档，依次挂载每个 Playground，收集编译错误、运行时错误、`console.error`、未处理的 Promise 拒绝、资源加载失败和配置错误，按「文件:行号 「标题」 [local|iframe]」输出报告。有错误时退出码为 1；配置警告只列出，`--strict` 时也算失败。

```bash
pnpm exec doc check
pnpm exec doc check --include 'docs/**' --mode both --reporter json
```

- 示例按串行方式挂载，期间页面上的错误都归到当前示例。`views: ['files']` 的示例也会跑一次运行时。
- 多语言共用同一份 Markdown 时，同一源文件只检查一次。
- 需要 `puppeteer`（可选依赖，`pnpm add -D puppeteer`）。Playground 从公共 CDN 加载依赖，需要网络；首次加载组件库可能较慢，必要时调大 `--timeout`。

## 选项

| 选项 | 适用命令 | 说明 |
| --- | --- | --- |
| `--workspace <path>` | 全部 | 项目内的 workspace；未指定时依次探测 `site` 和项目根。 |
| `--out-dir <path>` | `build` | 输出目录，默认 `dist`。 |
| `--host <host>` | `preview` | 监听地址，默认 `0.0.0.0`。 |
| `--port <port>` | `preview` | 监听端口，默认 `4173`。 |
| `--mode <mode>` | `check` | `declared`（默认，按示例自己的 `local`）、`local`、`iframe`，或 `both`（每个示例两种方式各跑一次）。 |
| `--include <pattern>` | `check` | 只检查路由或源文件匹配的页面；含 `*` 时按通配符（`**` 跨目录），否则按子串。 |
| `--timeout <ms>` | `check` | 单个示例等待挂载的上限，默认 `30000`。 |
| `--settle <ms>` | `check` | 挂载后继续收集异步错误的时间，默认 `500`。 |
| `--reporter <type>` | `check` | `text`（默认）或 `json`。 |
| `--url <url>` | `check` | 检查已在运行的站点，不启动开发服务。 |
| `--strict` | `check` | 配置警告也算失败。 |
| `--dry-run [boolean]` | 全部 | 只输出将要运行的模式，不启动服务或执行构建。 |
| `--package-name <name>` | 全部 | 原样传给运行层的包名上下文；当前核心模式不读取。 |
| `--custom <value>` | 全部 | 原样传给运行层的扩展信息；当前核心模式不读取。 |

`build` 与 `preview` 是互斥模式，不能在同一次运行中同时启用。

## 配置查找

CLI 会从当前工作目录按以下顺序查找第一个存在的配置文件，并与内置文档插件配置合并：

1. `z.doc.config.js` / `z.doc.config.ts`
2. `doc.config.js` / `doc.config.ts`
3. `vite.config.js` / `vite.config.ts`

未找到时使用 `@deot/docs-dever` 自带的 `shared.config.ts`。

## 仓库内验证

在仓库根目录执行：

```bash
npm run test -- --package-name cli
npm run build -- --package-name cli
```

## 许可证

MIT
