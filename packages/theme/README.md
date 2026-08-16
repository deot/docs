# @deot/docs-theme

`@deot/docs-theme` 提供 `@deot/docs` 各浏览器子包共享的 Light/Dark 类型、语义变量和 SCSS 工具，不包含主题状态、持久化或界面组件。

```scss
@use '@deot/docs-theme/variables';
@use '@deot/docs-theme/functions' as *;

.example {
	color: varfix(foreground-color);
	background: varfix(background-color);
}
```

运行时由 `@deot/docs-client` 负责同步 `data-doc-theme` 与 `data-vc-theme`。直接使用 Markdown、Playground 或 Renderer 时，也可以自行在祖先元素设置这两个属性之一。

语义变量覆盖前景/背景、主色、链接、提示与警告背景，以及成对的 `error-color` 与 `error-background`。组件库已有的颜色继续复用 `--vc-*`。

公共导出包括 `DOCS_THEMES`、`isDocsTheme`，以及 `DocsTheme`、`DocsThemePreference`、`DocsThemeOptions` 类型。

## 仓库内验证

在仓库根目录执行：

```bash
npm run test -- --package-name theme
npm run build -- --package-name theme
```

## 许可证

MIT
