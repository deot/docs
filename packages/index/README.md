# @deot/docs

`@deot/docs` 是 `@deot/docs` 工具链的聚合包。公共入口导出 `Dever`、`Locale` 与 `Theme` 命名空间，分别用于文档服务、界面国际化和主题协议。

## 安装

```bash
pnpm add @deot/docs
```

## 快速开始

```ts
import { Dever } from '@deot/docs';

const config = Dever.createDeverConfig({
	workspace: 'site'
});
```

也可以直接运行指定模式：

```ts
import { Dever } from '@deot/docs';

await Dever.run({
	workspace: 'site',
	preview: true
});
```

`dev` 会启动常驻的 Vite 开发服务；`preview` 使用无 watcher 的静态 HTTP 服务；`build` 完成一次构建后退出。

## 公共 API

| 导出 | 说明 |
| --- | --- |
| `Dever.run(options)` | 运行 development、build 或 preview 模式。 |
| `Dever.createDeverConfig(options)` | 根据当前工作目录和选项生成 Vite 配置。 |
| `Dever.getDeverMode(options)` | 返回 `development`、`build` 或 `preview`。 |
| `Dever.DeverOptions` | `@deot/docs-dever` 提供的运行选项类型。 |
| `Dever.DeverMode` | 三种运行模式的联合类型。 |
| `Locale` | `@deot/docs-locale` 的语言包、Translator 与 Vue Provider API。 |
| `Theme` | `@deot/docs-theme` 的主题类型、主题值和校验函数。 |

更完整的选项和运行规则请查看 [`@deot/docs-dever`](../dever/README.md)。命令行用法请查看 [`@deot/docs-cli`](../cli/README.md)。

## 仓库内验证

在仓库根目录执行：

```bash
npm run test -- --package-name index
npm run build -- --package-name index
```

## 许可证

MIT
