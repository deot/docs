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

运行时由 `@deot/docs-client` 负责同步 `data-doc-theme` 与 `data-vc-theme`。直接使用 Markdown 或 Playground 时，也可以自行在祖先元素设置这两个属性之一。
