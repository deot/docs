<template>
	<section
		class="docs-renderer-faq"
		:class="{ 'is-center': align === 'center', 'is-left': align === 'left' }"
		:style="rootStyle"
	>
		<header v-if="hasHeader" class="docs-renderer-faq__header">
			<div v-if="title || eyebrow" class="docs-renderer-faq__heading-row">
				<h2 v-if="title" class="docs-renderer-faq__heading">{{ title }}</h2>
				<span v-if="eyebrow" class="docs-renderer-faq__eyebrow">{{ eyebrow }}</span>
			</div>
			<p v-if="description" class="docs-renderer-faq__lead">{{ description }}</p>
		</header>
		<div class="docs-renderer-faq__list">
			<details
				v-for="(item, index) in items"
				:key="index"
				class="docs-renderer-faq__item"
				:open="index === 0"
			>
				<summary class="docs-renderer-faq__question">{{ item.question }}</summary>
				<p class="docs-renderer-faq__answer">{{ item.answer }}</p>
			</details>
		</div>
	</section>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import type { RendererModuleViewerProps } from '../../../types';
import { rendererSortableSectionStyle } from '../../../frame/shared/sortable-width';
import { toRecord } from '../../shared/utils';

const props = defineProps<RendererModuleViewerProps>();
const value = computed(() => props.node.module.props);
const eyebrow = computed(() => String(value.value.eyebrow || ''));
const title = computed(() => String(value.value.title || ''));
const description = computed(() => String(value.value.description || ''));
const align = computed(() => String(value.value.align || 'center'));
const hasHeader = computed(() => Boolean(eyebrow.value || title.value || description.value));
const items = computed(() => (Array.isArray(value.value.items) ? value.value.items : []).map(toRecord));
const rootStyle = computed(() => rendererSortableSectionStyle(String(value.value.accent || '')));
</script>
<style lang="scss">
@use '../../../../node_modules/@deot/docs-theme/src/functions' as *;

@mixin docs-renderer-section-tag {
	display: inline-flex;
	padding: 4px 9px 4px 8px;
	font-size: 10px;
	font-weight: 700;
	line-height: 1.2;
	letter-spacing: 0.08em;
	color: var(--docs-renderer-accent, varfix(primary-color));
	white-space: nowrap;
	background:
		linear-gradient(
			180deg,
			var(--docs-renderer-accent, varfix(primary-color)),
			var(--docs-renderer-accent, varfix(primary-color))
		) 0 0 / 3px 100% no-repeat,
		color-mix(in srgb, var(--docs-renderer-accent, varfix(primary-color)) 10%, varfix(background-color));
	border: 0;
	border-radius: 2px;
	box-shadow:
		inset 0 0 0 1px color-mix(in srgb, var(--docs-renderer-accent, varfix(primary-color)) 24%, transparent),
		3px 3px 0 0 color-mix(in srgb, var(--docs-renderer-accent, varfix(primary-color)) 16%, transparent);
	align-items: center;
	flex-shrink: 0;
	gap: 5px;

	&::before {
		font-size: 11px;
		font-weight: 800;
		line-height: 1;
		content: '#';
		opacity: 0.55;
	}
}

@mixin docs-renderer-section-copy {
	width: 100%;
	max-width: var(--docs-renderer-content-width, 100%);
	margin-inline: auto;
	box-sizing: border-box;

	&.is-center &__header {
		margin-inline: auto;
		text-align: center;
	}

	&.is-left &__header {
		margin-inline: 0 auto;
		text-align: left;
	}

	&__header {
		max-width: 42rem;
		margin-bottom: 40px;
	}

	&__heading-row {
		position: relative;
		width: fit-content;
		max-width: 100%;
		margin-bottom: 12px;
	}

	&.is-center &__heading-row {
		margin-inline: auto;
	}

	&.is-left &__heading-row {
		margin-inline: 0;
	}

	&__eyebrow {
		@include docs-renderer-section-tag;
	}

	&__heading-row:has(h2) &__eyebrow {
		position: absolute;
		top: 50%;
		left: 100%;
		z-index: 1;
		margin-left: 10px;
		transform: translateY(-50%) rotate(-4deg);
	}

	&__heading {
		margin: 0;
		font-size: clamp(28px, 3.4vw, 40px);
		font-weight: 700;
		line-height: 1.2;
		letter-spacing: -0.04em;
		color: varfix(foreground-color);
		text-wrap: balance;
	}

	&__lead {
		margin: 0;
		font-size: 16px;
		line-height: 1.7;
		color: varfix(foreground-color-light);
	}
}

.docs-renderer-faq {
	--docs-renderer-accent: varfix(primary-color);

	@include docs-renderer-section-copy;

	padding: 48px 0;
	background: varfix(background-color);
	box-sizing: border-box;

	@at-root .docs-renderer-node.is-full-width #{&} {
		max-width: none;
		padding-right: max(24px, calc((100% - var(--docs-renderer-content-width, 100%)) / 2));
		padding-left: max(24px, calc((100% - var(--docs-renderer-content-width, 100%)) / 2));
	}

	&__list {
		display: grid;
	}

	&__item {
		min-width: 0;
		padding: 0;
		background: transparent;
		border: 0;
		border-radius: 0;
	}

	&__item + &__item {
		border-top: 1px solid varfix(border-color);
	}

	&__question {
		display: flex;
		padding: 18px 0;
		font-size: 16px;
		font-weight: 600;
		line-height: 1.5;
		letter-spacing: -0.02em;
		color: varfix(foreground-color);
		list-style: none;
		cursor: pointer;
		align-items: center;
		justify-content: space-between;
		gap: 24px;
		transition: color 0.2s ease;

		&::-webkit-details-marker {
			display: none;
		}

		&::after {
			width: 7px;
			height: 7px;
			border-right: 1.5px solid varfix(foreground-color-mute);
			border-bottom: 1.5px solid varfix(foreground-color-mute);
			content: '';
			transform: rotate(45deg);
			flex-shrink: 0;
			transition: transform 0.2s ease, border-color 0.2s ease;
		}

		&:hover {
			color: var(--docs-renderer-accent);
		}
	}

	&__item[open] &__question {
		padding-bottom: 8px;
		color: var(--docs-renderer-accent);

		&::after {
			margin-top: 4px;
			border-color: var(--docs-renderer-accent);
			transform: rotate(225deg);
		}
	}

	&__answer {
		max-width: 42rem;
		padding: 0 0 18px;
		margin: 0;
		font-size: 15px;
		line-height: 1.75;
		color: varfix(foreground-color-light);
	}

	&__item[open] &__answer {
		animation: docs-renderer-faq-in 0.28s ease;
	}
}

@media (prefers-reduced-motion: reduce) {
	.docs-renderer-faq__answer {
		animation: none !important;
		transition: none !important;
	}
}

@keyframes docs-renderer-faq-in {
	from {
		opacity: 0;
		transform: translateY(-4px);
	}

	to {
		opacity: 1;
		transform: translateY(0);
	}
}

@media screen and (width <= 768px) {
	.docs-renderer-faq {
		padding: 24px 0;
	}
}
</style>
