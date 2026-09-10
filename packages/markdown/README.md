# @deot/docs-markdown

`@deot/docs-markdown` 提供 Vue 3 Markdown 渲染组件，内置文档指示器、标题锚点、链接识别、tip/warning 容器、tabs 分栏、代码高亮预览和按需加载的 Playground 容器。

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
`theme` 控制排版皮肤（`'default' | 'traditional'`），与站点 light/dark 正交。
`playground` 可传入站点级 Playground 默认 props；`:::playground` 块内 JSON5 配置会浅合并覆盖这些默认值。

## 文档指示器

指示器默认开启。它是贴在正文一侧的**小地图**（空间 scrubber），不是第二份目录：刻度与文档壳大纲使用同一份标题（有章节标题时不含页面 h1），按标题在正文中的纵向比例铺在固定高度条上，并用可视窗口标出当前主滚动范围。支持悬停预览、点击定位和拖动浏览，**只滚动、不改 hash**。章节名称导航仍由文档壳右侧大纲负责。

定位与文档壳大纲一致：`sticky` 贴顶，高度按正文与主滚动可视区域封顶，轨道上下 padding 为 `40px / 96px`。

```vue
<Markdown
	:value="source"
	:indicator="{
		position: 'left',
		preview: true,
		draggable: true,
		top: 0,
		height: 480
	}"
/>
```

传入 `:indicator="false"` 可以完全关闭；传入 `true` 或省略该属性时使用默认配置。对象支持以下参数：

| 参数 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `preview` | `boolean` | `true` | 是否展示悬停摘要。 |
| `draggable` | `boolean` | `true` | 是否允许拖动快速浏览。关闭后仍可点击轨道定位。 |
| `position` | `'left' \| 'right'` | `'left'` | 指示器所在侧。文档壳中有斜纹轨时靠近 `rail--start` 右侧或 `rail--end` 左侧，并留 8px 间距。 |
| `top` | `number \| string` | `0` | sticky 贴顶偏移，数字按 px 处理。 |
| `height` | `number \| string` | 按正文/视口封顶 | 小地图总高度（含上下 padding）。数字会与封顶值取较小值；未配置时使用封顶后的 px。 |

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

### Tabs 分栏

每一栏用 **4 个反引号** 的 fence（info 为 `markdown <标题>`），这样栏内还能写普通 ` ``` ` 代码块。切换时写入 `?tab=<id>`（标题小写、空白变 `-`；非 ASCII 与标题锚点一致做 `encodeURIComponent`）。

`````markdown
:::tabs
````markdown Linux
Linux 安装步骤，可含普通代码块：

```ts
const value = 1;
```
````
````markdown Android
Android 安装步骤。
````
:::
`````

栏内若再嵌套 `:::tip` / `:::playground` / `:::warning`，外层必须加长冒号（`::::tabs` … `::::`）。`markdown-it-container` 会按「足够长的纯 `:::` 行」闭合外层，内层结束标记会提前关掉 `:::tabs`。

``````markdown
::::tabs
````markdown Demo
:::tip
嵌套提示。
:::
````
::::
``````

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
	title: '多文件示例',
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
`title` 为可选字符串，显示在运行时顶栏左侧；空串或不传不渲染。有标题时会生成锚点 id（可用 `#...` 跳转），规则与 markdown heading 一致；也可用 `id` 显式覆盖。
`expandable` 为可选：`true` 展开到剩余视口，正数为展开目标高度（px）；未配置时不显示展开控件。
`previewScroller` 为可选布尔值：开启后在 iframe 内用 `@deot/vc` Scroller 替换原生滚动条；会动态探测 `Scroller`，不存在则回退。

Playground 会在浏览器里编译 Vue SFC 的 `<style lang="scss">` 以及独立 `.scss` / `.sass` 文件。下划线 partial（如 `_variables.scss`）只作为 `@use` 依赖，不会单独注入预览。

Playground 只在页面出现 fence 或 `:::playground` 时动态加载。使用 Playground 容器时，还需要加载 `@deot/docs-playground/dist/index.style.css` 和宿主应用使用的 `@deot/vc-components` 样式。

## 公共 API

| 导出 | 说明 |
| --- | --- |
| `Markdown` | Vue Markdown 渲染组件。 |
| `parseMarkdownSearchSections(content)` | 使用渲染器相同的标题锚点规则提取文档标题、正文和小节，供搜索索引使用。 |
| `toMarkdownTabId(title)` | 将 Tab 标题转为 `?tab=` id。 |
| `markdownTabQueryKey` / `createHistoryTabQueryAdapter` | 文档壳可 `provide` Router 版适配器；独立预览回退 history。 |

类型：`MarkdownSearchDocument`、`MarkdownSearchSection`、`MarkdownIndicatorConfig`、`MarkdownIndicatorOptions`、`MarkdownPlaygroundConfig`、`MarkdownPlaygroundMountProps`、`MarkdownTabQueryAdapter`。

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
