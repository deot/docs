<template>
	<Markdown v-model="value" />
</template>
<script setup>
import { ref } from 'vue';
import { Markdown } from '@deot/docs-playground';
import '/node_modules/@deot/vc-components/dist/index.style.css';

let source = `\n## 标题\n\n`;

source += `:::RUNTIME {"style":"height:200px"}\n`;
source += `\`\`\`vue\n`;
source += `<template>\n`;
source += `	<Button>123</Button>\n`;
source += `<\/template>\n`;
source += `<script setup>\n`;
source += `import { Button } from '@deot/vc'\n`;
source += `<\/script>\n`;
source += `\`\`\`\n`;
source += `:::\n`;

const value = ref(source);
</script>
