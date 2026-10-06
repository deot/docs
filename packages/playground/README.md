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
| `title` | `string` | `''` | 顶栏标题；空串或不传不渲染标题文本。runtime / 双视图始终保留顶栏；files-only 仅在有标题时显示顶栏。带标题时生成锚点（`#` 链接），规则对齐 markdown-it-anchor。 |
| `id` | `string` | `''` | 标题锚点 id；未传时从 `title` 自动生成。仅挂在内联 runtime 标题上，弹窗不重复。 |
| `expandable` | `true \| number` | `undefined` | 开启预览高度展开；未传不显示控件；`true` 展开到剩余视口；正数为目标高度（px）。 |
| `previewScroller` | `boolean` | `false` | 在 iframe 内用 `@deot/vc` Scroller 替换原生滚动条；开启后会动态探测 `Scroller`，不存在则回退原生滚动。 |
| `local` | `boolean` | `false` | 在当前文档编译并挂载，不使用 iframe。`vue` 使用宿主同一份实例；其余 import map 仍是 URL，加载后作为模块变量。 |
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

## 预览内的临时高度

Playground 会在预览应用中注入 `docs:playground`，也可通过 iframe 内的 `window.$docsPlayground` 访问同一服务。适用于 ActionSheet、Modal、Drawer、Message 等依赖视口高度的示例，无需自行撑高 DOM 或轮询 `window.innerHeight`。

```ts
import { inject, ref } from 'vue';
import type { PlaygroundService } from '@deot/docs-playground';

const playground = inject<PlaygroundService>('docs:playground')!;
const visible = ref(false);

// 定义时不执行，点击后先等待高度就绪，再打开弹层；visible 关闭时恢复。
// visible 是 ref 且省略 handler 时，默认执行 visible.value = true。
const handleOpen = playground.run(560, { visible });

// 也可生成 boolean 状态处理函数：true 扩展高度，false 恢复高度。
const handleVisibleChange = playground.run(560);

// 支持 getter 和 computed；不能传入普通 boolean 快照。
const openDrawer = playground.run(560, { visible: () => state.drawerVisible }, () => {
	state.drawerVisible = true;
});

// 回调返回的 Promise 表示弹层关闭时，可省略 options。
const openActionSheet = playground.run(560, async () => {
	await MActionSheet.open({ title: '请选择操作' });
});
```

`run(height)`、`run(height, handler)` 和 `run(height, options, handler)` 均返回事件处理函数。传入 handler 时会透传调用参数和回调结果，最后一个参数始终为 handler。`options` 当前只包含 `visible?: Ref<boolean> | (() => boolean)`；传入可写 `Ref<boolean>` 时可以省略 handler，默认将其设为 `true`。getter 和只读 computed 需要显式 handler。示例中的 `state`、`MActionSheet` 由业务代码提供。

| 接口 | 行为 |
| --- | --- |
| `enable(height): Promise<boolean>` | 设置手动临时高度，等待 iframe 实际高度达到要求后返回 `true`。连续调用替换旧的手动请求。 |
| `disable(): void` | 释放手动请求；重复调用无副作用，不影响 `run` 的请求。 |
| `run(height)` | 返回 boolean 事件处理函数；收到 `true` 时调用 `enable(height)`，收到 `false` 时调用 `disable()`。 |
| `run(height, handler)` | 等待高度后执行；同步返回或 Promise 完成时恢复高度，异常也恢复并继续抛出。 |
| `run(height, { visible: ref })` | 等待高度后默认执行 `visible.value = true`，并在状态关闭时恢复高度。 |
| `run(height, { visible }, handler)` | 执行前监听状态，关闭时恢复；回调完成后未打开或回调抛错时也释放。异步打开流程应由回调返回的 Promise 覆盖。 |

同一个 `run` 返回函数在回调与弹层均结束前会复用当前 Promise，避免重复点击打开；不同函数的请求独立管理并取最大高度。Message / Toast 等立即返回的 API 应通过 `visible` 或关闭回调恢复高度，不能把函数返回当成弹层关闭。

```ts
const handleMessage = async () => {
	if (!await playground.enable(240)) return;
	try {
		Message.info({ content: '已保存', onClose: () => playground.disable() });
	} catch (error) {
		playground.disable();
		throw error;
	}
};
```

高度为正有限 CSS px，表示 iframe 内部可视高度，不包含 `previewInset` 与边框。普通预览取原有高度与临时请求的最大值，释放后恢复当前视口规则；独立窗口受可用屏幕空间限制。等待超时（2 秒）、取消或空间不足时返回 `false`；`run` 在这些情况下不执行回调并返回 `undefined`。

在 `setup` 中创建的 `run` 会随当前 Vue scope 自动取消等待、移除监听并释放高度；其他位置创建时绑定预览应用。手动 `enable/disable` 绑定整个预览应用，子组件单独卸载时按需自行 `disable()`。刷新、重新运行及应用卸载会统一释放请求。服务不取消已经启动的业务任务，也不调用组件的 `destroy()`；示例保留必要的业务 `onUnmounted`，只需删除高度等待使用的 `disposed` 标记。

类型导出为 `PlaygroundService`、`PlaygroundRunOptions` 和 `PlaygroundWindow`。Window 类型可通过 `(window as PlaygroundWindow).$docsPlayground` 显式使用；服务仅存在于 Playground 预览应用，不向普通页面声明必然存在的全局变量。接入项目需使用包含该接口的新版 Playground。

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
| `slugifyPlaygroundTitle(title)` / `resolvePlaygroundTitleId(title, id?)` | 标题锚点 id，规则对齐 markdown-it-anchor。 |
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
- `local` 默认开启：同一份 `files` 在当前文档里编译。内置依赖默认用宿主副本；`modules` 里与默认 CDN 不同的地址会覆盖，包括 `vue` 和 `vue/server-renderer`。直接渲染不撑开预览高度，`expandable` 固定为关闭，`docs:playground.run` 不会申请临时高度；`<DocsLink>` 仍通过 `docs:navigate` 通知。`local: false` 改回 iframe Sandbox。

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
