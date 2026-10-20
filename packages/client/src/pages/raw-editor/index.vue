<template>
	<section class="docs-raw-editor">
		<header>
			<h1>{{ t('client.rawEditor.title') }}</h1>
			<p>{{ t('client.rawEditor.description') }}</p>
		</header>
		<div class="docs-raw-editor__import">
			<label for="raw-import">{{ t('client.rawEditor.importLabel') }}</label>
			<div class="docs-raw-editor__actions">
				<input id="raw-import" v-model="importUrl" :placeholder="t('client.rawEditor.parseHint')" />
				<button type="button" :disabled="!importUrl.trim()" @click="parseLink">{{ t('client.rawEditor.parse') }}</button>
			</div>
			<p v-if="parseError" role="alert">{{ parseError }}</p>
		</div>
		<label for="raw-target">{{ t('client.rawEditor.target') }}</label>
		<div class="docs-raw-editor__actions">
			<input id="raw-target" v-model="target" />
			<button type="button" @click="target = '__docs/preview'">preview</button>
			<button type="button" @click="target = '__docs/markdown-editor'">markdown-editor</button>
		</div>
		<div class="docs-raw-editor__panels">
			<div class="docs-raw-editor__panel">
				<label>{{ t('client.rawEditor.json') }}</label>
				<JsonEditor v-model="jsonText" :label="t('client.rawEditor.json')" />
			</div>
			<div class="docs-raw-editor__panel">
				<label>{{ t('client.rawEditor.link') }}</label>
				<p v-if="result.error" role="alert">{{ result.error }}</p>
				<Scroller :native="false" :auto-resize="true" class="docs-raw-editor__output">
					<pre id="raw-link">{{ result.href }}</pre>
				</Scroller>
				<div class="docs-raw-editor__actions">
					<Clipboard tag="button" type="button" :value="result.href" :disabled="!result.href">{{ t('client.rawEditor.copy') }}</Clipboard>
					<a v-if="result.href" :href="result.href" target="_blank" rel="noopener">{{ t('client.rawEditor.open') }}</a>
				</div>
			</div>
		</div>
	</section>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import type { LocationQuery } from 'vue-router';
import { Clipboard, Scroller } from '@deot/vc';
import { useLocale } from '@deot/docs-locale';
import JsonEditor from './components/json-editor.vue';
import { getDocsConfig } from '../../utils/runtime';
import { getDocsDeploymentBase } from '../../utils/resolver';
import { readPreviewConfig } from '../../modules/preview/config';
import { createRawUrl, readRaw } from '../../modules/preview/raw';

const route = useRoute();
const { t } = useLocale();
const base = getDocsDeploymentBase(getDocsConfig());
const jsonText = ref('{}');
const target = ref('__docs/preview');
const importUrl = ref('');
const parseError = ref('');
const messageOf = (error: unknown) => error instanceof Error ? error.message : String(error);
const result = computed(() => {
	try {
		return { href: createRawUrl(JSON.parse(jsonText.value), target.value, base), error: '' };
	} catch (error) {
		return { href: '', error: t('client.rawEditor.invalid', { message: messageOf(error) }) };
	}
});
const applyQuery = (query: LocationQuery) => {
	try {
		if (typeof query.target === 'string') target.value = query.target;
		if (query.raw !== undefined) jsonText.value = JSON.stringify(readRaw(query.raw), null, 2);
		else if (query.url !== undefined) jsonText.value = JSON.stringify(readPreviewConfig(query), null, 2);
		parseError.value = '';
	} catch (error) {
		parseError.value = t('client.rawEditor.invalid', { message: messageOf(error) });
	}
};
const parseLink = () => {
	try {
		const url = new URL(importUrl.value.trim(), base);
		if (!/^https?:$/.test(url.protocol)) throw new TypeError('Invalid HTTP(S) URL');
		const query: LocationQuery = {};
		url.searchParams.forEach((_, key) => {
			const values = url.searchParams.getAll(key);
			query[key] = values.length === 1 ? values[0] : values;
		});
		if (query.raw === undefined && query.url === undefined) throw new TypeError('raw or url is required');
		// 先解析成功再更新目标，错误输入不会破坏当前编辑内容。
		const value = query.raw !== undefined ? readRaw(query.raw) : readPreviewConfig(query);
		url.searchParams.delete('raw');
		jsonText.value = JSON.stringify(value, null, 2);
		target.value = url.href;
		parseError.value = '';
	} catch (error) {
		parseError.value = t('client.rawEditor.invalid', { message: messageOf(error) });
	}
};
watch(() => route.query, applyQuery, { immediate: true });
</script>
<style lang="scss">
@use '../../styles/bem' as *;

@include block(docs-raw-editor) {
	display: flex;
	width: 100%;
	height: 100vh;
	max-width: 1200px;
	min-height: 600px;
	padding: 24px;
	margin: 0 auto;
	box-sizing: border-box;
	flex-direction: column;
	gap: 12px;

	h1, p {
		margin: 0;
	}

	label {
		display: block;
		font-weight: 600;
	}

	[role='alert'] {
		color: varfix(foreground-color-dark);
		overflow-wrap: anywhere;
	}

	input, button, a {
		padding: 8px 12px;
		font: inherit;
		color: inherit;
		background: varfix(background-color-lightest);
		border: 1px solid varfix(border-color);
		border-radius: 6px;
	}

	input {
		min-width: 0;
		flex: 1;
	}

	button, a {
		cursor: pointer;
	}

	button:disabled {
		cursor: default;
		opacity: 0.5;
	}

	pre {
		padding: 12px;
		margin: 0;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}

	@include element(actions) {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
	}

	@include element(panels) {
		display: grid;
		min-height: 0;
		flex: 1;
		grid-template-columns: 1fr 1fr;
		gap: 20px;
	}

	@include element(panel) {
		display: flex;
		min-width: 0;
		min-height: 0;
		flex-direction: column;
		gap: 12px;
	}

	@include element(output) {
		min-height: 0;
		flex: 1;
		border: 1px solid varfix(border-color);
	}

	.docs-raw-editor-json-editor {
		min-height: 0;
		flex: 1;
		border: 1px solid varfix(border-color);
	}

	@media (width <= 720px) {
		& { padding: 16px; }

		@include element(panels) {
			grid-template-columns: 1fr;
			grid-template-rows: 1fr 1fr;
		}
	}
}
</style>
