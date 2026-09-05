<template>
	<div class="docs-markdown" :class="`docs-markdown--${resolvedTheme}`">
		<MarkdownIndicator
			v-if="indicatorOptions"
			:target="content"
			:options="indicatorOptions"
		/>
		<div ref="content" class="docs-markdown-reset" v-markdown="markdownBinding"></div>
	</div>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue';
import { provideLocale, useLocale } from '@deot/docs-locale';
import type { Language } from '@deot/docs-locale';
import { vMarkdown } from './directive';
import MarkdownIndicator from './indicator.vue';
import type { MarkdownIndicatorConfig, MarkdownTheme } from './types';

// 后续再处理内容变更。
defineEmits<{
	'update:modelValue': [value: string];
	'change': [value: string];
}>();
const props = withDefaults(defineProps<{
	indicator?: MarkdownIndicatorConfig;
	locale?: Language;
	/**
	 * 排版皮肤。与站点 light/dark（`data-doc-theme`）正交。
	 */
	theme?: MarkdownTheme;
	modelValue?: string;
	value?: string;
}>(), {
	indicator: true,
	theme: 'default'
});

const content = ref<HTMLElement>();
const inheritedLocale = useLocale();
const locale = computed(() => props.locale || inheritedLocale.locale.value);
provideLocale(locale);
const indicatorOptions = computed(() => {
	if (props.indicator === false) return undefined;
	return typeof props.indicator === 'object' ? props.indicator : {};
});
const resolvedTheme = computed<MarkdownTheme>(() => (
	props.theme === 'traditional' ? 'traditional' : 'default'
));

// 即使 modelValue 是合法的空文档，它仍然是唯一可信的数据源。
const source = computed(() => typeof props.modelValue === 'string'
	? props.modelValue
	: props.value);
const markdownBinding = computed(() => ({ source: source.value, locale: locale.value }));
</script>
<style lang="scss">
@use '@deot/style/src/mixins/bem' as *;
@use './themes/default';
@use './themes/traditional';

@include block(docs-markdown) {
	position: relative;
}
</style>
