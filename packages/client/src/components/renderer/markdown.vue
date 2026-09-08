<template>
	<div class="docs-renderer-markdown">
		<div v-if="error" class="docs-renderer-markdown__error">{{ error }}</div>
		<div v-else-if="loading" class="docs-renderer-markdown__loading">{{ t('client.common.loading') }}</div>
		<Markdown
			v-else
			:value="content"
			:indicator="indicator"
			:locale="context.locale"
			:theme="markdownTheme"
			:playground="playgroundDefaults"
		/>
	</div>
</template>
<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { Markdown } from '@deot/docs-markdown';
import { useLocale } from '@deot/docs-locale';
import type { RendererModuleViewerProps } from '@deot/docs-renderer';
import { Gateway } from '../../modules/gateway';
import {
	resolveDocsMarkdownComponent,
	resolveDocsPlaygroundComponent
} from '../../utils/components';
import { createResourceIdentity, resolveResource } from '../../utils/resolver';
import { getDocsConfig } from '../../utils/runtime';
import {
	docsMarkdownIndicator,
	docsMarkdownInlineContent,
	normalizeDocsMarkdownProps
} from './markdown-props';

const props = defineProps<RendererModuleViewerProps>();
const { t } = useLocale();
const docs = getDocsConfig();
const content = ref('');
const error = ref('');
const loading = ref(false);
const markdownProps = computed(() => normalizeDocsMarkdownProps(props.node.module.props));
const markdownDefaults = computed(() => resolveDocsMarkdownComponent(docs));
const markdownTheme = computed(() => markdownDefaults.value.theme);
const indicator = computed(() => {
	const moduleIndicator = markdownProps.value.options?.indicator;
	if (typeof moduleIndicator !== 'undefined') return docsMarkdownIndicator(markdownProps.value.options);
	if (typeof markdownDefaults.value.indicator !== 'undefined') return markdownDefaults.value.indicator;
	return true;
});
const playgroundDefaults = computed(() => resolveDocsPlaygroundComponent(docs));
let controller: AbortController | undefined;
let unsubscribe: (() => void) | undefined;
let generation = 0;

const load = async () => {
	const current = ++generation;
	controller?.abort();
	unsubscribe?.();
	controller = undefined;
	unsubscribe = undefined;
	error.value = '';
	const inline = docsMarkdownInlineContent(markdownProps.value);
	if (typeof inline === 'string') {
		content.value = inline;
		loading.value = false;
		return;
	}
	const source = markdownProps.value.source.trim();
	if (!source) {
		content.value = '';
		loading.value = false;
		return;
	}
	loading.value = true;
	const activeController = new AbortController();
	controller = activeController;
	try {
		const identity = createResourceIdentity(docs, props.context.lang || '', 'markdown', source);
		const url = await resolveResource(docs, {
			source,
			type: 'markdown',
			lang: props.context.lang || '',
			importer: props.context.source
		});
		if (current !== generation || activeController.signal.aborted) return;
		unsubscribe = Gateway.subscribe(identity, (record) => {
			if (current === generation) content.value = record.content;
		});
		const record = await Gateway.load(identity, { url, priority: 100, signal: activeController.signal });
		if (current === generation) content.value = record.content;
	} catch (reason) {
		if (current !== generation || activeController.signal.aborted) return;
		error.value = reason instanceof Error ? reason.message : String(reason);
	} finally {
		if (current === generation) loading.value = false;
	}
};

watch(
	() => [markdownProps.value, props.context.lang, props.context.source],
	load,
	{ immediate: true, deep: true }
);
onBeforeUnmount(() => {
	generation += 1;
	controller?.abort();
	unsubscribe?.();
});
</script>
<style lang="scss">
.docs-renderer-markdown {
	.docs-markdown-indicator.is-left .docs-markdown-indicator__viewport {
		right: auto;
		left: 0;
	}

	.docs-markdown-indicator.is-right .docs-markdown-indicator__viewport {
		right: 0;
		left: auto;
	}
}
</style>
