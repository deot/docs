<template>
	<div
		ref="root"
		class="docs-content-width"
		role="radiogroup"
		:aria-label="t('client.page.width')"
		@keydown="handleKeydown"
	>
		<button
			v-for="option in options"
			:key="option.value"
			class="docs-content-width__option"
			:class="{ 'is-active': contentWidth === option.value }"
			type="button"
			role="radio"
			:aria-checked="contentWidth === option.value"
			:aria-label="option.label"
			:tabindex="contentWidth === option.value ? 0 : -1"
			@click="setContentWidth(option.value)"
		>
			<ClientIcon class="docs-content-width__icon" :name="option.icon" :size="12" />
		</button>
	</div>
</template>
<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';
import { useLocale } from '@deot/docs-locale';
import ClientIcon from '../icon';
import type { ClientIconName } from '../icon';
import { ContentWidth, CONTENT_WIDTHS } from '../../modules/settings';
import type { DocsContentWidth } from '../../modules/settings';

defineOptions({ name: 'DocsContentWidthToggle' });

const { t } = useLocale();
const root = ref<HTMLElement>();
const contentWidth = ContentWidth.current;
const options = computed(() => ([
	{ value: 'regular' as const, icon: 'widthRegular' as ClientIconName, label: t('client.page.widthRegular') },
	{ value: 'wide' as const, icon: 'widthWide' as ClientIconName, label: t('client.page.widthWide') },
	{ value: 'full' as const, icon: 'widthFull' as ClientIconName, label: t('client.page.widthFull') }
]));
const setContentWidth = (next: DocsContentWidth) => {
	void ContentWidth.set(next);
};
const handleKeydown = (event: KeyboardEvent) => {
	const offset = event.key === 'ArrowRight' || event.key === 'ArrowDown'
		? 1
		: event.key === 'ArrowLeft' || event.key === 'ArrowUp'
			? -1
			: 0;
	if (!offset) return;
	event.preventDefault();
	const index = CONTENT_WIDTHS.indexOf(contentWidth.value);
	const next = CONTENT_WIDTHS[(index + offset + CONTENT_WIDTHS.length) % CONTENT_WIDTHS.length] as DocsContentWidth;
	setContentWidth(next);
	void nextTick(() => {
		root.value?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus();
	});
};
</script>
<style lang="scss">
@use '../../styles/bem' as *;

@include block(docs-content-width) {
	display: inline-grid;
	grid-template-columns: repeat(3, 20px);
	gap: 4px;
	padding: 2px;
	color: varfix(foreground-color-mute);
	background: rgb(3 7 18 / 4%);
	border-radius: 999px;

	@include element(option) {
		display: grid;
		width: 20px;
		height: 20px;
		padding: 0;
		color: inherit;
		cursor: pointer;
		background: transparent;
		border: 0;
		border-radius: 999px;
		place-items: center;

		&.is-active {
			color: varfix(foreground-color-light);
			background: #fff;
			box-shadow:
				0 0 0 1px rgb(255 255 255 / 10%) inset,
				0 0 0 1px rgb(3 7 18 / 8%);
		}

		&:focus-visible {
			outline: 2px solid varfix(link-color);
			outline-offset: 1px;
		}
	}

	@include element(icon) {
		width: 12px;
		height: 12px;
	}
}

[data-doc-theme='dark'] .docs-content-width,
[data-vc-theme='dark'] .docs-content-width {
	background: rgb(255 255 255 / 8%);

	.docs-content-width__option.is-active {
		color: #e5e7eb;
		background: rgb(255 255 255 / 12%);
		box-shadow: none;
	}
}
</style>
