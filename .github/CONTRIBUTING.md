# 贡献指南

感谢你对 `@deot/docs` 的关注。在提交 Issue 或 Pull Request 之前，请先阅读本指南。

## 行为准则

我们采用 [Contributor Covenant 行为准则](./CODE_OF_CONDUCT.md)。参与本项目的讨论与贡献时，请遵守其中的约定。

## 开发环境

本仓库是 **pnpm monorepo**。请在仓库根目录操作：

```bash
pnpm install
```

常用命令：

| 任务 | 命令 |
| --- | --- |
| 示例文档站点（根 `index.html`） | `npm run cli:dev` |
| Markdown / Playground 包 examples | `npm run dev` |
| Production 预览 | `npm run cli:preview` |
| 类型检查 | `npm run typecheck` |
| 全部测试 | `npm run test -- --package-name '*'` |
| 单包测试 / 构建 | `npm run test -- --package-name '<folder>'` / `npm run build -- --package-name '<folder>'` |
| ESLint | `npm run lint` / `npm run lint:fix` |
| 样式 | `npm run lint:style` |

有效包目录名：`cli`、`client`、`dever`、`index`、`locale`、`markdown`、`playground`、`renderer`、`theme`。

## 分支与 Issue

- 默认分支为 **`main`**。请基于最新的 `main` 创建分支并提交 PR。
- Bug 与功能请求请使用 [GitHub Issues](https://github.com/deot/docs/issues)。
- 较大改动建议先开 Issue 讨论方案，再动手实现。

## Pull Request 检查清单

提交 PR 前请确认：

1. 变更范围清晰，commit 信息符合项目规范（Husky 会运行 `lint-staged` 与 `dd-commitlint`）。
2. 相关包已补充或更新测试；修复 bug 或新增功能时测试很重要。
3. 全部相关测试通过：`npm run test -- --package-name '*'`（或针对改动包的 `--package-name`）。
4. 代码通过 lint：`npm run lint`（提交时也会自动检查 staged 文件）。
5. 若改动 Markdown / Playground 容器语法，请同时检查 `packages/markdown` 与 `packages/playground` 的测试。

## 已知基线问题

以下现象在部分环境下**不是**你的改动导致的回归：

- **全量 `npm run build`**：declaration 生成可能打印 `@deot/vc`、`@vue/repl` 等上游类型告警；以各包最终的 `Success` 为准，且无 `Error! Build failed`。
- **单包 Markdown build**：可能出现大量 declaration 诊断，但 `@deot/docs-markdown: Success` 即表示通过。
- **`npm run cli:build`**：本仓库 README 演示使用根 `index.html` 作为 workspace，不适合作为发布路径（会把 monorepo 源码一并复制）。日常预览请用 `npm run cli:dev` 或 `npm run cli:preview`；直接部署时托管根 `index.html` 与 `404.html` 即可。

## 文档

- 用户向说明见根 [README.md](../README.md) 与各 `packages/*/README.md`。
- 本仓库演示入口是根 [`index.html`](../index.html)（README 聚合），结构与根 README「快速开始」中的通用 `site/` 模板不同。

## 许可证

贡献的代码将按仓库 [LICENSE](../LICENSE)（MIT）发布。
