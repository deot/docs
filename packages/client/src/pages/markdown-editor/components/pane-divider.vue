<template>
	<div
		class="docs-markdown-editor-pane-divider"
		:class="{ 'is-dragging': dragging }"
		role="separator"
		tabindex="0"
		aria-orientation="vertical"
		:aria-label="t('client.markdownEditor.resize')"
		:aria-valuenow="Math.round(modelValue)"
		aria-valuemin="20"
		aria-valuemax="80"
		@pointerdown.prevent="start"
		@pointermove="move"
		@pointerup="dragging = false"
		@pointercancel="dragging = false"
		@lostpointercapture="dragging = false"
		@keydown.left.prevent="change(modelValue - 2)"
		@keydown.right.prevent="change(modelValue + 2)"
	></div>
</template>
<script setup lang="ts">
import { ref } from 'vue';
import { useLocale } from '@deot/docs-locale';

const props = defineProps<{ modelValue: number }>();
const emit = defineEmits<{ 'update:modelValue': [value: number] }>();
const { t } = useLocale();
const dragging = ref(false);
let startX = 0;
let startValue = 50;
const change = (value: number) => emit('update:modelValue', Math.min(80, Math.max(20, value)));
const start = (event: PointerEvent) => {
	if (event.button !== 0) return;
	startX = event.clientX;
	startValue = props.modelValue;
	dragging.value = true;
	(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
};
const move = (event: PointerEvent) => {
	if (!dragging.value) return;
	const divider = event.currentTarget as HTMLElement;
	const width = divider.parentElement!.clientWidth - divider.offsetWidth;
	change(startValue + (event.clientX - startX) / width * 100);
};
</script>
<style lang="scss">
@use '../../../styles/bem' as *;

@include block(docs-markdown-editor-pane-divider) {
	position: relative;
	cursor: col-resize;
	background: varfix(background-color-light);
	touch-action: none;

	&::before {
		position: absolute;
		top: 0;
		left: 50%;
		width: 1px;
		height: 100%;
		background: varfix(border-color);
		content: '';
	}

	&:hover, &:focus-visible, &.is-dragging {
		background: varfix(background-color-lighter);

		&::before {
			background: varfix(foreground-color-light);
		}
	}

}

@media screen and (width <= 720px) {
	.docs-markdown-editor-pane-divider {
		display: none;
	}
}
</style>
