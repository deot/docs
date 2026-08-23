<template>
	<div class="docs-renderer-editor-page">
		<div v-if="error" class="docs-renderer-editor-page__error">{{ error }}</div>
		<div v-else-if="loading || !document" class="docs-renderer-editor-page__loading">
			{{ t('client.common.loading') }}
		</div>
		<Combo
			v-else
			v-model="document"
			:modules="rendererModules"
			:context="context"
			:draft-key="draftKey"
			@back="handleBack"
			@save="handleSave"
		/>
	</div>
</template>
<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Message } from '@deot/vc';
import { useLocale } from '@deot/docs-locale';
import {
	Combo,
	RENDERER_SORTABLE_CONTENT_WIDTH,
	cloneRendererValue,
	createEmptyRendererDocument,
	createRendererId,
	validateRendererDocument
} from '@deot/docs-renderer';
import type {
	RendererContext,
	RendererDocument,
	RendererSortableDocument
} from '@deot/docs-renderer';
import { Gateway } from '../../modules/gateway';
import { ResourceRequestError } from '../../modules/gateway/types';
import { Theme } from '../../modules/settings';
import {
	createResourceIdentity,
	getDocsNamespace,
	resolveResource
} from '../../utils/resolver';
import { getDocsConfig, getDocsRuntime } from '../../utils/runtime';
import { resolveHomeContent, writeHomeContent } from '../../utils/content';
import { useRendererModules } from '../../components/renderer';
import { takeInlineRendererDocument } from './inline';

const route = useRoute();
const router = useRouter();
const docs = getDocsConfig();
const { locale, t } = useLocale();
const rendererModules = useRendererModules();
const document = ref<RendererDocument>();
const loading = ref(false);
const error = ref('');
let controller: AbortController | undefined;
let generation = 0;

