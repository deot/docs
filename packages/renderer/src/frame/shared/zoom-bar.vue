<template>
	<div class="docs-renderer-zoom-bar">
		<div v-if="$slots.aids" class="docs-renderer-zoom-bar__aids">
			<slot name="aids" />
		</div>
		<div class="docs-renderer-zoom-bar__content">
			<Select
				:model-value="scale"
				:data="options"
				:aria-label="t('renderer.canvas.scale')"
				placement="top-left"
				portal-class="docs-renderer-zoom-bar__popup"
				class="docs-renderer-zoom-bar__select"
				@ready="handleSelectReady"
				@update:model-value="handleUpdate"
			/>
			<Slider
				:model-value="scale"
				:min="MIN_SCALE"
				:max="MAX_SCALE"
				:step="0.01"
				:formatter="formatScale"
				class="docs-renderer-zoom-bar__slider"
				@update:model-value="handleUpdate"
			/>
		</div>
	</div>
</template>
<script setup lang="ts">
import { computed, nextTick } from 'vue';
import { Select, Slider } from '@deot/vc';
import { Resize } from '@deot/helper-resize';
import { useLocale } from '@deot/docs-locale';

const MIN_SCALE = 0.1;
const MAX_SCALE = 2;
const SCALE_OPTIONS = [0.1, 0.5, 1, 1.5, 2];
const props = defineProps<{
	scale: number;
	fitScale: number;
}>();
const emit = defineEmits<{
	'update:scale': [value: number];
}>();
const { t } = useLocale();
const normalizeScale = (value: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, value));
const formatScale = (value: number) => `${Math.round(value * 100)}%`;
const normalizedFitScale = computed(() => normalizeScale(props.fitScale || 1));
const options = computed(() => {
	const values = [...new Set([
		...SCALE_OPTIONS,
		normalizedFitScale.value,
		normalizeScale(props.scale)
	])].sort((left, right) => left - right);
	return values.map(value => ({
		label: Math.abs(value - normalizedFitScale.value) < 0.001
			? `${t('renderer.canvas.fit')} · ${formatScale(value)}`
			: formatScale(value),
		value
	}));
});

/**
 * Select 和 Slider 共用同一条归一化入口，避免两种控件产生不同缩放范围。
 * @param value 组件产生的缩放值。
 */
const handleUpdate = (value: number | string) => {
	const next = Number(value);
	if (!Number.isFinite(next)) return;
	emit('update:scale', normalizeScale(next));
};

/**
 * 缩放选项是固定短列表，不需要 Select 内部 Scroller 持续测量尺寸。
 * 关闭这两个观察器可避免 Chromium 在弹层首次布局时报告 ResizeObserver 循环。
 */
const handleSelectReady = async () => {
	await nextTick();
	document.querySelectorAll<HTMLElement>([
		'.docs-renderer-zoom-bar__popup .vc-select__options > .vc-scroller__wrapper',
		'.docs-renderer-zoom-bar__popup .vc-select__options .vc-scroller__content'
	].join(',')).forEach(element => Resize.off(element));
};
</script>
