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
