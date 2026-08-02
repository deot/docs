<template>
	<div style="padding: 24px;">
		<Markdown v-model="current" />
	</div>
</template>
<script setup>
import { ref } from 'vue';
import { Markdown } from '@deot/docs-markdown';
import '/node_modules/@deot/style/dist/index.normalize-only.css';
import '/node_modules/@deot/vc-components/dist/index.style.css';
import source from './locals/README.md?raw';

const current = ref(source);
</script>
