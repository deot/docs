<template>
	<div class="docs-code-preview">
		<span
			v-if="languageLabel"
			class="docs-code-preview__language"
			:title="languageLabel"
		>{{ languageLabel }}</span>
		<Clipboard
			class="docs-code-preview__copy"
			:value="code"
			tag="button"
			type="button"
			:title="copyLabel"
			:aria-label="copyLabel"
		>
			<PlaygroundIcon name="copy" />
		</Clipboard>
		<!-- eslint-disable-next-line vue/no-v-html -->
		<pre class="docs-code-preview__code"><code class="hljs" v-html="highlightedCode"></code></pre>
	</div>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import { Clipboard } from '@deot/vc';
import {
	highlightCodeByLanguage,
	resolveHighlightLanguage
} from '../../highlight';
import PlaygroundIcon from '../../icon';
import { ensureCodePreviewStyle } from './style';

ensureCodePreviewStyle();

const props = withDefaults(defineProps<{
	code: string;
	filename?: string;
	language?: string;
	copyLabel?: string;
}>(), {
	filename: '',
	language: '',
	copyLabel: '复制代码'
});

const languageLabels: Record<string, string> = {
	javascript: 'js',
	typescript: 'ts',
	plaintext: 'txt',
	xml: 'html'
};
const filenameExtension = computed(() => props.filename.split('.').at(-1)?.toLowerCase() || '');
const languageLabel = computed(() => {
	const language = props.language.toLowerCase();
	return languageLabels[language] || language || filenameExtension.value;
});
const highlightLanguage = computed(() => props.language
	|| resolveHighlightLanguage(props.filename)
);
const highlightedCode = computed(() => highlightCodeByLanguage(
	props.code,
	highlightLanguage.value
));
</script>
