# @deot/docs-dever

`@deot/docs-dever` 是 `doc` CLI 的运行层，负责 development、build 和 preview 三种模式，以及开发 runtime、原始资源响应、SSE、history fallback 和静态资源复制。

## 安装

```bash
pnpm add -D @deot/docs-dever
```

## 快速开始

```ts
import { run } from '@deot/docs-dever';

await run({
	workspace: 'site'
});
```

`run()` 根据选项确定模式：

```ts
await run({ workspace: 'site' }); // development
await run({ workspace: 'site', preview: true }); // preview
await run({ workspace: 'site', build: true, outDir: 'dist' }); // build
```

development 和 preview 会保持服务运行；build 在 Vite 构建结束后返回。

## 公共 API

### `run(options)`

运行文档服务或构建。常用选项：

| 选项 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `workspace` | `string` | 自动探测 | 项目内的文档 workspace；显式 `.` 表示项目根。 |
| `outDir` | `string` | `dist` | build 输出目录。 |
| `build` | `boolean` | `false` | 执行一次 production 构建。 |
| `preview` | `boolean` | `false` | 启动 production 模式预览。 |
| `host` | `string` | `0.0.0.0` | preview 监听地址。 |
| `port` | `number` | `4173` | preview 监听端口。 |
| `dryRun` | `boolean` | `false` | 不启动服务或执行构建，只返回 dry-run 命令。 |

### `createDeverConfig(options)`

返回 development/build 可传给 Vite 的 `InlineConfig`；preview 配置仅用于模式检查，`run()` 会直接进入静态服务。配置会：

- 在 development 模式注入 `window.__DOCS_RUNTIME__`；
- 为 workspace 资源提供安全的原始文本响应；`.page.json` 按页面文档（`page`）处理，其余 `.json` 按 sidebar 处理；
- 在 development 模式开放 `/__docs/events`，以及 `PUT /__docs/page`（只写工作区内、带语言前缀的 V2 `.page.json`）；
- 为客户端路由提供 HTML history fallback；
- 在 build 模式复制 Markdown、JSON（含 `.page.json`）、SFC 等静态内容资源；
- 当当前仓库源码存在时，将 locale、renderer、markdown、playground、theme 包映射到本地入口。

### `getDeverMode(options)`

返回 `development`、`build` 或 `preview`。同时传入 `build: true` 和 `preview: true` 会抛出 `TypeError`。

### `resolveDocsWorkspace(cwd?, workspace?)`

返回 dev、preview、build 共用的规范 workspace，包括真实根目录、相对路径、
URL 前缀和入口文件。未显式指定时优先查找 `site/index.html`，再查找项目根
`index.html`；显式路径缺少入口时不会回退。

### 类型

包同时导出 `DeverOptions`、`DeverMode` 和 `ResolvedDocsWorkspace`。

## 页面保存

development 开放 `PUT /__docs/page`，JSON body 为 `{ lang, source, document }`：

- `lang` 必须是业务语言代码；
- `source` 必须是带 `.page.json` 后缀的相对地址，不能含 `..` 或绝对路径；
- 文件写入 `{workspace}/{lang}/{source}`，不会越过 workspace 或符号链接边界；
- `document` 必须是 `schemaVersion: 2`，并包含 `meta.id`、`layout.mode`（`sortable` 或 `draggable`）和 `blocks` 数组。

preview 与 production 不提供该入口；`/__docs/*` 在 preview 下返回 404。

## 配置与安全边界

- 配置文件查找顺序为 `z.doc.config`、`doc.config`、`vite.config`，支持 `.js` 和 `.ts`。
- workspace 可以是项目根或任意项目内子目录；项目外路径、`..` 路径段、入口符号链接及逃逸项目的符号链接会被拒绝。
- development 的默认 Vite root 是当前工作目录；build 的 root 是 workspace。
- `.vue`、`.js`、`.ts`、`.css` 仅在请求声明 `Accept: text/plain` 时返回原始内容，普通模块请求继续由 Vite 转换。
- 在源码仓库执行 development 时，`/packages/{name}/README.md` 作为受限的 Markdown 资源开放并参与 SSE 更新；不会开放子包中的其他源码文件。
- 原始源码中间件会校验真实路径，拒绝目录穿越和逃逸 workspace 的符号链接。
- preview 不启动 Vite、watcher、HMR 或 SSE，不注入开发 runtime，且 `/__docs/*`（含页面保存入口）返回 404。
- 根 workspace 构建会跳过隐藏目录、`node_modules`、`coverage`、常见构建缓存目录和当前 outDir。
- 在本仓库预览时会复用统一 DDC 构建，并按 `@deot/docs-client[@version]/dist/index.*` 与 jsDelivr `/+esm`（映射到 `dist/index.js`）改写成本地 Client，本地地址保留 `dist/`；不限制 unpkg、jsDelivr 等 CDN 域名；其他项目保留 HTML 中声明的发布包 URL。

## 仓库内验证

在仓库根目录执行：

```bash
npm run test -- --package-name dever
npm run build -- --package-name dever
```

## 许可证

MIT
