# @deot/docs-markdown

`@deot/docs-markdown` 提供 Vue 3 Markdown 渲染组件，内置标题锚点、链接识别、tip/warning 容器、代码高亮预览和按需加载的 Playground 容器。

## 安装

```bash
pnpm add @deot/docs-markdown vue
```

## 快速开始

```vue
<template>
	<Markdown :value="source" />
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { Markdown } from '@deot/docs-markdown';
import '@deot/docs-markdown/dist/index.style.css';

const source = ref('# Hello @deot/docs');
</script>
```

组件接受 `modelValue` 或 `value` 字符串。当前组件负责渲染，不会修改传入的 Markdown 内容。

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

Playground 只在页面出现 fence 或 `:::playground` 时动态加载。使用 Playground 容器时，还需要加载 `@deot/docs-playground/dist/index.style.css` 和宿主应用使用的 `@deot/vc-components` 样式。

## 公共 API

| 导出 | 说明 |
| --- | --- |
| `Markdown` | Vue Markdown 渲染组件。 |

底层 markdown-it 实例和内部指令不是包入口的公共导出。

## 仓库内验证

在仓库根目录执行：

```bash
npm run test -- --package-name markdown
npm run build -- --package-name markdown
```

## 许可证

MIT
