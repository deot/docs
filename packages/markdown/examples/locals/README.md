## 标题

:::RUNTIME {"views":["runtime"],"style":"height:200px"}
```vue
<template>
	<Button>123</Button>
</template>
<script setup>
import { Button } from '@deot/vc';
</script>
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

:::RUNTIME {"entry":"App.vue","views":["runtime","files"],"style":"height:200px"}
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
