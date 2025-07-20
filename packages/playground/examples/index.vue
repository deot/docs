<template>
	<Playground v-model="source" />
</template>
<script setup>
import { ref } from 'vue';
import { Playground } from '@deot/docs-playground';
import '/node_modules/@deot/vc-components/dist/index.style.css';

// eslint-disable-next-line @stylistic/max-len
const source = ref(`<script setup>\nimport { ref } from 'vue'\n\nconst msg = ref('Hello World!!')\n<\/script>\n\n<template>\n  <h1>{{ msg }}<\/h1>\n  <input v-model=\"msg\" />\n<\/template>\n`);
</script>
