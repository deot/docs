# @deot/docs-theme

`@deot/docs-theme` 提供 `@deot/docs` 各浏览器子包共享的 Light/Dark 类型、语义变量和 SCSS 工具，不包含主题状态、持久化或界面组件。

## 安装

```bash
pnpm add @deot/docs-theme
```

## SCSS 与 CSS

```scss
@use '@deot/docs-theme/variables';
@use '@deot/docs-theme/functions' as *;
@use '@deot/docs-theme/mixins' as *;
@use '@deot/docs-theme/theme';

.example {
	color: varfix(foreground-color);
	background: varfix(background-color-lightest);
}
```

编译后的 CSS 变量样式可通过 `@deot/docs-theme/style.css` 引入（对应 `dist/index.style.css`）。Markdown、Playground 与 Client 的构建会内联同一份变量，通常不必单独加载。

运行时由 `@deot/docs-client` 负责同步 `data-doc-theme` 与 `data-vc-theme`。直接使用 Markdown、Playground 或 Renderer 时，也可以自行在祖先元素设置这两个属性之一。

语义变量覆盖前景/背景、主色、辅助色、链接、纹理、提示与警告背景，以及错误颜色。命名与等级参考 `@deot/vc`，默认色值保留 Docs 原有配色，使用独立的 `--docs-*` 前缀及链接、代码块等专用颜色。通用颜色用 `color-*`，背景用 `background-color-*`，文字用 `foreground-color-*`，边框用 `border-color-*`。明度等级以亮色模式命名，暗色保留对应映射。

公共导出包括 `DOCS_THEMES`、`DOCS_THEME_COLOR_KEYS`、`isDocsTheme`，以及 `DocsTheme`、`DocsThemePreference`、`DocsThemeColorKey`、`DocsThemeColor`、`DocsThemeOptions` 类型。Client 也导出这些类型。

## 站点配色

Client 通过 `$docs.theme.colors` 配置站点语义色，键名省略 `--docs-` 前缀：

```ts
window.$docs = {
	// 其他站点配置
	theme: {
		default: 'system',
		colors: {
			'color-primary': { light: '#15803d', dark: '#86efac' },
			'color-secondary': 'light-dark(#4338ca, #a5b4fc)',
			'background-color-primary-light': { light: '#f0fdf4', dark: '#143322' },
			'color-contrast-light': '#ffffff'
		}
	}
};
```

每个值支持 CSS 颜色字符串或 `{ light: string, dark?: string }`。字符串在亮暗主题共用，也可使用 `light-dark(...)`、`var(...)`、`color-mix(...)`；对象省略 `dark` 或将其留空时沿用 `light`。空白或缺少有效 `light` 的项、未知键会被忽略。颜色值的语法由浏览器解析。

未配置的项使用内置值，各项独立，不会根据主色自动推导背景或文字色。`background-color-primary-light` 表示主色的淡色背景，不是亮色模式主色。`color-secondary` 默认引用 `color-link`；`color-contrast-light` 默认固定白色，不随亮暗主题反转，用于 Renderer 实心按钮文字。

`background-color` 用于 Client 页面底色；`background-color-lightest` 用于 Header、侧栏、表格、分页、弹层、编辑器等模块的背景。两者默认均为亮色 `#fff`、暗色 `#171b24`，可分别配置。正文滚动容器和筛选栏保留透明背景，透出各自外层的页面底色。`background-color-light` 和 `background-color-lighter` 保留原有两级灰色表面背景。正文、次要和强调文字分别使用 `foreground-color`、`foreground-color-light`、`foreground-color-dark`，对应原有文字层级与色值。

| 配置键 | 用途 |
| --- | --- |
| `color-primary`、`color-secondary` | 主色与辅助色 |
| `color-link`、`color-error` | 链接与错误颜色 |
| `color-contrast-light` | 固定亮色对比色 |
| `color-mask`、`color-shadow-fixed`、`color-pattern` | 遮罩、阴影与纹理 |
| `color-neutral-light` | 浅色中性分隔线 |
| `background-color` | 页面底色 |
| `background-color-light`、`background-color-lighter`、`background-color-lightest` | 表面背景等级 |
| `background-color-primary-light` | 主色淡色背景 |
| `background-color-code`、`background-color-footer` | 代码与页脚背景 |
| `background-color-tip-light`、`background-color-warning-light`、`background-color-error-light` | 提示、警告与错误背景 |
| `foreground-color`、`foreground-color-light`、`foreground-color-dark` | 正文、次要与强调文字 |
| `foreground-color-footer` | 页脚文字 |
| `border-color` | 边框 |

完整内置色值见 [theme.scss](./src/theme.scss)。直接使用浏览器子包时，仍可通过 `--docs-*` CSS 变量进行局部覆盖。

配色随主题初始化、保存偏好恢复、系统变化与手动切换生效；嵌套显式主题区域会使用对应配色和 `color-scheme`。配色本身不保存到 IndexedDB，Client 会在停止或重新启动时恢复宿主被覆盖的变量。`theme: false` 不应用配色。

Renderer 新建的 Hero、CTA、Features、Steps 默认继承站点色；条目/按钮显式配色优先于 block，block 优先于站点，最后回退到内置值。已有文档的显式颜色保留。VC 组件保留 `--vc-*` 配色；Playground iframe 仅同步亮暗状态，不同步站点配色。

## 变量命名迁移

以下变更同时适用于 SCSS `$theme` 键、`varfix()` 参数及 `--docs-*` CSS 变量；表中省略 CSS 前缀。不保留旧名或兼容别名，外部 CSS / SCSS 引用需要同步迁移。命名变化保留原有默认色值，文字变量按视觉角色对应，不能只替换等级后缀。

| 旧名称 | 新名称 |
| --- | --- |
| `primary-color` | `color-primary` |
| `primary-color-light` | `background-color-primary-light` |
| `link-color` | `color-link` |
| `mask-color` | `color-mask` |
| `shadow-color`、`color-shadow` | `color-shadow-fixed` |
| `pattern-fg` | `color-pattern` |
| `error-color` | `color-error` |
| 原白底模块使用的 `background-color` | `background-color-lightest` |
| `background-color-soft`、`background-color-deep` | `background-color-light` |
| `background-color-mute`、`background-color-deeper` | `background-color-lighter` |
| 原强调文字使用的 `foreground-color` | `foreground-color-dark` |
| 原正文使用的 `foreground-color-light` | `foreground-color` |
| `foreground-color-mute`、`foreground-color-lighter` | `foreground-color-light` |
| `foreground-color-on-primary` | `color-contrast-light` |
| `border-color-light` | `color-neutral-light` |
| `code-background` | `background-color-code` |
| `footer-background` | `background-color-footer` |
| `footer-foreground` | `foreground-color-footer` |
| `tip-background` | `background-color-tip-light` |
| `warning-background` | `background-color-warning-light` |
| `error-background` | `background-color-error-light` |

`background-color` 与 `background-color-lightest` 分别表示页面和模块背景，默认保持原有白底。Renderer 的 `accent`、`accentSecondary`、`color`、`textColor` 字段保持原名；显式文档配色继续优先。

## 仓库内验证

在仓库根目录执行：

```bash
npm run test -- --package-name theme
npm run build -- --package-name theme
```

## 许可证

MIT
