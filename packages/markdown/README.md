# @deot/docs-markdown

`@deot/docs-markdown` 提供 Vue 3 Markdown 渲染组件，内置文档指示器、标题锚点、链接识别、tip/warning 容器、代码高亮预览和按需加载的 Playground 容器。

## 安装

```bash
pnpm add @deot/docs-markdown @deot/docs-locale @deot/vc vue
```

## 快速开始

```vue
<template>
	<Markdown :value="source" :locale="zhCN" />
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { Markdown } from '@deot/docs-markdown';
import { zhCN } from '@deot/docs-locale';
import '@deot/docs-markdown/dist/index.style.css';

const source = ref('# Hello @deot/docs');
</script>
```

组件接受 `modelValue` 或 `value` 字符串。当前组件负责渲染，不会修改传入的 Markdown 内容。
`locale` 可显式传入 `Language`；未传入时优先使用上层 `provideLocale()`，否则回退到 `en-US`。

## 文档指示器

指示器默认开启。它会把标题、段落、列表、代码块等文档块压缩成纵向刻度，支持悬停预览、点击定位和拖动浏览：

```vue
<Markdown
	:value="source"
	:indicator="{
		position: 'right',
		preview: true,
		draggable: true,
		height: 'min(72vh, 600px)'
	}"
/>
```

传入 `:indicator="false"` 可以完全关闭；传入 `true` 或省略该属性时使用默认配置。对象支持以下参数：

| 参数 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `preview` | `boolean` | `true` | 是否展示悬停摘要。 |
| `draggable` | `boolean` | `true` | 是否允许拖动快速浏览。 |
| `position` | `'left' \| 'right'` | `'right'` | 指示器所在侧。 |
| `top` | `number \| string` | `0` | 相对滚动容器垂直中心的偏移，默认上下居中。 |
| `height` | `number \| string` | `min(72vh, 600px)` | 指示器的可视高度。 |

## Markdown 扩展

### 提示容器

````markdown
:::tip
这是一段提示。
:::

:::warning
这是一段警告。
:::
````

### 单文件 Playground

````markdown
:::playground
```vue
<template>
	<strong>Hello Playground</strong>
</template>
```
:::
````

### 多文件 Playground

多文件模式要求每个 fence 声明唯一文件名。可以在 HTML 注释中的 JSON5 配置里指定入口、视图和视口：

````markdown
:::playground
<!--
<config lang="json5">
{
	entry: 'main.js',
	views: ['runtime', 'files'],
	viewport: 375,
	viewportOptions: ['auto', 375, [375, 667]]
}
</config>
-->
```js main.js
import { createApp } from 'vue';
import App from './App.vue';

createApp(App).mount('#app');
```
```vue App.vue
<template>
	<h1>Hello</h1>
</template>
```
:::
````

支持的 `views` 值为 `runtime` 和 `files`。`viewport` 可为 `auto`、正数宽度或 `[width, height]`。
`expand` 为可选：`true` 展开到剩余视口，正数为展开目标高度（px）；未配置时不显示展开控件。

Playground 会在浏览器里编译 Vue SFC 的 `<style lang="scss">` 以及独立 `.scss` / `.sass` 文件。下划线 partial（如 `_variables.scss`）只作为 `@use` 依赖，不会单独注入预览。

Playground 只在页面出现 fence 或 `:::playground` 时动态加载。使用 Playground 容器时，还需要加载 `@deot/docs-playground/dist/index.style.css` 和宿主应用使用的 `@deot/vc-components` 样式。

## 公共 API

| 导出 | 说明 |
| --- | --- |
| `Markdown` | Vue Markdown 渲染组件。 |
| `parseMarkdownSearchSections(content)` | 使用渲染器相同的标题锚点规则提取文档标题、正文和小节，供搜索索引使用。 |

类型：`MarkdownSearchDocument`、`MarkdownSearchSection`、`MarkdownIndicatorConfig`、`MarkdownIndicatorOptions`、`MarkdownPlaygroundConfig`、`MarkdownPlaygroundMountProps`。

底层 markdown-it 实例和内部指令不是包入口的公共导出。搜索解析结果不会包含代码围栏和 HTML 内容。

## 仓库内 examples

在 monorepo 根目录执行 `npm run dev` 可预览 [`packages/markdown/examples`](examples/) 下的 Markdown 与 Playground 容器示例。

## 仓库内验证

在仓库根目录执行：

```bash
npm run test -- --package-name markdown
npm run build -- --package-name markdown
```

## 许可证

MIT
