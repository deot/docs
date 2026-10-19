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
	background: varfix(background-color);
}
```

编译后的 CSS 变量样式可通过 `@deot/docs-theme/style.css` 引入（对应 `dist/index.style.css`）。Markdown、Playground 与 Client 的构建会内联同一份变量，通常不必单独加载。

运行时由 `@deot/docs-client` 负责同步 `data-doc-theme` 与 `data-vc-theme`。直接使用 Markdown、Playground 或 Renderer 时，也可以自行在祖先元素设置这两个属性之一。

语义变量覆盖前景/背景、主色、辅助色、链接、纹理、提示与警告背景，以及错误颜色。命名遵循 `@deot/vc`：通用颜色用 `color-*`，背景用 `background-color-*`，文字用 `foreground-color-*`，边框用 `border-color-*`。明度等级以亮色模式命名，暗色保留对应映射，不要求按同一明度方向排列。

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
			'foreground-color-on-primary': { light: '#ffffff', dark: '#052e16' }
		}
	}
};
```

每个值支持 CSS 颜色字符串或 `{ light: string, dark?: string }`。字符串在亮暗主题共用，也可使用 `light-dark(...)`、`var(...)`、`color-mix(...)`；对象省略 `dark` 或将其留空时沿用 `light`。空白或缺少有效 `light` 的项、未知键会被忽略。颜色值的语法由浏览器解析。

未配置的项使用内置值，各项独立，不会根据主色自动推导背景或文字色。`background-color-primary-light` 表示主色的淡色背景，不是亮色模式主色。`color-secondary` 默认引用 `color-link`；`foreground-color-on-primary` 默认白色，用于 Renderer 实心按钮，可与主色成对设置。

| 配置键 | 用途 |
| --- | --- |
| `color-primary`、`color-secondary` | 主色与辅助色 |
| `color-link`、`color-error` | 链接与错误颜色 |
| `color-mask`、`color-shadow`、`color-pattern` | 遮罩、阴影与纹理 |
| `background-color`、`background-color-deep`、`background-color-deeper` | 背景及加深等级 |
| `background-color-primary-light` | 主色淡色背景 |
| `background-color-code`、`background-color-footer` | 代码与页脚背景 |
| `background-color-tip-light`、`background-color-warning-light`、`background-color-error-light` | 提示、警告与错误背景 |
| `foreground-color`、`foreground-color-light`、`foreground-color-lighter` | 文字及淡化等级 |
| `foreground-color-footer`、`foreground-color-on-primary` | 页脚与主色背景上的文字 |
| `border-color`、`border-color-light` | 边框及淡化等级 |

完整内置色值见 [theme.scss](./src/theme.scss)。直接使用浏览器子包时，仍可通过 `--docs-*` CSS 变量进行局部覆盖。

配色随主题初始化、保存偏好恢复、系统变化与手动切换生效；嵌套显式主题区域会使用对应配色和 `color-scheme`。配色本身不保存到 IndexedDB，Client 会在停止或重新启动时恢复宿主被覆盖的变量。`theme: false` 不应用配色。

Renderer 新建的 Hero、CTA、Features、Steps 默认继承站点色；条目/按钮显式配色优先于 block，block 优先于站点，最后回退到内置值。已有文档的显式颜色保留。VC 组件保留 `--vc-*` 配色；Playground iframe 仅同步亮暗状态，不同步站点配色。

## 变量命名迁移

以下变更同时适用于 SCSS `$theme` 键、`varfix()` 参数及 `--docs-*` CSS 变量；表中省略 CSS 前缀。不保留旧名或兼容别名，外部 CSS / SCSS 引用需要同步迁移，原有色值保持不变。

| 旧名称 | 新名称 |
| --- | --- |
| `primary-color` | `color-primary` |
| `primary-color-light` | `background-color-primary-light` |
| `link-color` | `color-link` |
| `mask-color` | `color-mask` |
| `shadow-color` | `color-shadow` |
| `pattern-fg` | `color-pattern` |
| `error-color` | `color-error` |
| `background-color-soft` | `background-color-deep` |
| `background-color-mute` | `background-color-deeper` |
| `foreground-color-mute` | `foreground-color-lighter` |
| `code-background` | `background-color-code` |
| `footer-background` | `background-color-footer` |
| `footer-foreground` | `foreground-color-footer` |
| `tip-background` | `background-color-tip-light` |
| `warning-background` | `background-color-warning-light` |
| `error-background` | `background-color-error-light` |

其余已有键保持原名，新增 `color-secondary` 和 `foreground-color-on-primary`。Renderer 的 `accent`、`accentSecondary`、`color`、`textColor` 字段保持原名。

## 仓库内验证

在仓库根目录执行：

```bash
npm run test -- --package-name theme
npm run build -- --package-name theme
```

## 许可证

MIT
