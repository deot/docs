<template>
	<div class="playground-examples">
		<h2>仅运行时预览</h2>
		<Playground v-model="source" title="基础运行时" :views="['runtime']" />

		<h2>临时预览高度</h2>
		<Playground :model-value="heightSource" title="自动高度服务" :preview-inset="16" expandable :local="false" />
		<Playground :model-value="heightSource" title="固定视口与 Scroller" :viewport="[375, 240]" preview-scroller :local="false" />

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
			title="基础运行时"
			expandable
			:views="['runtime', 'files']"
		/>

		<h2>在线 SCSS</h2>
		<Playground
			v-model:files="scssFiles"
			v-model:entry="scssEntry"
			:views="['runtime', 'files']"
		/>

		<h2>移动端分栏</h2>
		<Playground
			v-model="mobileSource"
			title="移动端"
			mobile
			:preview-variables="previewVariables"
		/>
	</div>
</template>
<script setup>
import { ref } from 'vue';
import { Playground } from '@deot/docs-playground';
import '/node_modules/@deot/vc-components/dist/index.style.css';
import sourceText from './fixtures/source.vue?raw';
import heightSource from './fixtures/height.vue?raw';
import javascriptMain from './fixtures/javascript/main.js?raw';
import javascriptApp from './fixtures/javascript/App.vue?raw';
import javascriptMessage from './fixtures/javascript/message.js?raw';
import vueApp from './fixtures/vue/App.vue?raw';
import vueCard from './fixtures/vue/Card.vue?raw';
import scssApp from './fixtures/scss/App.vue?raw';
import scssVariables from './fixtures/scss/_variables.scss?raw';
import scssTheme from './fixtures/scss/theme.scss?raw';
import mobileText from './fixtures/mobile.vue?raw';

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
const mobileSource = ref(mobileText);
const previewVariables = [{
	name: '--rem',
	label: 'rem',
	values: ['auto', '0.5px', '0.552px', '0.64px', '1px'],
	default: '0.5px'
}, {
	name: '--gap',
	label: 'gap',
	values: ['8px', '16px', '24px'],
	default: '16px'
}, {
	name: '--padding',
	label: 'padding',
	values: ['12px', '24px', '32px'],
	default: '24px'
}, {
	name: '--box',
	label: 'box',
	values: ['#dbeafe', '#dcfce7', '#fee2e2'],
	default: '#dbeafe'
}];
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
