<template>
	<div class="docs-renderer-module-editor">
		<p>{{ t('renderer.inspector.selection') }}</p>
	</div>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import { useLocale } from '@deot/docs-locale';
import type { RendererModuleEditorProps } from '../../../types';

const props = defineProps<RendererModuleEditorProps>();
const { t } = useLocale(computed(() => props.context?.locale));
</script>
