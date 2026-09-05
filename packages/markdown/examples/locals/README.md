# Markdown 格式示例

这是一份用于预览 Markdown 渲染效果的示例文档，可作为后续调整主题样式时的视觉回归基准。页标题是文档里唯一的 H1，紧跟的这一段是 16px 导语。

## 概览

H2 默认是章节标题（18px / 字重 600 / 上边距 80px）。当 H2 后面紧跟 H3 时，H2 会变成 12px 大写等宽眉题，紧跟的 H3 上边距收成 24px，成为实际小节标题。

## Examples

### 基础示例

上面的 Examples 是眉题，这一节是 H3。标题下第一段上边距 24px。

#### 四级标题与 `code`

H4 为 14px / 字重 600，上边距 48px；标题内 `` `code` `` 字重应为 600。

##### 五级标题

H5 为 14px，上边距 40px；标题下第一段上边距 24px。

###### 六级标题

H6 为 14px / 字重 500，上边距 32px；标题下第一段上边距 24px。

### 连续小节

当前面不是 H2 时，H3 上边距是 64px。

## 段落与行内格式

这是一个普通段落。段落中可以包含 **粗体文本**、*斜体文本*、~~删除线文本~~、`行内代码`，以及[普通链接](https://example.com)。

需要在同一段中强制换行时，可以使用 HTML 的 `<br>`。<br>
这段文字会显示在上一行的下方。

Markdown 也会自动识别链接：https://example.com。

按 <kbd>⌘</kbd> + <kbd>K</kbd> 打开搜索。

## 引用

> 这是一段引用文本。
>
> 引用中可以包含 **强调内容**，也可以包含多段文字。
>
> > 这是嵌套引用。

## 列表

### 无序列表

- 第一项
- 第二项
  - 二级项目
  - 另一个二级项目
- 第三项

### 有序列表

1. 第一步
2. 第二步
   1. 子步骤一（嵌套仍应显示为 `1.` / `2.`，不要变成 `i.` / `a.`）
   2. 子步骤二
3. 第三步

### 包含段落的列表

- 列表项的第一段。

  列表项的第二段，用于观察多段内容的间距。

- 包含 `行内代码` 和 **强调文字** 的列表项。

## 表格

| 对齐方式 | 示例内容 | 说明 |
| :--- | :---: | ---: |
| 左对齐 | 居中 | 右对齐 |
| 文本 | `code` | 100 |
| **粗体** | [链接](https://example.com) | 200 |

表内 `` `code` `` 字号应为 13px，比正文行内代码略小。

## 图片

<figure>
<img src="https://dummyimage.com/672x378/d1d5dc/364153.png&text=Figure" alt="示例配图" />
<figcaption>居中斜体图注：dummyimage.com 动态生成的示例图</figcaption>
</figure>

独立 Markdown 图片（`![]()`）同样居中：

![Markdown 图片](https://dummyimage.com/480x270/d1d5dc/364153.png&text=Markdown)

## 分隔线

上方内容

---

## After the break

分隔线是 5% 发丝线，上下间距 64px；后面紧跟的 H2 上边距也是 64px，而不是默认的 80px。

## 代码

行内代码示例：`const message = 'Hello Markdown';`

```ts
interface User {
	name: string;
	age: number;
}

const user: User = {
	name: 'Deot',
	age: 18
};
```

```markdown
# Heading

Paragraph with **bold** and `inline code`.
```

## HTML 内容

<details>
<summary>与传统 CSS 相比有什么不同？</summary>

传统写法里，同一个 class 会随状态做不同的事。

展开后内容与 summary 间距 24px，容器是 12px 圆角细边框、无底色。

</details>

## Tip / Warning

空心描边（默认）：

:::tip
这是一条提示信息，适合补充说明或使用建议。

- 可嵌套列表与 `行内代码`
- 也可放 [普通链接](https://example.com)
:::

:::warning
这是一条警告信息，适合提醒风险或易错点。

1. 先核对配置里的 `token`
2. 再确认环境变量是否已注入
:::

品牌色块（`:::tip filled` / `:::warning filled`）：

:::tip filled
这是一条提示信息，适合补充说明或使用建议。

- 可嵌套列表与 `行内代码`
- 也可放 [普通链接](https://example.com)
:::

:::warning filled
这是一条警告信息，适合提醒风险或易错点。

1. 先核对配置里的 `token`
2. 再确认环境变量是否已注入
:::

## Playground 基础示例

:::playground
<!--
<config lang="json5">
{
	views: ['runtime'],
	title: '基础示例',
}
</config>
-->
```vue
<template>
	<Button @click="expanded = !expanded">切换高度</Button>
	<div v-if="expanded" style="height: 220px">展开的内容</div>
</template>
<script setup>
import { ref } from 'vue';
import { Button } from '@deot/vc';

const expanded = ref(false);
</script>
```
:::

## 响应式运行时尺寸

:::playground
<!--
<config lang="json5">
{
	viewport: 'auto',
	viewportOptions: ['auto', 375, [375, 667], 768],
}
</config>
-->
```vue
<template>
	<div class="viewport-demo">
		当前内容会在 375px 视口下切换为移动端布局
	</div>
</template>

<style>
.viewport-demo {
	padding: 16px;
	background: #e8eef8;
}

@media (max-width: 400px) {
	.viewport-demo {
		color: #fff;
		background: #5495f6;
	}
}
</style>
```
:::

## 仅文件预览

:::playground
<!--
<config lang="json5">
{
	entry: 'main.js',
	views: ['files'],
}
</config>
-->
```js main.js
import { createApp } from 'vue';
import App from './App.vue';

createApp(App).mount('#app');
```

```vue App.vue
<script setup>
import { message } from './message.js';
</script>

<template>
	<h2>{{ message }}</h2>
</template>
```

```js message.js
export const message = 'Hello from RUNTIME files';
```
:::

## 文件预览 / 运行时预览

:::playground
<!--
<config lang="json5">
{
	entry: 'App.vue',
	views: ['files', 'runtime'],
}
</config>
-->
```vue App.vue
<script setup>
import Child from './Child.vue';
</script>

<template>
	<Child label="Imported child component" />
</template>
```

```vue Child.vue
<script setup>
defineProps({ label: String });
</script>

<template>
	<strong>{{ label }}</strong>
</template>
```
:::

## 运行时预览 / 文件预览

:::playground
<!--
<config lang="json5">
{
	entry: 'App.vue',
	views: ['runtime', 'files'],
}
</config>
-->
```vue App.vue
<script setup>
import Child from './Child.vue';
</script>

<template>
	<Child label="Runtime first" />
</template>
```

```vue Child.vue
<script setup>
defineProps({ label: String });
</script>

<template>
	<strong>{{ label }}</strong>
</template>
```
:::

## 固定高度运行时预览

:::playground
<!--
<config lang="json5">
{
	views: ['runtime'],
	style: 'height:200px',
}
</config>
-->
```vue
<template>
	<div style="height: 320px">固定 200px，内部可滚动</div>
</template>
```
:::

## 在线 SCSS

Vue SFC 的 `<style lang="scss">` 和独立 `.scss` 文件会在浏览器里编译。`_partial.scss` 只作为 `@use` 依赖，不会单独注入预览。

:::playground
<!--
<config lang="json5">
{
	entry: 'App.vue',
	views: ['runtime', 'files'],
}
</config>
-->
```vue App.vue
<template>
	<p class="scss-box">SCSS playground</p>
</template>

<style lang="scss">
@use './variables' as *;

.scss-box {
	color: $accent;
	padding: 8px;
}
</style>
```

```scss _variables.scss
$accent: #c2410c;
```

```scss theme.scss
.scss-box {
	font-weight: 600;
}
```
:::

## 普通代码块

```vue
<script setup>
defineProps({ label: String });
</script>

<template>
	<strong>{{ label }}</strong>
</template>
```

:::playground
<!--
<config lang="json5">
{
	expandable: true
}
</config>
-->
```vue
<template>
	<Button type="primary" @click="visible = true">Open Modal</Button>
	<Modal v-model="visible" title="Demo">Modal content</Modal>
</template>
<script setup>
import { ref } from 'vue';
import { Button, Modal } from '@deot/vc';

const visible = ref(false);
</script>
```
:::

