# @deot/docs-playground

`@deot/docs-playground` 是基于 Vue REPL 的浏览器代码预览组件，支持单文件或多文件运行、文件浏览与编辑、响应式视口、代码高亮和父页面导航事件。

## 安装

```bash
pnpm add @deot/docs-playground @deot/docs-locale @deot/vc vue
```

## 快速开始

```vue
<template>
	<Playground
		v-model:files="files"
		v-model:entry="entry"
		v-model:viewport="viewport"
		:views="['runtime', 'files']"
		:viewport-options="['auto', 375, [375, 667]]"
		:locale="zhCN"
	/>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { Playground } from '@deot/docs-playground';
import { zhCN } from '@deot/docs-locale';
import '@deot/docs-playground/dist/index.style.css';

const entry = ref('App.vue');
const viewport = ref<'auto' | number | [number, number]>('auto');
const files = ref({
	'App.vue': `<template><h1>Hello Playground</h1></template>`
});
</script>
```

宿主应用还需要加载 `@deot/vc-components` 的组件样式。本仓库示例使用 `/node_modules/@deot/vc-components/dist/index.style.css`。

## Playground 属性

| 属性 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `modelValue` | `string` | `''` | 单文件模式的入口 SFC 内容。 |
| `files` | `Record<string, string>` | `{}` | 多文件源码映射。非空时优先于 `modelValue`。 |
| `entry` | `string` | `''` | 入口文件；未设置时使用文件映射的第一项。 |
| `views` | `('runtime' \| 'files')[]` | `['runtime']` | 可用视图及初始视图顺序。 |
| `viewport` | `'auto' \| number \| [number, number]` | `'auto'` | 运行时宽度，或固定宽高。 |
| `viewportOptions` | `PlaygroundViewport[]` | `['auto', 375]` | 可切换的视口列表。 |
| `styleless` | `boolean` | `false` | 只渲染无工具栏的运行时预览。 |
| `expandable` | `true \| number` | `undefined` | 开启预览高度展开；未传不显示控件；`true` 展开到剩余视口；正数为目标高度（px）。 |
| `options` | `PlaygroundOptions` | `{}` | 传给 Vue REPL store 的实例级选项；`cdnURL` 会同时作用于预览样式和默认 import map。 |
| `previewOptions` | `SandboxProps['previewOptions']` | `undefined` | 传给当前 iframe 的 preview 选项。 |
| `locale` | `Language` | `en-US` | 界面语言；未传入时使用上层 Locale Provider。 |

## 事件与双向绑定

| 事件 | 说明 |
| --- | --- |
| `update:modelValue` | 入口文件内容更新。 |
| `update:files` | 文件映射更新。 |
| `update:entry` | 入口文件更新。 |
| `update:viewport` | 视口更新。 |
| `change` | 当前入口内容被编辑。 |
| `navigate` | iframe 内的 `<DocsLink to="...">` 请求父页面导航。 |

Playground 只接受来自自身 iframe 的导航消息。宿主应用应监听 `navigate` 并交给自己的 Router 处理。

## 其他公共导出

| 导出 | 说明 |
| --- | --- |
| `CodePreview` | 带语言标识、复制按钮和高亮的只读代码预览。 |
| `Editor` | 基于 `@deot/vc` Portal 的共享文件编辑器入口。 |
| `highlightCode(code, filename)` | 按文件名识别语言并返回高亮 HTML。 |
| `highlightCodeByLanguage(code, language)` | 按显式语言高亮。 |
| `resolveHighlightLanguage(filename)` | 将常见扩展名映射为 highlight.js 语言。 |
| `registerVueHighlight(api?)` | 向 highlight.js 注册 Vue SFC 语法。 |
| `vueHighlight` | Vue SFC 的 highlight.js 语言定义。 |
| `DEFAULT_CDN_URL` | 默认 CDN 根地址（jsDelivr）。 |
| `createBuiltinImports(cdnURL?)` / `createBuiltinStyles(cdnURL?)` | 按 CDN 生成内置 import map 与预览样式表 URL。 |
| `normalizeCdnURL(value?)` | 规范化 CDN 根地址。 |

同时导出 `PlaygroundFiles`、`PlaygroundView`、`PlaygroundViewport`、`PlaygroundOptions`、`PlaygroundPreviewOptions`、`EditorFilesChange` 和 `EditorFilesChangeAction` 类型。

站点级 Playground 模块与预览 CSS 默认由 Client 的 `$docs.modules` 与 `$docs.styles` 管理（见 [`@deot/docs-client`](../client/README.md)）。独立嵌入 Playground 时，可通过 `options.builtinImportMap` 与 `options.cdnURL` 覆盖实例级配置。

## 运行环境

- Playground 运行时通过公共 CDN 加载 Vue 和默认 import map 中的依赖，手工预览需要网络访问。
- 默认 CDN 为 `https://cdn.jsdelivr.net/npm`，可通过 `options.cdnURL` 换成 unpkg 等兼容 `/{package}/{file}` 路径的镜像；该地址用于预览样式和内置 import map。
- `lodash-es` 和在线 Sass 编译器使用 jsDelivr 的 `/+esm` 入口；unpkg 等 CDN 不支持该路径。
- Vue SFC 的 `<style lang="scss">` / `lang="sass"` 以及独立 `.scss` / `.sass` 文件会在浏览器里编译；`_partial.scss` 只作为 `@use` 依赖。
- `options.builtinImportMap.imports` 可以覆盖默认模块 URL。Vue 运行时仍从 `play.vuejs.org` 加载。
- 每个 Playground 实例都使用自己的 preview 配置和 iframe 消息来源校验。

## 仓库内 examples

在 monorepo 根目录执行 `npm run dev` 可预览 [`packages/playground/examples`](examples/) 下的单文件与多文件 Playground 示例。

## 仓库内验证

在仓库根目录执行：

```bash
npm run test -- --package-name playground
npm run build -- --package-name playground
```

## 许可证

MIT
