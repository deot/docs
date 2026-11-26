<template>
	<div
		class="docs-playground__variables"
		:class="{ 'is-collapsed': collapsed }"
		role="group"
		:aria-label="t('playground.runtime.previewVariables')"
	>
		<div ref="listEl" class="docs-playground__variables-list">
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
						v-for="option in item.options"
						:key="option.value"
						type="button"
						class="docs-playground__variable-option"
						:class="{ 'is-active': option.value === selected[item.name] }"
						role="radio"
						:data-name="item.name"
						:data-value="option.value"
						:title="option.label === option.value ? undefined : option.value"
						:aria-checked="option.value === selected[item.name]"
						:aria-label="t('playground.runtime.previewVariable', { label: item.label, value: option.label })"
						@click="emit('select', item.name, option.value)"
					>
						{{ option.label }}
					</button>
				</div>
			</div>
		</div>
		<button
			v-if="showToggle"
			type="button"
			class="docs-playground__variables-toggle"
			data-action="toggle-variables"
			:aria-expanded="!collapsed"
			:title="toggleLabel"
			:aria-label="toggleLabel"
			@click="handleToggle"
		>
			<PlaygroundIcon name="expand" />
		</button>
	</div>
</template>
<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useLocale } from '@deot/docs-locale';
import PlaygroundIcon from '../../icon';
import type { NormalizedPreviewVariable } from './preview-variables';

/** 折叠时只露出一行分段控件的高度（含 2px 内边距）。 */
const COLLAPSED_ROW_HEIGHT = 28;

const props = defineProps<{
	variables: NormalizedPreviewVariable[];
	selected: Record<string, string>;
}>();

const emit = defineEmits<{
	select: [name: string, value: string];
}>();

const { t } = useLocale();
const listEl = ref<HTMLElement | null>(null);
const collapsed = ref(true);
const overflow = ref(false);
let observer: ResizeObserver | null = null;

const showToggle = computed(() => overflow.value);
const toggleLabel = computed(() => t(collapsed.value
	? 'playground.runtime.expandVariables'
	: 'playground.runtime.collapseVariables'));

const syncOverflow = () => {
	const list = listEl.value;
	if (!list) return;
	// 始终按「折叠为一行」的高度判断是否溢出，避免展开后 scrollHeight≈clientHeight 把 overflow 清掉
	overflow.value = list.scrollHeight > COLLAPSED_ROW_HEIGHT + 1;
};

const handleToggle = () => {
	collapsed.value = !collapsed.value;
};

onMounted(() => {
	syncOverflow();
	if (typeof ResizeObserver === 'undefined' || !listEl.value) return;
	observer = new ResizeObserver(syncOverflow);
	observer.observe(listEl.value);
});

onBeforeUnmount(() => {
	observer?.disconnect();
	observer = null;
});

watch(() => props.variables, async () => {
	collapsed.value = true;
	await nextTick();
	syncOverflow();
});

watch(collapsed, async () => {
	await nextTick();
	syncOverflow();
});
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
		gap: 8px;
		align-items: flex-start;

		@include when(collapsed) {
			.docs-playground__variables-list {
				max-height: 28px;
				overflow: hidden;
			}
		}
	}

	@include element(variables-list) {
		display: flex;
		min-width: 0;
		flex: 1 1 auto;
		flex-wrap: wrap;
		gap: 8px 12px;
		align-items: center;
	}

	@include element(variables-toggle) {
		display: inline-flex;
		width: 28px;
		height: 28px;
		padding: 0;
		color: var(--docs-foreground-color-light, var(--vc-color-dark-lightest, #64748b));
		cursor: pointer;
		background: transparent;
		border: 0;
		border-radius: 999px;
		flex: 0 0 auto;
		justify-content: center;
		align-items: center;

		.docs-playground-icon {
			width: 14px;
			height: 14px;
			transition: transform 0.15s ease;
		}

		&[aria-expanded='true'] .docs-playground-icon {
			transform: rotate(180deg);
		}

		&:hover {
			color: var(--docs-foreground-color-dark, var(--vc-foreground-color, #18181b));
		}

		&:focus-visible {
			outline: 2px solid var(--docs-color-primary, var(--vc-color-primary, #2563eb));
			outline-offset: 1px;
		}
	}

	@include element(variable) {
		display: inline-flex;
		height: 28px;
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
		height: 28px;
		padding: 2px;
		background: var(--docs-background-color-light, var(--vc-background-color, #f1f5f9));
		border-radius: 999px;
		box-sizing: border-box;
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
