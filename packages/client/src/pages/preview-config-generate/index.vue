<template>
	<section class="docs-preview-config-generate">
		<div class="docs-preview-config-generate__body">
			<header>
				<h1>{{ t('client.previewConfigGenerate.title') }}</h1>
				<p>{{ t('client.previewConfigGenerate.description') }}</p>
			</header>
			<div class="docs-preview-config-generate__import">
				<label for="preview-import">{{ t('client.previewConfigGenerate.importLabel') }}</label>
				<div class="docs-preview-config-generate__actions">
					<input
						id="preview-import"
						v-model="importUrl"
						class="docs-preview-config-generate__input"
						:placeholder="t('client.previewConfigGenerate.parseHint')"
					/>
					<button type="button" :disabled="!importUrl.trim()" @click="parseLink">{{ t('client.previewConfigGenerate.parse') }}</button>
				</div>
				<p v-if="parseError" role="alert" class="docs-preview-config-generate__error">{{ parseError }}</p>
			</div>
			<div class="docs-preview-config-generate__fields">
				<label for="preview-url">url</label>
				<input
					id="preview-url"
					v-model="form.url"
					class="docs-preview-config-generate__input"
					:placeholder="t('client.previewConfigGenerate.urlHint')"
				/>
				<template v-for="field in jsonFields" :key="field">
					<label :for="`preview-${field}`">{{ field }}</label>
					<textarea :id="`preview-${field}`" v-model="form[field]" rows="4" spellcheck="false"></textarea>
					<p>{{ t(`client.previewConfigGenerate.${field}Hint`) }}</p>
				</template>
				<label for="preview-lang">{{ t('client.previewConfigGenerate.language') }}</label>
				<Select
					id="preview-lang"
					v-model="form.lang"
					class="docs-preview-config-generate__select"
					:data="languageOptions"
					:null-value="''"
					:placeholder="t('client.previewConfigGenerate.defaultLanguage')"
				/>
			</div>
			<p v-if="result.error" role="alert" class="docs-preview-config-generate__error">{{ result.error }}</p>
			<div class="docs-preview-config-generate__output">
				<label for="preview-link">{{ t('client.previewConfigGenerate.link') }}</label>
				<textarea id="preview-link" :value="result.href" rows="4" readonly spellcheck="false"></textarea>
				<div class="docs-preview-config-generate__actions">
					<Clipboard tag="button" type="button" :value="result.href" :disabled="!result.href">
						{{ t('client.previewConfigGenerate.copy') }}
					</Clipboard>
					<a v-if="result.href" :href="result.href" target="_blank" rel="noopener">{{ t('client.previewConfigGenerate.preview') }}</a>
				</div>
				<details v-if="result.config">
					<summary>{{ t('client.previewConfigGenerate.configuration') }}</summary>
					<pre>{{ JSON.stringify(result.config, null, 2) }}</pre>
				</details>
			</div>
		</div>
	</section>
</template>
<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import type { LocationQuery } from 'vue-router';
import { Clipboard, Select } from '@deot/vc';
import { useLocale } from '@deot/docs-locale';
import { getDocsConfig } from '../../utils/runtime';
import { getDocsDeploymentBase } from '../../utils/resolver';
import {
	createPreviewUrl,
	normalizePreviewConfig,
	readPreviewConfig,
	resolvePreviewType
} from '../../modules/preview/config';
import { parsePreviewStyleUrls } from '../../modules/preview/styles';

const route = useRoute();
const docs = getDocsConfig();
const { t } = useLocale();
const languageOptions = computed(() => [
	{ value: '', label: t('client.previewConfigGenerate.defaultLanguage') },
	...Object.entries(docs.locales).map(([value, item]) => ({ value, label: item.label || value }))
]);
const defaults = { url: '', styles: '[]', modules: '{}', playground: '{}', lang: '' };
const form = reactive({ ...defaults });
const jsonFields = ['styles', 'modules', 'playground'] as const;
const importUrl = ref('');
const parseError = ref('');
const messageOf = (reason: unknown) => t('client.common.previewConfigFailed', {
	message: reason instanceof Error ? reason.message : String(reason)
});
const result = computed(() => {
	try {
		const config = normalizePreviewConfig({
			url: form.url,
			lang: form.lang,
			...Object.fromEntries(jsonFields.map(field => [field, JSON.parse(form[field])]))
		});
		if (!resolvePreviewType(config.url, location.href)) {
			throw new TypeError(t('client.common.previewUrlUnsupported'));
		}
		parsePreviewStyleUrls(config.styles, location.href);
		return { config, href: createPreviewUrl(config, getDocsDeploymentBase(docs)), error: '' };
	} catch (reason) {
		const edited = form.url || jsonFields.some(field => form[field] !== defaults[field]);
		return { config: undefined, href: '', error: edited ? messageOf(reason) : '' };
	}
});

const applyQuery = (query: LocationQuery) => {
	try {
		const config = readPreviewConfig(query);
		if (!config.url) throw new TypeError(t('client.common.previewUrlRequired'));
		form.url = config.url;
		form.lang = config.lang || '';
		jsonFields.forEach(field => form[field] = JSON.stringify(config[field] || {}, null, 2));
		parseError.value = '';
	} catch (reason) {
		parseError.value = messageOf(reason);
	}
};
const parseLink = () => {
	try {
		const target = new URL(importUrl.value.trim(), location.href);
		const query: LocationQuery = {};
		target.searchParams.forEach((_, key) => {
			const values = target.searchParams.getAll(key);
			query[key] = values.length === 1 ? values[0] : values;
		});
		applyQuery(query);
	} catch (reason) {
		parseError.value = messageOf(reason);
	}
};
watch(() => route.query, (query) => {
	if (query.raw !== undefined || query.url !== undefined) applyQuery(query);
}, { immediate: true });
</script>
<style lang="scss">
@use '../../styles/bem' as *;

@include block(docs-preview-config-generate) {
	padding: 32px 20px;

	@include element(body) {
		max-width: 860px;
		margin: 0 auto;
	}

	h1 {
		margin: 0 0 12px;
	}

	p {
		color: varfix(foreground-color-mute);
	}

	label {
		display: block;
		margin: 16px 0 8px;
		font-weight: 600;
	}

	.docs-preview-config-generate__input, textarea {
		width: 100%;
		min-width: 0;
		padding: 10px 12px;
		font: inherit;
		color: inherit;
		background: varfix(background-color);
		border: 1px solid varfix(border-color);
		border-radius: 8px;
	}

	@include element(select) {
		width: 100%;
	}

	textarea {
		font-family: monospace;
		resize: vertical;
	}

	button, a {
		padding: 10px 16px;
		font: inherit;
		white-space: nowrap;
		cursor: pointer;
		border: 1px solid varfix(border-color);
		border-radius: 8px;
	}

	button {
		color: #fff;
		background: varfix(primary-color);
	}

	button:disabled {
		cursor: default;
		opacity: 0.5;
	}

	a {
		display: inline-block;
	}

	details {
		margin-top: 16px;
	}

	summary {
		cursor: pointer;
	}

	pre {
		padding: 16px;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
		background: varfix(background-color-mute);
		border-radius: 8px;
	}

	@include element(import, output) {
		padding: 8px 0 24px;
	}

	@include element(actions) {
		display: flex;
		gap: 12px;
		margin-top: 12px;
	}

	@include element(error) {
		color: var(--vc-color-error);
		overflow-wrap: anywhere;
	}
}
</style>
