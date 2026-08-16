<template>
	<section class="docs-renderer-editor-demos-gallery">
		<header class="docs-renderer-editor-demos-gallery__intro">
			<h1>{{ t('client.demos.title') }}</h1>
			<p>{{ t('client.demos.subtitle') }}</p>
		</header>
		<div class="docs-renderer-editor-demos-gallery__grid">
			<DemoCard
				v-for="item in items"
				:key="item.name"
				:item="item"
				@open="handleOpen"
			/>
			<DemoCard
				:item="editorItem"
				:action="t('client.demos.openEditor')"
				@open="emit('editor')"
			/>
		</div>
	</section>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import { useLocale } from '@deot/docs-locale';
import { listRendererEditorDemos, isRendererEditorDemo } from '../catalog';
import type { RendererEditorDemo } from '../catalog';
import DemoCard from './card.vue';

const emit = defineEmits<{
	open: [name: RendererEditorDemo];
	editor: [];
}>();
const { locale, t } = useLocale();
const items = computed(() => listRendererEditorDemos(locale.value.name));
const editorItem = computed(() => ({
	name: 'editor',
	title: t('client.demos.editor'),
	description: t('client.demos.editorHint'),
	modules: [],
	accent: '#4c6ef5'
}));
const handleOpen = (name: string) => {
	if (isRendererEditorDemo(name)) emit('open', name);
};
</script>
<style lang="scss">
.docs-renderer-editor-demos-gallery {
	display: grid;
	gap: 28px;
	width: min(100%, 960px);
	margin: 0 auto;

	&__intro h1 {
		margin: 0 0 8px;
		font-size: 32px;
	}

	&__intro p {
		margin: 0;
		line-height: 1.6;
		color: varfix(foreground-color-mute);
	}

	&__grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 28px;
	}
}
</style>
