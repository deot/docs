<template>
	<DemoStage v-if="demo" :name="demo" @back="handleBack" />
	<DemoGallery v-else @open="handleOpen" @editor="handleEditor" />
</template>
<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { isRendererEditorDemo } from './catalog';
import type { RendererEditorDemo } from './catalog';
import DemoGallery from './components/gallery.vue';
import DemoStage from './components/stage.vue';

const route = useRoute();
const router = useRouter();
const lang = computed(() => String(route.params.lang || ''));
const demo = computed<RendererEditorDemo | undefined>(() => (
	isRendererEditorDemo(route.query.name) ? route.query.name : undefined
));
const handleOpen = (name: RendererEditorDemo) => {
	void router.push({ path: route.path, query: { name } });
};
const handleEditor = () => {
	void router.push({
		path: `/${lang.value}/__docs/renderer-editor`,
		query: { from: route.fullPath }
	});
};
const handleBack = () => {
	void router.push({ path: route.path, query: {} });
};
</script>
