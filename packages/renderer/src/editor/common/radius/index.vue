<template>
	<div class="docs-renderer-radius-editor">
		<div class="docs-renderer-radius-editor__row">
			<NumberEditor
				prefix="R"
				:title="t('renderer.inspector.borderRadius')"
				:model-value="uniform"
				:min="0"
				:max="240"
				@update:model-value="handleUniform"
			/>
			<button
				type="button"
				class="docs-renderer-radius-editor__independent"
				:class="{ 'is-active': independent }"
				:title="t('renderer.inspector.independentCorners')"
				:aria-label="t('renderer.inspector.independentCorners')"
				:aria-pressed="independent"
				@click="toggleIndependent"
			/>
		</div>
		<div v-if="independent" class="docs-renderer-editor__pair">
			<NumberEditor
				v-for="key in cornerKeys"
				:key="key"
				:prefix="cornerPrefix[key]"
				:title="t(cornerTitle[key])"
				:model-value="Number(modelValue[key] ?? uniform)"
				:min="0"
				:max="240"
				@update:model-value="value => emit('update:modelValue', { [key]: value })"
			/>
		</div>
	</div>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import { useLocale } from '@deot/docs-locale';
import type { LocaleKey } from '@deot/docs-locale';
import type { RendererCornerRadii } from '../../../types';
import {
	RENDERER_CORNER_RADIUS_KEYS,
	hasIndependentRendererCorners,
	resolveRendererCornerRadii,
	type RendererCornerRadiusKey
} from '../../../utils/radius';
import NumberEditor from '../number/index.vue';

const props = defineProps<{
	modelValue: RendererCornerRadii;
}>();
const emit = defineEmits<{ 'update:modelValue': [value: Partial<RendererCornerRadii>] }>();
const { t } = useLocale();
const cornerKeys = RENDERER_CORNER_RADIUS_KEYS;
const cornerPrefix: Record<RendererCornerRadiusKey, string> = {
	borderRadiusTopLeft: 'TL',
	borderRadiusTopRight: 'TR',
	borderRadiusBottomRight: 'BR',
	borderRadiusBottomLeft: 'BL'
};
const cornerTitle: Record<RendererCornerRadiusKey, LocaleKey> = {
	borderRadiusTopLeft: 'renderer.inspector.borderRadiusTopLeft',
	borderRadiusTopRight: 'renderer.inspector.borderRadiusTopRight',
	borderRadiusBottomRight: 'renderer.inspector.borderRadiusBottomRight',
	borderRadiusBottomLeft: 'renderer.inspector.borderRadiusBottomLeft'
};
const independent = computed(() => hasIndependentRendererCorners(props.modelValue));
const uniform = computed(() => resolveRendererCornerRadii(props.modelValue).topLeft);
const unsetIndependent = {
	borderRadiusTopLeft: undefined,
	borderRadiusTopRight: undefined,
	borderRadiusBottomRight: undefined,
	borderRadiusBottomLeft: undefined
} satisfies Partial<RendererCornerRadii>;

/**
 * 统一圆角：未拆角时只写 `borderRadius`；已拆角时四个角一起改。
 * @param value 输入框中的圆角。
 */
const handleUniform = (value: number) => {
	if (!independent.value) {
		emit('update:modelValue', { borderRadius: value });
		return;
	}
	emit('update:modelValue', {
		borderRadius: value,
		borderRadiusTopLeft: value,
		borderRadiusTopRight: value,
		borderRadiusBottomRight: value,
		borderRadiusBottomLeft: value
	});
};

/**
 * 展开时把当前统一值复制到四角；收起时只保留统一圆角。
 */
const toggleIndependent = () => {
	const value = uniform.value;
	if (independent.value) {
		emit('update:modelValue', { borderRadius: value, ...unsetIndependent });
		return;
	}
	emit('update:modelValue', {
		borderRadius: value,
		borderRadiusTopLeft: value,
		borderRadiusTopRight: value,
		borderRadiusBottomRight: value,
		borderRadiusBottomLeft: value
	});
};
</script>
<style lang="scss">
@use '../../../../node_modules/@deot/docs-theme/src/functions' as *;

.docs-renderer-radius-editor {
	display: grid;
	gap: 6px;
	min-width: 0;

	&__row {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 26px;
		gap: 6px;
		min-width: 0;
		align-items: center;
	}

	&__independent {
		position: relative;
		width: 26px;
		height: 26px;
		padding: 0;
		color: varfix(foreground-color-mute);
		cursor: pointer;
		background: varfix(background-color-soft);
		border: 0;
		border-radius: 6px;

		&::before {
			position: absolute;
			inset: 7px;
			border: 1.5px solid currentcolor;
			border-radius: 2px;
			content: '';
		}

		&.is-active {
			color: varfix(primary-color);
			background: varfix(primary-color-light);
		}
	}
}
</style>
