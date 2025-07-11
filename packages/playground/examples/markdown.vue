<template>
	<Markdown :source="source" />
</template>
<script setup>
import { Markdown } from '@deot/docs-playground';

let source = `# 111\n`;

source += `:::RUNTIME\n`;
source += `\`\`\`vue\n`;
source += `<template>\n`;
source += `	<Button>123</Button>\n`;
source += `<\/template>\n`;
source += `<script setup>\n`;
source += `import { Button } from '@deot/vc'\n`;
source += `<\/script>\n`;
source += `\`\`\`\n`;
source += `:::\n`;
</script>
