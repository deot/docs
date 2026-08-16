<template>
	<Modal
		v-model="active"
		:title="t('renderer.common.preview')"
		:width="1200"
		:height="720"
		:footer="false"
		:content-style="contentStyle"
		:mask-closable="true"
		class="docs-renderer-preview-modal"
		@cancel="handleClose"
		@close="handleClose"
	>
		<div class="docs-renderer-preview-modal__content" :data-vc-theme="context.theme">
			<Renderer :document="document" :modules="modules" :context="context" fit="contain" />
		</div>
	</Modal>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue';
import { Modal } from '@deot/vc';
import { useLocale } from '@deot/docs-locale';
import type {
	RendererContext,
	RendererDocument,
	RendererModuleSource
} from '../../types';
import Renderer from '../renderer/index.vue';

const props = defineProps<{
	document: RendererDocument;
	modules: readonly RendererModuleSource[];
	context: RendererContext;
}>();
const { t } = useLocale(computed(() => props.context.locale));
const emit = defineEmits<{ 'portal-fulfilled': [] }>();
const active = ref(true);
const contentStyle = { height: '100%', padding: 0 };
let closed = false;
const handleClose = () => {
	if (closed) return;
	closed = true;
	emit('portal-fulfilled');
};
</script>
