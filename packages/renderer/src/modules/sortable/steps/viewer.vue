<template>
	<section
		class="docs-renderer-steps"
		:class="{ 'is-center': align === 'center', 'is-left': align === 'left' }"
		:style="rootStyle"
	>
		<header v-if="hasHeader" class="docs-renderer-steps__header">
			<div v-if="title || eyebrow" class="docs-renderer-steps__heading-row">
				<h2 v-if="title" class="docs-renderer-steps__heading">{{ title }}</h2>
				<span v-if="eyebrow" class="docs-renderer-steps__eyebrow">{{ eyebrow }}</span>
			</div>
			<p v-if="description" class="docs-renderer-steps__lead">{{ description }}</p>
		</header>
		<ol
			class="docs-renderer-steps__list"
			:class="isVertical ? 'is-vertical' : 'is-horizontal'"
			:style="listStyle"
		>
			<li
				v-for="(item, index) in items"
				:key="index"
				class="docs-renderer-steps__item"
				:class="{ 'is-row-end': isRowEnd(index) }"
				:style="itemStyle(item, index)"
			>
				<div class="docs-renderer-steps__marker">
					<span class="docs-renderer-steps__index">{{ iconOf(item, index) }}</span>
				</div>
				<div class="docs-renderer-steps__body">
					<h3 class="docs-renderer-steps__title">{{ item.title }}</h3>
					<p class="docs-renderer-steps__description">{{ item.description }}</p>
				</div>
				<span class="docs-renderer-steps__rail" aria-hidden="true" />
			</li>
		</ol>
	</section>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import type { CSSProperties } from 'vue';
import type { RendererModuleViewerProps } from '../../../types';
import { rendererSortableSectionStyle } from '../../../frame/shared/sortable-width';
import { toLength, toRecord } from '../../shared/utils';
import { featureAccentOf } from '../features/palette';

const props = defineProps<RendererModuleViewerProps>();
const value = computed(() => props.node.module.props);
const eyebrow = computed(() => String(value.value.eyebrow || ''));
const title = computed(() => String(value.value.title || ''));
const description = computed(() => String(value.value.description || ''));
const align = computed(() => String(value.value.align || 'center'));
const hasHeader = computed(() => Boolean(eyebrow.value || title.value || description.value));
const items = computed(() => (Array.isArray(value.value.items) ? value.value.items : []).map(toRecord));
const columns = computed(() => Math.max(1, toLength(value.value.columns, 3)));
const isVertical = computed(() => columns.value <= 1);
const rootStyle = computed(() => rendererSortableSectionStyle(String(value.value.accent || '')));
const listStyle = computed(() => ({
	'--docs-renderer-columns': columns.value
}) as CSSProperties);
const itemStyle = (item: Record<string, unknown>, index: number) => ({
	'--docs-renderer-card-accent': String(item.accent || featureAccentOf(index)),
	'--docs-renderer-delay': `${index * 80}ms`
}) as CSSProperties;
const isRowEnd = (index: number) => (
	index === items.value.length - 1
	|| (!isVertical.value && (index + 1) % columns.value === 0)
);
const iconOf = (item: Record<string, unknown>, index: number) => (
	String(item.icon || '').trim() || String(index + 1)
);
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

@mixin docs-renderer-steps-stack {
	grid-template-columns: minmax(0, 1fr);
	gap: 0;

	.docs-renderer-steps__item {
		padding-bottom: 52px;

		&:last-child {
			padding-bottom: 0;
		}
	}

	.docs-renderer-steps__body {
		max-width: min(32rem, 100%);
	}

	.docs-renderer-steps__rail {
		inset: auto auto 0 50%;
		width: 1px;
		height: 28px;
		background: linear-gradient(
			180deg,
			color-mix(in srgb, var(--docs-renderer-card-accent) 42%, transparent),
			color-mix(in srgb, var(--docs-renderer-card-accent) 12%, transparent)
		);
		transform: translateX(-50%);
	}

	.docs-renderer-steps__rail::after {
		inset: auto auto 0 50%;
		transform: translateX(-50%) rotate(135deg);
	}

	.docs-renderer-steps__item:last-child .docs-renderer-steps__rail {
		display: none;
	}
}