const lang = computed(() => String(route.params.lang || Object.keys(docs.locales)[0] || 'en-US'));
const source = computed(() => String(route.query.source || ''));
const configuredHome = () => resolveHomeContent(docs, lang.value);
const hashValue = (value: unknown) => {
	const text = JSON.stringify(value);
	let hash = 2166136261;
	for (let index = 0; index < text.length; index += 1) {
		hash ^= text.charCodeAt(index);
		hash = Math.imul(hash, 16777619);
	}
	return (hash >>> 0).toString(36);
};
const draftKey = computed(() => {
	const type = String(route.query.type || 'blank');
	const parts = [
		'docs-editor',
		getDocsNamespace(docs),
		lang.value,
		source.value || type
	];
	if (type === 'home' && !source.value) {
		const configured = configuredHome();
		if (configured && typeof configured !== 'string') parts.push(hashValue(configured));
	}
	return parts.join(':');
});
const context = computed<RendererContext>(() => ({
	lang: lang.value,
	locale: locale.value,
	theme: Theme.current.value,
	route,
	source: source.value,
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
const pageSource = () => {
	if (/\.page\.json(?:$|[?#])/iu.test(source.value)) return source.value.split(/[?#]/u, 1)[0];
	const home = configuredHome();
	if (String(route.query.type || '') === 'home' && typeof home === 'string') return home;
	return '';
};
const createPageSource = () => {
	const existing = pageSource();
	if (existing) return existing;
	const from = String(route.query.from || '');
	const pathname = from.split(/[?#]/u, 1)[0];
	const segments = pathname.split('/').filter(Boolean);
	if (segments[0] === lang.value) segments.shift();
	const slug = segments
		.map(segment => segment.replace(/[^a-z\d_-]+/giu, '-').replace(/^-+|-+$/gu, ''))
		.filter(Boolean)
		.join('-') || 'home';
	return `./pages/${slug}.page.json`;
};
const saveDocument = async (value: RendererDocument) => {
	const target = createPageSource();
	const response = await fetch('/__docs/page', {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ lang: lang.value, source: target, document: value })
	});
	if (!response.ok) throw new Error(await response.text() || `HTTP ${response.status}`);
	const result = await response.json() as { source: string; etag?: string };
	return {
		...result,
		configuration: `content: ${JSON.stringify(result.source)}`
	};
};
const createEmptyDocument = (): RendererSortableDocument => {
	const value = createEmptyRendererDocument('sortable');
	value.meta.id = createRendererId();
	value.meta.title = String(route.query.title || t('renderer.common.untitledPage'));
	return value;
};

const createDocument = (): RendererDocument => {
	const type = String(route.query.type || '');
	const contentSource = source.value;
	if (type === 'inline') {
		return takeInlineRendererDocument(String(route.query.from || '')) || createEmptyDocument();
	}
	if (type === 'home') {
		const configured = configuredHome();
		if (configured && typeof configured !== 'string') return cloneRendererValue(configured);
		return createEmptyDocument();
	}
	const createSourceBlock = (moduleType: string) => ({
		id: createRendererId(),
		module: { type: moduleType, version: 1, props: { source: contentSource } },
		appearance: {
			marginTop: 0,
			marginBottom: 0,
			paddingTop: 0,
			paddingBottom: 0,
			fullWidth: false,
			maxWidth: RENDERER_SORTABLE_CONTENT_WIDTH
		}
	});
	const block = type === 'markdown' && contentSource
		? createSourceBlock('docs:markdown')
		: type === 'sfc' && contentSource
			? createSourceBlock('docs:sfc')
			: null;
	const value = createEmptyDocument();
	if (block) value.blocks.push(block);
	return value;
};

const load = async () => {
	const current = ++generation;
	controller?.abort();
	const activeController = new AbortController();
	controller = activeController;
	error.value = '';
	loading.value = true;
	try {
		const page = pageSource();
		if (!page) {
			const value = createDocument();
			if (current === generation && !activeController.signal.aborted) document.value = value;
			return;
		}
		const identity = createResourceIdentity(docs, lang.value, 'page', page);
		const url = await resolveResource(docs, {
			source: page,
			type: 'page',
			lang: lang.value
		});
		const record = await Gateway.load(identity, { url, priority: 100, signal: activeController.signal });
		if (current !== generation || activeController.signal.aborted) return;
		const value: unknown = JSON.parse(record.content);
		const result = validateRendererDocument(value);
		if (!result.valid || !result.document) throw new TypeError(result.issues.map(item => item.message).join('; '));
		document.value = result.document;
	} catch (reason) {
		if (
			current === generation
			&& !activeController.signal.aborted
			&& reason instanceof ResourceRequestError
			&& reason.status === 404
		) {
			// 不存在的 Page JSON 表示正在创建新页面；其他请求或协议异常仍需展示。
			document.value = createEmptyDocument();
			return;
		}
		if (current === generation && !activeController.signal.aborted) {
			error.value = reason instanceof Error ? reason.message : String(reason);
		}
	} finally {
		if (current === generation && !activeController.signal.aborted) loading.value = false;
	}
};

const handleBack = () => {
	const from = String(route.query.from || `/${lang.value}`);
	void router.push(from);
};
const handleSaved = (nextSource: string) => {
	void router.replace({
		query: {
			...route.query,
			source: nextSource,
			type: 'page'
		}
	});
};
const handleSave = async (value: RendererDocument) => {
	if (getDocsRuntime().mode !== 'development') return;
	try {
		const result = await saveDocument(value);
		if (String(route.query.type || '') === 'home') {
			writeHomeContent(docs, lang.value, result.source);
		}
		handleSaved(result.source);
		Message.success(t('renderer.common.saved'));
	} catch (reason) {
		Message.error(reason instanceof Error ? reason.message : String(reason));
	}
};

watch([lang, source, () => route.query.type], load, { immediate: true });
onBeforeUnmount(() => {
	generation += 1;
	controller?.abort();
});
</script>
<style lang="scss">
.docs-renderer-editor-page {
	width: 100%;
	height: 100%;
	min-height: 0;
	overflow: hidden;

	&__loading,
	&__error {
		display: grid;
		height: 100%;
		place-items: center;
	}

	&__error { color: var(--vc-color-error); }
}
</style>
