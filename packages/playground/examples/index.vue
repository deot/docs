<template>
	<div class="playground-examples">
		<h2>仅运行时预览</h2>
		<Playground v-model="source" :views="['runtime']" />

		<h2>仅文件预览</h2>
		<Playground
			v-model:files="javascriptFiles"
			v-model:entry="javascriptEntry"
			:views="['files']"
		/>

		<h2>文件预览 / 运行时预览</h2>
		<Playground
			v-model:files="javascriptFiles"
			v-model:entry="javascriptEntry"
			:views="['files', 'runtime']"
		/>

		<h2>运行时预览 / 文件预览</h2>
		<Playground
			v-model:files="vueFiles"
			v-model:entry="vueEntry"
			:views="['runtime', 'files']"
		/>
	</div>
</template>
<script setup>
import { ref } from 'vue';
import { Playground } from '@deot/docs-playground';
import '/node_modules/@deot/vc-components/dist/index.style.css';

// eslint-disable-next-line @stylistic/max-len
const source = ref(`<script setup>\nimport { ref } from 'vue'\n\nconst msg = ref('Hello World!!')\n<\/script>\n\n<template>\n  <h1>{{ msg }}<\/h1>\n  <input v-model="msg" />\n<\/template>\n`);
const javascriptEntry = ref('main.js');
const javascriptFiles = ref({
	'main.js': `import { createApp } from 'vue';\nimport App from './App.vue';\n\ncreateApp(App).mount('#app');\n`,
	'App.vue': `<script setup>\nimport { message } from './message.js';\n<\/script>\n\n<template>\n  <h2>{{ message }}<\/h2>\n<\/template>\n`,
	'message.js': `export const message = 'Hello from a JavaScript entry';\n`
});
const vueEntry = ref('App.vue');
const vueFiles = ref({
	'App.vue': `<script setup>\nimport Card from './Card.vue';\n<\/script>\n\n<template>\n  <Card title="Vue SFC entry" />\n<\/template>\n`,
	'Card.vue': `<script setup>\ndefineProps({ title: String });\n<\/script>\n\n<template>\n  <strong>{{ title }}<\/strong>\n<\/template>\n`
});
</script>
<style lang="scss" scoped>
@use '../src/style' as *;

@include block(playground-examples) {
	padding: 24px;
}
</style>
