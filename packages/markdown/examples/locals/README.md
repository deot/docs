## Tip / Warning

:::tip
这是一条提示信息，适合补充说明或使用建议。
:::

:::warning
这是一条警告信息，适合提醒风险或易错点。
:::

## 标题

:::playground
<!--
<config lang="json5">
{
	views: ['runtime'],
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
