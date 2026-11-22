<template>
	<div
		class="docs-playground__variables"
		role="group"
		:aria-label="t('playground.runtime.previewVariables')"
	>
		<div
			v-for="item in variables"
			:key="item.name"
			class="docs-playground__variable"
		>
			<span class="docs-playground__variable-label">{{ item.label }}</span>
			<div
				class="docs-playground__variable-options"
				role="radiogroup"
				:aria-label="item.label"
			>
				<button
					v-for="value in item.values"
					:key="value"
					type="button"
					class="docs-playground__variable-option"
					:class="{ 'is-active': value === selected[item.name] }"
					role="radio"
					:data-name="item.name"
					:data-value="value"
					:aria-checked="value === selected[item.name]"
					:aria-label="t('playground.runtime.previewVariable', { label: item.label, value })"
					@click="emit('select', item.name, value)"
				>
					{{ value }}
				</button>
			</div>
		</div>
	</div>
</template>
<script setup lang="ts">
import { useLocale } from '@deot/docs-locale';
import type { NormalizedPreviewVariable } from './preview-variables';

defineProps<{
	variables: NormalizedPreviewVariable[];
	selected: Record<string, string>;
}>();

const emit = defineEmits<{
	select: [name: string, value: string];
}>();

const { t } = useLocale();
</script>
<style lang="scss">
@use '../../style' as *;

@include block(docs-playground) {
	@include element(variables) {
		display: flex;
		padding: 8px 10px;
		border-top: 1px solid var(--docs-border-color, var(--vc-border-color, #e2e8f0));
		box-sizing: border-box;
		flex: 0 0 auto;
		flex-wrap: wrap;
		gap: 8px 12px;
		align-items: center;
	}

	@include element(variable) {
		display: inline-flex;
		min-width: 0;
		gap: 8px;
		align-items: center;
	}

	@include element(variable-label) {
		font-size: 12px;
		line-height: 16px;
		color: var(--docs-foreground-color-light, var(--vc-color-dark-lightest, #64748b));
		white-space: nowrap;
	}

	@include element(variable-options) {
		display: inline-flex;
		padding: 2px;
		background: var(--docs-background-color-light, var(--vc-background-color, #f1f5f9));
		border-radius: 999px;
		gap: 0;
		align-items: center;
	}

	@include element(variable-option) {
		display: inline-flex;
		height: 24px;
		padding: 0 8px;
		font: inherit;
		font-size: 12px;
		font-weight: 500;
		line-height: 16px;
		color: var(--docs-foreground-color-light, var(--vc-color-dark-lightest, #64748b));
		white-space: nowrap;
		cursor: pointer;
		background: transparent;
		border: 0;
		border-radius: 999px;
		justify-content: center;
		align-items: center;

		&:hover {
			color: var(--docs-foreground-color-dark, var(--vc-foreground-color, #18181b));
		}

		&:focus-visible {
			outline: 2px solid var(--docs-color-primary, var(--vc-color-primary, #2563eb));
			outline-offset: 1px;
		}

		@include when(active) {
			color: var(--docs-foreground-color-dark, var(--vc-foreground-color, #18181b));
			background: var(--docs-background-color-lightest, var(--vc-background-color-lightest, #fff));
			box-shadow: 0 1px 2px rgb(15 23 42 / 8%);
		}
	}
}
</style>
