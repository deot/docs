<template>
	<div class="markdown-demo" :data-doc-theme="theme" :data-vc-theme="theme">
		<div class="markdown-demo__toolbar">
			<button
				type="button"
				class="markdown-demo__theme"
				@click="toggleTheme"
			>
				{{ theme === 'dark' ? '浅色' : '暗色' }}
			</button>
			<button
				type="button"
				class="markdown-demo__theme"
				@click="toggleMarkdownTheme"
			>
				{{ markdownTheme === 'traditional' ? '默认排版' : '传统排版' }}
			</button>
		</div>
		<div style="padding: 24px;">
			<Markdown v-model="current" :theme="markdownTheme" />
		</div>
	</div>
</template>
<script setup>
import { onMounted, onUnmounted, ref } from 'vue';
import { Markdown } from '@deot/docs-markdown';
import '/node_modules/@deot/style/dist/index.normalize-only.css';
import '/node_modules/@deot/vc-components/dist/index.style.css';
import source from './locals/README.md?raw';

const current = ref(source);
const theme = ref('light');
const markdownTheme = ref('default');

const applyTheme = (next) => {
	theme.value = next;
	document.documentElement.setAttribute('data-doc-theme', next);
	document.documentElement.setAttribute('data-vc-theme', next);
	document.body.setAttribute('data-doc-theme', next);
	document.body.setAttribute('data-vc-theme', next);
};

const toggleTheme = () => {
	applyTheme(theme.value === 'dark' ? 'light' : 'dark');
};

const toggleMarkdownTheme = () => {
	markdownTheme.value = markdownTheme.value === 'traditional' ? 'default' : 'traditional';
};

onMounted(() => applyTheme(theme.value));
onUnmounted(() => {
	document.documentElement.removeAttribute('data-doc-theme');
	document.documentElement.removeAttribute('data-vc-theme');
	document.body.removeAttribute('data-doc-theme');
	document.body.removeAttribute('data-vc-theme');
});
</script>
<style>
html,
body {
	margin: 0;
	background: #fff;
}

html[data-doc-theme='dark'],
body[data-doc-theme='dark'] {
	background: #171b24;
}

.markdown-demo[data-doc-theme='dark'] {
	min-height: 100vh;
	background: #171b24;
}

.markdown-demo__toolbar {
	position: sticky;
	top: 12px;
	z-index: 2;
	display: flex;
	width: fit-content;
	margin: 12px auto 0 24px;
	gap: 8px;
}

.markdown-demo__theme {
	display: block;
	padding: 4px 10px;
	font: inherit;
	font-size: 12px;
	line-height: 20px;
	color: inherit;
	cursor: pointer;
	background: transparent;
	border: 1px solid #e5e7eb;
	border-radius: 6px;
}

.markdown-demo[data-doc-theme='dark'] .markdown-demo__theme {
	color: #f8f8f8;
	border-color: #3b4355;
}
</style>
