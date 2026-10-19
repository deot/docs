<template>
	<section
		ref="root"
		class="docs-renderer-faq"
		:class="{ 'is-center': align === 'center', 'is-left': align === 'left', 'is-right': align === 'right' }"
		:style="rootStyle"
	>
		<header v-if="hasHeader" class="docs-renderer-faq__header" data-landing-reveal>
			<div v-if="title || eyebrow" class="docs-renderer-faq__heading-row">
				<span v-if="eyebrow" class="docs-renderer-faq__eyebrow">{{ eyebrow }}</span>
				<h2 v-if="title" class="docs-renderer-faq__heading">{{ title }}</h2>
			</div>
			<p v-if="description" class="docs-renderer-faq__lead">{{ description }}</p>
		</header>
		<div class="docs-renderer-faq__list" data-landing-reveal>
			<details
				v-for="(item, index) in items"
				:key="index"
				class="docs-renderer-faq__item"
				:open="isColumnLayout || index === 0"
			>
				<summary class="docs-renderer-faq__question">
					<span class="docs-renderer-faq__index" aria-hidden="true">{{ String(index + 1).padStart(2, '0') }}</span>
					{{ item.question }}
				</summary>
				<p class="docs-renderer-faq__answer">{{ item.answer }}</p>
			</details>
		</div>
	</section>
</template>
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import type { RendererModuleViewerProps } from '../../../types';
import { rendererSortableSectionStyle } from '../../../frame/shared/sortable-width';
import { toRecord } from '../../shared/utils';
import { useLandingMotion } from '../../shared/landing-motion';

const props = defineProps<RendererModuleViewerProps>();
const root = useLandingMotion(() => props.context);
const isWide = ref(false);
let resizeObserver: ResizeObserver | undefined;
onMounted(() => {
	if (!root.value || typeof ResizeObserver === 'undefined') return;
	resizeObserver = new ResizeObserver(([entry]) => {
		isWide.value = (entry.borderBoxSize?.[0]?.inlineSize ?? entry.contentRect.width) > 1100;
	});
	resizeObserver.observe(root.value);
});
onBeforeUnmount(() => resizeObserver?.disconnect());
const value = computed(() => props.node.module.props);
const eyebrow = computed(() => String(value.value.eyebrow || ''));
const title = computed(() => String(value.value.title || ''));
const description = computed(() => String(value.value.description || ''));
const align = computed(() => String(value.value.align || 'center'));
const isColumnLayout = computed(() => isWide.value && align.value !== 'center');
const hasHeader = computed(() => Boolean(eyebrow.value || title.value || description.value));
const items = computed(() => (Array.isArray(value.value.items) ? value.value.items : []).map(toRecord));
const rootStyle = computed(() => rendererSortableSectionStyle(String(value.value.accent || '')));
</script>
<style lang="scss">
@use '../../shared/landing' as landing;

.docs-renderer-faq {
	@include landing.section;

	&__list {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
	}

	&__item {
		min-width: 0;
		min-height: 208px;
		padding: 22px 28px;
		background: transparent;
		border: 0;
		box-sizing: border-box;
	}

	&__item + &__item {
		border-left: 1px solid var(--docs-renderer-rule);
	}

	&__item:nth-child(3n + 1) {
		border-left: 0;
	}

	&__item:nth-child(n + 4) {
		border-top: 1px solid var(--docs-renderer-rule);
	}

	&.is-center &__item {
		min-height: 0;
		padding: 0 20px;
		text-align: left;
		border: 0;
	}

	&.is-center &__list {
		display: block;
		max-width: 820px;
		margin-inline: auto;
	}

	&.is-center &__item + &__item {
		border-top: 1px solid var(--docs-renderer-rule);
	}

	&.is-center &__index {
		display: none;
	}

	&.is-center &__question {
		padding: 22px 28px 22px 0;
	}

	&.is-center &__question::before, &.is-center &__question::after {
		top: 50%;
		bottom: auto;
	}

	&.is-center &__answer {
		max-width: none;
		padding: 0 28px 20px 0;
	}

	&.is-right &__item {
		text-align: right;
	}

	&.is-right &__answer {
		margin-left: auto;
	}

	&.is-right &__question {
		padding-right: 0;
		padding-left: 24px;
	}

	&.is-right &__question::before, &.is-right &__question::after {
		right: auto;
		left: 0;
	}

	&__index {
		display: block;
		margin-bottom: 18px;
		font-family: Menlo, monospace;
		font-size: 11px;
		color: var(--docs-renderer-muted);
		opacity: 0.6;
	}

	&__question {
		position: relative;
		display: block;
		padding: 0 24px 0 0;
		font-size: 14px;
		font-weight: 500;
		line-height: 1.7;
		color: var(--docs-renderer-ink);
		list-style: none;
		cursor: pointer;
		box-sizing: border-box;
	}

	&__question::-webkit-details-marker {
		display: none;
	}

	&__question::before, &__question::after {
		position: absolute;
		right: 0;
		bottom: 12px;
		width: 11px;
		height: 1px;
		background: var(--docs-renderer-muted);
		content: '';
	}

	&__question::after {
		transform: rotate(90deg);
	}

	&__item[open] &__question::after {
		display: none;
	}

	&__question:focus-visible {
		border-radius: 4px;
		outline: 2px solid var(--docs-renderer-accent);
		outline-offset: 3px;
	}

	&__answer {
		max-width: 32em;
		padding: 16px 0 0;
		margin: 0;
		font-size: 13px;
		line-height: 1.95;
		color: var(--docs-renderer-muted);
		white-space: pre-line;
		text-wrap: pretty;
	}

	@container (width <= 1100px) {
		&__list {
			grid-template-columns: minmax(0, 1fr);
		}

		&__item {
			min-height: 0;
			padding: 20px 4px;
		}

		&__item + &__item {
			border-top: 1px solid var(--docs-renderer-rule);
			border-left: 0;
		}

		&__index {
			display: none;
		}

		&__answer {
			max-width: none;
		}
	}

	@container (width <= 760px) {
		&.is-center &__item {
			padding: 0;
		}

		&__question {
			font-size: 13px;
		}

		&__answer {
			font-size: 12px;
		}
	}
}
</style>
