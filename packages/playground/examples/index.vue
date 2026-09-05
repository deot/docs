<template>
	<div class="playground-examples">
		<h2>仅运行时预览</h2>
		<Playground v-model="source" :views="['runtime']" />

		<h2>响应式运行时尺寸</h2>
		<Playground
			v-model="source"
			v-model:viewport="viewport"
			:viewport-options="viewportOptions"
		/>
		<p>当前视口：{{ JSON.stringify(viewport) }}</p>

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
			expandable
			:views="['runtime', 'files']"
		/>

		<h2>在线 SCSS</h2>
		<Playground
			v-model:files="scssFiles"
			v-model:entry="scssEntry"
			:views="['runtime', 'files']"
		/>
	</div>
</template>
<script setup>
import { ref } from 'vue';
import { Playground } from '@deot/docs-playground';
import '/node_modules/@deot/vc-components/dist/index.style.css';
import sourceText from './fixtures/source.vue?raw';
import javascriptMain from './fixtures/javascript/main.js?raw';
import javascriptApp from './fixtures/javascript/App.vue?raw';
import javascriptMessage from './fixtures/javascript/message.js?raw';
import vueApp from './fixtures/vue/App.vue?raw';
import vueCard from './fixtures/vue/Card.vue?raw';
import scssApp from './fixtures/scss/App.vue?raw';
import scssVariables from './fixtures/scss/_variables.scss?raw';
import scssTheme from './fixtures/scss/theme.scss?raw';

const source = ref(sourceText);
const viewport = ref('auto');
const viewportOptions = ['auto', 375, [375, 667], 768];
const javascriptEntry = ref('main.js');
const javascriptFiles = ref({
	'main.js': javascriptMain,
	'App.vue': javascriptApp,
	'message.js': javascriptMessage
});
const vueEntry = ref('App.vue');
const vueFiles = ref({
	'App.vue': vueApp,
	'Card.vue': vueCard
});
const scssEntry = ref('App.vue');
const scssFiles = ref({
	'App.vue': scssApp,
	'_variables.scss': scssVariables,
	'theme.scss': scssTheme
});
</script>
<style lang="scss" scoped>
@use '../src/style' as *;

@include block(playground-examples) {
	padding: 24px;
}
</style>
