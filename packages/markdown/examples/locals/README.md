## 标题

:::RUNTIME {"style":"height:200px"}
```vue
<template>
	<Button>123</Button>
</template>
<script setup>
import { Button } from '@deot/vc';
</script>
```
:::

## JavaScript 入口的多文件示例

:::RUNTIME {"entry":"main.js","style":"height:200px"}
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

## Vue SFC 入口的多文件示例

:::RUNTIME {"entry":"App.vue","style":"height:200px"}
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
