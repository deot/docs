<template>
	<div class="docs-renderer-module-editor">
		<div class="docs-renderer-field is-wide">
			<label>{{ t('renderer.editor.source') }}</label>
			<Input
				:model-value="String(modelValue.source || '')"
				:placeholder="t('renderer.editor.markdownSourceHint')"
				@update:model-value="value => update({ source: value })"
			/>
		</div>
		<div class="docs-renderer-field is-wide">
			<label>{{ t('renderer.editor.markdownContent') }}</label>
			<Textarea
				:model-value="String(modelValue.content || '')"
				:rows="8"
				:placeholder="t('renderer.editor.markdownContentHint')"
				@update:model-value="handleContent"
			/>
		</div>
		<div class="docs-renderer-field is-wide is-inline">
			<label>{{ t('markdown.indicator.label') }}</label>
			<Switch :model-value="indicatorEnabled" @update:model-value="patchIndicator" />
		</div>
	</div>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import { Input, Switch, Textarea } from '@deot/vc';
import { useLocale } from '@deot/docs-locale';
import type { RendererModuleEditorProps } from '@deot/docs-renderer';
import type { DocsMarkdownOptions } from './markdown-props';

const props = defineProps<RendererModuleEditorProps>();
const emit = defineEmits<{ 'update:modelValue': [value: Record<string, unknown>] }>();
const { t } = useLocale();
const options = computed<DocsMarkdownOptions>(() => {
	const value = props.modelValue.options;
	return value && typeof value === 'object' && !Array.isArray(value)
		? value as DocsMarkdownOptions
		: {};
});
const indicatorEnabled = computed(() => options.value.indicator !== false);
const update = (patch: Record<string, unknown>) => (
	emit('update:modelValue', { ...props.modelValue, ...patch })
);
const handleContent = (value: string) => {
	if (value) {
		update({ content: value });
		return;
	}
	const { content: _content, ...rest } = props.modelValue;
	emit('update:modelValue', rest);
};
const patchIndicator = (enabled: boolean) => {
	update({
		options: {
			...options.value,
			indicator: enabled
		}
	});
};
</script>
