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
| `workspace` | `string` | `site` | 文档 workspace。 |
| `outDir` | `string` | `dist` | build 输出目录。 |
| `build` | `boolean` | `false` | 执行一次 production 构建。 |
| `preview` | `boolean` | `false` | 启动 production 模式预览。 |
| `host` | `string` | `0.0.0.0` | preview 监听地址。 |
| `port` | `number` | `4173` | preview 监听端口。 |
| `dryRun` | `boolean` | `false` | 不启动服务或执行构建，只返回 dry-run 命令。 |

### `createDeverConfig(options)`

返回 development/build 可传给 Vite 的 `InlineConfig`；preview 配置仅用于模式检查，`run()` 会直接进入静态服务。配置会：

- 在 development 模式注入 `window.__DOCS_RUNTIME__`；
- 为 workspace 资源提供安全的原始文本响应；
- 在 development 模式开放 `/__docs/events`；
- 为客户端路由提供 HTML history fallback；
- 在 build 模式复制 Markdown、JSON、SFC 等静态内容资源；
- 当当前仓库源码存在时，将 Markdown 和 Playground 包映射到本地入口。

### `getDeverMode(options)`

返回 `development`、`build` 或 `preview`。同时传入 `build: true` 和 `preview: true` 会抛出 `TypeError`。

### 类型

包同时导出 `DeverOptions` 和 `DeverMode`。

## 配置与安全边界

- 配置文件查找顺序为 `z.doc.config`、`doc.config`、`vite.config`，支持 `.js` 和 `.ts`。
- development 的默认 Vite root 是当前工作目录；build 的 root 是 workspace。
- `.vue`、`.js`、`.ts`、`.css` 仅在请求声明 `Accept: text/plain` 时返回原始内容，普通模块请求继续由 Vite 转换。
- 在源码仓库执行 development 时，`/packages/{name}/README.md` 作为受限的 Markdown 资源开放并参与 SSE 更新；不会开放子包中的其他源码文件。
- 原始源码中间件会校验真实路径，拒绝目录穿越和逃逸 workspace 的符号链接。
- preview 不启动 Vite、watcher、HMR 或 SSE，不注入开发 runtime，且 `/__docs/*` 返回 404。
- 在本仓库预览时会复用统一 DDC 构建并映射本地 client 产物；其他项目保留 HTML 中声明的发布包 URL。

## 仓库内验证

在仓库根目录执行：

```bash
npm run test -- --package-name dever
npm run build -- --package-name dever
```

## 许可证

MIT
