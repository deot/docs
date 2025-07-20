<template>
	<div style="padding: 24px">
		<Markdown v-model="current" />
	</div>
</template>
<script setup>
import { ref, onMounted } from 'vue';
import { Markdown } from '@deot/docs-playground';
import '/node_modules/@deot/style/dist/index.normalize-only.css';
import '/node_modules/@deot/vc-components/dist/index.style.css';

const current = ref('');

onMounted(async () => {
	const response = await fetch('https://raw.githubusercontent.com/deot/vc/refs/heads/main/packages/components/button/README.md');
	current.value = await response.text();
});
</script>
