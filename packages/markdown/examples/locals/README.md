## 标题

:::RUNTIME {"views":["runtime"]}
```vue
<template>
	<Button @click="expanded = !expanded">切换高度</Button>
	<div v-if="expanded" style="height: 220px">异步展开内容</div>
	<img
		alt="自动高度图片"
		:src="image"
	>
</template>
<script setup>
import { ref } from 'vue';
import { Button } from '@deot/vc';

const expanded = ref(false);
const image = [
	'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22',
	' width=%22120%22 height=%2240%22%3E%3Crect width=%22120%22 height=%2240%22',
	' fill=%22%235495f6%22/%3E%3C/svg%3E'
].join('');
setTimeout(() => (expanded.value = true), 300);
</script>
```
:::

## 响应式运行时尺寸

:::RUNTIME {"viewport":"auto","viewportOptions":["auto",375,[375,667],768]}
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

:::RUNTIME {"entry":"main.js","views":["files"] }
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

:::RUNTIME {"entry":"App.vue","views":["files","runtime"]}
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

:::RUNTIME {"entry":"App.vue","views":["runtime","files"]}
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

:::RUNTIME {"views":["runtime"],"style":"height:200px"}
```vue
<template>
	<div style="height: 320px">固定 200px，内部可滚动</div>
</template>
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