.docs-renderer-steps {
	--docs-renderer-accent: varfix(primary-color);
	--docs-renderer-step-size: 40px;
	--docs-renderer-step-gap: 36px;

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
		padding: 0;
		margin: 0;
		overflow: visible;
		list-style: none;
		grid-template-columns: repeat(var(--docs-renderer-columns, 3), minmax(0, 1fr));
		gap: 32px var(--docs-renderer-step-gap);
	}

	&__item {
		--docs-renderer-card-accent: var(--docs-renderer-accent);

		position: relative;
		display: grid;
		gap: 18px;
		justify-items: center;
		align-content: start;
		text-align: center;
		animation: docs-renderer-rise 0.55s ease var(--docs-renderer-delay, 0ms) backwards;
	}

	&__marker {
		position: relative;
		z-index: 1;
		display: flex;
		width: 100%;
		height: var(--docs-renderer-step-size);
		justify-content: center;
	}

	&__index {
		position: relative;
		z-index: 1;
		display: inline-flex;
		width: var(--docs-renderer-step-size);
		height: var(--docs-renderer-step-size);
		font-size: 14px;
		font-weight: 700;
		line-height: 1;
		color: var(--docs-renderer-card-accent);
		background: color-mix(in srgb, var(--docs-renderer-card-accent) 10%, varfix(background-color-soft));
		border: 1.5px solid color-mix(in srgb, var(--docs-renderer-card-accent) 72%, varfix(border-color));
		border-radius: 50%;
		font-variant-numeric: tabular-nums;
		align-items: center;
		justify-content: center;
		transition: color 0.22s ease, background 0.22s ease, border-color 0.22s ease, transform 0.22s ease;
	}

	&__item:hover &__index {
		color: var(--docs-renderer-card-accent);
		background: color-mix(in srgb, var(--docs-renderer-card-accent) 18%, varfix(background-color-soft));
		border-color: var(--docs-renderer-card-accent);
		transform: scale(1.04);
	}

	&__rail {
		position: absolute;
		top: calc(var(--docs-renderer-step-size) / 2);
		left: calc(50% + var(--docs-renderer-step-size) / 2 + 8px);
		width: calc(100% + var(--docs-renderer-step-gap) - var(--docs-renderer-step-size) - 16px);
		height: 1px;
		pointer-events: none;
		background: linear-gradient(
			90deg,
			color-mix(in srgb, var(--docs-renderer-card-accent) 42%, transparent),
			color-mix(in srgb, var(--docs-renderer-card-accent) 12%, transparent)
		);
		transform: translateY(-50%);

		&::after {
			position: absolute;
			top: 50%;
			right: 0;
			width: 6px;
			height: 6px;
			border-block-start: 1.5px solid color-mix(in srgb, var(--docs-renderer-card-accent) 48%, varfix(border-color));
			border-inline-end: 1.5px solid color-mix(in srgb, var(--docs-renderer-card-accent) 48%, varfix(border-color));
			content: '';
			transform: translateY(-50%) rotate(45deg);
		}
	}

	&__item.is-row-end &__rail {
		display: none;
	}

	&__body {
		display: grid;
		gap: 6px;
		max-width: min(18rem, 100%);
		min-width: 0;
	}

	&__title {
		margin: 0;
		font-size: 17px;
		font-weight: 600;
		line-height: 1.35;
		letter-spacing: -0.03em;
		color: varfix(foreground-color);
		text-wrap: balance;
		transition: color 0.22s ease;
	}

	&__item:hover &__title {
		color: var(--docs-renderer-card-accent);
	}

	&__description {
		margin: 0;
		font-size: 13px;
		line-height: 1.7;
		color: varfix(foreground-color-light);
		text-wrap: pretty;
	}

	&__list.is-vertical {
		@include docs-renderer-steps-stack;
	}

	@media (width <= 860px) {
		&__list.is-horizontal {
			@include docs-renderer-steps-stack;
		}

		&__list.is-horizontal .docs-renderer-steps__item.is-row-end:not(:last-child) .docs-renderer-steps__rail {
			display: block;
		}
	}
}

@media (prefers-reduced-motion: reduce) {
	.docs-renderer-steps__item,
	.docs-renderer-steps__index,
	.docs-renderer-steps__title {
		animation: none !important;
		transition: none !important;
	}
}

@keyframes docs-renderer-rise {
	from {
		opacity: 0;
		transform: translateY(14px);
	}

	to {
		opacity: 1;
		transform: translateY(0);
	}
}

.docs-renderer-node.is-editing {
	.docs-renderer-steps__item {
		animation: none;
	}
}

@media screen and (width <= 768px) {
	.docs-renderer-steps {
		padding: 24px 0;

		&__item,
		&__list.is-horizontal &__item,
		&__list.is-vertical &__item {
			display: grid;
			padding-bottom: 36px;
			text-align: left;
			grid-template-columns: var(--docs-renderer-step-size) minmax(0, 1fr);
			column-gap: 16px;
			justify-items: stretch;

			&:last-child {
				padding-bottom: 0;
			}
		}

		&__marker {
			width: var(--docs-renderer-step-size);
			grid-row: 1;
			grid-column: 1;
		}

		&__body {
			width: 100%;
			max-width: none;
			padding-top: 2px;
			grid-row: 1;
			grid-column: 2;
		}

		&__rail,
		&__list.is-horizontal &__rail,
		&__list.is-vertical &__rail,
		&__list.is-horizontal &__item.is-row-end:not(:last-child) &__rail {
			inset: var(--docs-renderer-step-size) auto 0 calc(var(--docs-renderer-step-size) / 2);
			width: 1px;
			height: auto;
			transform: translateX(-50%);

			&::after {
				inset: auto auto 2px 50%;
				transform: translateX(-50%) rotate(135deg);
			}
		}
	}
}
</style>
