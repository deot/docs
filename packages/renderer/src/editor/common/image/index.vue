<template>
	<div class="docs-renderer-image-source">
		<Input
			:model-value="modelValue"
			:placeholder="placeholder"
			@update:model-value="value => emit('update:modelValue', value)"
		/>
		<label class="docs-renderer-image-source__pick" :title="t('renderer.editor.pickImage')">
			<input
				class="docs-renderer-image-source__file"
				type="file"
				accept="image/*"
				@change="onFile"
			>
			<Icon type="upload" />
		</label>
	</div>
</template>
<script setup lang="ts">
import { Icon, Input } from '@deot/vc';
import { useLocale } from '@deot/docs-locale';

defineProps<{
	modelValue: string;
	placeholder?: string;
}>();
const emit = defineEmits<{ 'update:modelValue': [value: string] }>();
const { t } = useLocale();

/**
 * 本地图片读成 data URL，控件因此同时接受路径、https 和 base64。
 * @param event 隐藏 file input 的 change 事件。
 */
const onFile = (event: Event) => {
	const input = event.target as HTMLInputElement;
	const file = input.files?.[0];
	input.value = '';
	if (!file) return;
	const reader = new FileReader();
	reader.onload = () => {
		const result = String(reader.result || '');
		if (result.startsWith('data:image/')) emit('update:modelValue', result);
	};
	reader.readAsDataURL(file);
};
</script>
