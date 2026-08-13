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

启动 Vite 开发服务。该模式会向 HTML 注入 `window.__DOCS_RUNTIME__`，提供本地资源寻址、`/__docs/events` SSE 和已加载资源的更新通知。

```bash
pnpm exec doc dev --workspace site
```

### `doc build`

以 workspace 的 `index.html` 为入口执行一次 production 构建，并将 workspace 内的静态资源复制到输出目录。构建完成后进程退出，不启用 watcher 或 SSE。

```bash
pnpm exec doc build --workspace site --out-dir dist
```

### `doc preview`

直接以 production runtime 预览 workspace，不生成新的构建产物。默认端口为 `4173`，不会注入开发 runtime，也不会启用 HMR 或 SSE。

```bash
pnpm exec doc preview --workspace site
```

## 选项

| 选项 | 适用命令 | 说明 |
| --- | --- | --- |
| `--workspace <path>` | 全部 | 项目内的 workspace；未指定时依次探测 `site` 和项目根。 |
| `--out-dir <path>` | `build` | 输出目录，默认 `dist`。 |
| `--host <host>` | `preview` | 监听地址，默认 `0.0.0.0`。 |
| `--port <port>` | `preview` | 监听端口，默认 `4173`。 |
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
