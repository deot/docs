<template>
	<section
		ref="root"
		class="docs-renderer-steps"
		:class="{ 'is-center': align === 'center', 'is-left': align === 'left', 'is-right': align === 'right' }"
		:style="rootStyle"
	>
		<header v-if="hasHeader" class="docs-renderer-steps__header" data-landing-reveal>
			<div v-if="title || eyebrow" class="docs-renderer-steps__heading-row">
				<span v-if="eyebrow" class="docs-renderer-steps__eyebrow">{{ eyebrow }}</span>
				<h2 v-if="title" class="docs-renderer-steps__heading">{{ title }}</h2>
			</div>
			<p v-if="description" class="docs-renderer-steps__lead">{{ description }}</p>
		</header>
		<ol
			class="docs-renderer-steps__list"
			:class="isVertical ? 'is-vertical' : 'is-horizontal'"
			:style="listStyle"
			data-landing-reveal
		>
			<li
				v-for="(item, index) in items"
				:key="index"
				class="docs-renderer-steps__item"
				:class="{ 'is-row-end': isRowEnd(index) }"
				:style="itemStyle(item)"
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
import { useLandingMotion } from '../../shared/landing-motion';

const props = defineProps<RendererModuleViewerProps>();
const root = useLandingMotion(() => props.context);
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
const itemStyle = (item: Record<string, unknown>) => ({
	'--docs-renderer-card-accent': String(item.accent || '').trim() || undefined
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
@use '../../shared/landing' as landing;

@mixin stack {
	grid-template-columns: minmax(0, 1fr);
	gap: 0;

	.docs-renderer-steps__item {
		min-height: 0;
		padding: 22px;
		text-align: left;
		grid-template-columns: 36px minmax(0, 1fr);
		place-items: start stretch;
		gap: 16px;
	}

	.docs-renderer-steps__item + .docs-renderer-steps__item {
		border-top: 1px solid var(--docs-renderer-rule);
	}

	.is-right & .docs-renderer-steps__item {
		grid-template-columns: minmax(0, 1fr) 36px;
		text-align: right;
	}

	.is-right & .docs-renderer-steps__marker {
		grid-column: 2;
		grid-row: 1;
	}

	.is-right & .docs-renderer-steps__body {
		grid-column: 1;
		grid-row: 1;
	}

	.docs-renderer-steps__marker {
		width: 36px;
		height: 36px;
	}

	.docs-renderer-steps__index {
		width: 36px;
		height: 36px;
	}

	.docs-renderer-steps__body {
		max-width: none;
	}

	.docs-renderer-steps__rail {
		display: none;
	}
}

.docs-renderer-steps {
	@include landing.section;

	--docs-renderer-step-size: 42px;
	--docs-renderer-step-gap: 24px;

	&__list {
		display: grid;
		padding: 0;
		margin: 36px 0 0;
		overflow: hidden;
		list-style: none;
		background: color-mix(in srgb, var(--docs-renderer-accent) 2%, varfix(background-color));
		border-radius: 18px;
		grid-template-columns: repeat(var(--docs-renderer-columns, 3), minmax(0, 1fr));
		gap: var(--docs-renderer-step-gap);
	}

	&__item {
		--docs-renderer-card-accent: var(--docs-renderer-accent);

		position: relative;
		display: grid;
		min-width: 0;
		min-height: 190px;
		padding: 28px;
		gap: 16px;
		text-align: center;
		justify-items: center;
		align-content: start;
		box-sizing: border-box;
	}

	&__marker {
		display: flex;
		height: var(--docs-renderer-step-size);
		justify-content: center;
	}

	&__index {
		display: inline-flex;
		width: var(--docs-renderer-step-size);
		height: var(--docs-renderer-step-size);
		font-size: 13px;
		font-weight: 500;
		color: var(--docs-renderer-card-accent);
		background: varfix(background-color);
		border: 1px solid color-mix(in srgb, var(--docs-renderer-card-accent) 16%, varfix(background-color));
		border-radius: 13px;
		align-items: center;
		justify-content: center;
		box-sizing: border-box;
	}

	&__rail {
		position: absolute;
		top: calc(28px + var(--docs-renderer-step-size) / 2);
		left: calc(50% + var(--docs-renderer-step-size) / 2 + 12px);
		width: calc(100% + var(--docs-renderer-step-gap) - var(--docs-renderer-step-size) - 24px);
		height: 1px;
		pointer-events: none;
		background: var(--docs-renderer-rule);
	}

	&__item.is-row-end &__rail {
		display: none;
	}

	&__body {
		max-width: 29em;
		min-width: 0;
	}

	&__title {
		margin: 0 0 7px;
		font-size: 17px;
		font-weight: 600;
		line-height: 1.45;
		color: var(--docs-renderer-ink);
	}

	&__description {
		margin: 0;
		font-size: 13px;
		line-height: 1.95;
		color: var(--docs-renderer-muted);
		white-space: pre-line;
		text-wrap: pretty;
	}

	&.is-left &__item {
		justify-items: start;
		text-align: left;
	}

	&.is-left &__rail {
		left: calc(28px + var(--docs-renderer-step-size) + 12px);
	}

	&.is-right &__item {
		justify-items: end;
		text-align: right;
	}

	&.is-right &__rail {
		left: calc(100% - 16px);
	}

	&.has-motion &__index {
		animation: docs-renderer-step-pulse 6s ease-in-out infinite;
	}

	&__list.is-vertical {
		@include stack;
	}

	&.is-center &__list {
		max-width: 1120px;
		margin-inline: auto;
		gap: 32px 36px;
		overflow: visible;
		background: transparent;
	}

	&.is-center &__item {
		min-height: 0;
		padding: 0;
		gap: 18px;
	}

	&.is-center &__body {
		max-width: 280px;
	}

	&.is-center &__rail {
		top: calc(var(--docs-renderer-step-size) / 2);
		width: calc(100% + 36px - var(--docs-renderer-step-size) - 24px);
	}

	@container (width <= 900px) {
		&.is-center &__list {
			@include stack;

			max-width: 560px;
		}
	}

	@container (width <= 760px) {
		&__list {
			@include stack;

			margin-top: 27px;
		}

		&__title {
			margin-bottom: 5px;
			font-size: 16px;
		}

		&__description {
			font-size: 12px;
		}
	}
}

@keyframes docs-renderer-step-pulse {
	50% {
		box-shadow: 0 0 0 5px color-mix(in srgb, var(--docs-renderer-card-accent) 4%, transparent);
	}
}
</style>
