<template>
	<section class="docs-home">
		<div v-if="error" class="docs-home__error">{{ error }}</div>
		<Renderer v-if="document" :document="document" :modules="rendererModules" :context="rendererContext" />
		<div v-else-if="loading" class="docs-home__loading">{{ t('client.common.loading') }}</div>
	</section>
</template>
<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useLocale } from '@deot/docs-locale';
import { Renderer, validateRendererDocument } from '@deot/docs-renderer';
import type { RendererContext, RendererDocument } from '@deot/docs-renderer';
import { Gateway, Theme } from '../../modules';
import {
	createResourceIdentity,
	getDefaultLanguage,
	resolveResource
} from '../../utils/resolver';
import { getDocsConfig } from '../../utils/runtime';
import { useRendererModules } from '../../components/renderer';

const route = useRoute();
const router = useRouter();
const config = getDocsConfig();
const { locale, t } = useLocale();
const rendererModules = useRendererModules();
const document = ref<RendererDocument>();
const loading = ref(true);
const error = ref('');
let controller: AbortController | undefined;
let unsubscribe: (() => void) | undefined;
let generation = 0;

const lang = computed(() => String(route.params.lang || getDefaultLanguage(config)));
const rendererContext = computed<RendererContext>(() => ({
	lang: lang.value,
	locale: locale.value,
	theme: Theme.current.value,
	route,
	services: {
		resolveAsset: (source, importer) => resolveResource(config, {
			source,
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

const parseDocument = (value: unknown) => {
	const result = validateRendererDocument(value);
	if (!result.valid || !result.document) {
		throw new TypeError(result.issues.map(item => item.message).join('; '));
	}
	return result.document;
};

const load = async () => {
	const current = ++generation;
	controller?.abort();
	unsubscribe?.();
	unsubscribe = undefined;
	const activeController = new AbortController();
	controller = activeController;
	error.value = '';
	loading.value = true;
	document.value = undefined;
	try {
		const configured = config.home?.locales?.[lang.value]
			|| config.home?.locales?.['en-US'];
		if (!configured) return;
		if (typeof configured !== 'string') {
			document.value = parseDocument(configured);
			return;
		}
		const identity = createResourceIdentity(config, lang.value, 'page', configured);
		const url = await resolveResource(config, {
			source: configured,
			type: 'page',
			lang: lang.value
		});
		if (current !== generation || activeController.signal.aborted) return;
		unsubscribe = Gateway.subscribe(identity, (record) => {
			try {
				document.value = parseDocument(JSON.parse(record.content));
				error.value = '';
			} catch (reason) {
				error.value = reason instanceof Error ? reason.message : String(reason);
			}
		});
		const record = await Gateway.load(identity, {
			url,
			priority: 100,
			signal: activeController.signal
		});
		if (current === generation) document.value = parseDocument(JSON.parse(record.content));
	} catch (reason) {
		if (current === generation && !activeController.signal.aborted) {
			error.value = reason instanceof Error ? reason.message : String(reason);
		}
	} finally {
		if (current === generation && !activeController.signal.aborted) loading.value = false;
	}
};

watch(lang, load, { immediate: true });
onBeforeUnmount(() => {
	generation += 1;
	controller?.abort();
	unsubscribe?.();
});
</script>
<style lang="scss">
@use '../../styles/bem' as *;

@include block(docs-home) {
	width: 100%;
	min-height: 600px;

	@include element(error) {
		padding: 12px 16px;
		margin-bottom: 16px;
		color: var(--vc-color-error);
		background: varfix(error-background);
		border-radius: 8px;
	}

	@include element(loading) {
		display: grid;
		min-height: 600px;
		color: varfix(foreground-color-mute);
		place-items: center;
	}
}
</style>
