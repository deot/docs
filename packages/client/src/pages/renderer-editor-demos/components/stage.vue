<template>
	<div class="docs-renderer-editor-demos-stage">
		<Combo
			v-if="document"
			v-model="document"
			:modules="rendererModules"
			:context="context"
			:draft-key="draftKey"
			@back="emit('back')"
			@save="handleSave"
		/>
	</div>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Message } from '@deot/vc';
import { useLocale } from '@deot/docs-locale';
import { Combo } from '@deot/docs-renderer';
import type { RendererContext, RendererDocument } from '@deot/docs-renderer';
import { Theme } from '../../../modules/settings';
import { getDocsNamespace, resolveResource } from '../../../utils/resolver';
import { getDocsConfig, getDocsRuntime } from '../../../utils/runtime';
import { useRendererModules } from '../../../components/renderer';
import {
	createRendererEditorDemoDocument
} from '../catalog';
import type { RendererEditorDemo } from '../catalog';

const props = defineProps<{ name: RendererEditorDemo }>();
const emit = defineEmits<{ back: [] }>();
const route = useRoute();
const router = useRouter();
const docs = getDocsConfig();
const { locale, t } = useLocale();
const rendererModules = useRendererModules();
const document = ref<RendererDocument>();
const lang = computed(() => String(route.params.lang || locale.value.name));
const draftKey = computed(() => [
	'docs-editor-demo',
	getDocsNamespace(docs),
	lang.value,
	props.name
].join(':'));
const context = computed<RendererContext>(() => ({
	lang: lang.value,
	locale: locale.value,
	theme: Theme.current.value,
	route,
	services: {
		resolveAsset: (value, importer) => resolveResource(docs, {
			source: value,
			type: 'module',
			lang: lang.value,
			importer
		}),
		resolveLink: target => router.resolve(target).href,
		navigate: async (target) => {
			await router.push(target);
		}
	}
}));

const handleSave = async (value: RendererDocument) => {
	if (getDocsRuntime().mode !== 'development') return;
	try {
		const response = await fetch('/__docs/page', {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				lang: lang.value,
				source: `./pages/renderer-${props.name}.page.json`,
				document: value
			})
		});
		if (!response.ok) throw new Error(await response.text() || `HTTP ${response.status}`);
		Message.success(t('renderer.common.saved'));
	} catch (reason) {
		Message.error(reason instanceof Error ? reason.message : String(reason));
	}
};

watch([() => props.name, lang], () => {
	document.value = createRendererEditorDemoDocument(props.name, lang.value);
}, { immediate: true });
</script>
<style lang="scss">
.docs-renderer-editor-demos-stage {
	width: 100%;
	height: 100%;
	min-height: 0;
	overflow: hidden;
}
</style>
