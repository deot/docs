<template>
	<section
		class="docs-renderer-features"
		:class="{ 'is-center': align === 'center', 'is-left': align === 'left' }"
		:style="rootStyle"
	>
		<header v-if="hasHeader" class="docs-renderer-features__header">
			<div v-if="title || eyebrow" class="docs-renderer-features__heading-row">
				<h2 v-if="title" class="docs-renderer-features__heading">{{ title }}</h2>
				<span v-if="eyebrow" class="docs-renderer-features__eyebrow">{{ eyebrow }}</span>
			</div>
			<p v-if="description" class="docs-renderer-features__lead">{{ description }}</p>
		</header>
		<div class="docs-renderer-features__grid" :style="gridStyle">
			<article
				v-for="(item, index) in items"
				:key="index"
				class="docs-renderer-features__item"
				:style="cardStyle(item, index)"
			>
				<div class="docs-renderer-features__meta">
					<span class="docs-renderer-features__index">
						<img
							v-if="iconKind(item) === 'url'"
							class="docs-renderer-features__media"
							:src="iconValue(item)"
							alt=""
						>
						<Icon
							v-else-if="iconKind(item) === 'type'"
							class="docs-renderer-features__glyph"
							:type="iconValue(item)"
						/>
						<template v-else>{{ fallbackGlyph(item) }}</template>
					</span>
					<span v-if="item.badge" class="docs-renderer-features__badge">{{ item.badge }}</span>
				</div>
				<h3 class="docs-renderer-features__title">{{ item.title }}</h3>
				<p class="docs-renderer-features__description">{{ item.description }}</p>
			</article>
		</div>
	</section>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import type { CSSProperties } from 'vue';
import { Icon } from '@deot/vc';
import type { RendererModuleViewerProps } from '../../../types';
import { rendererSortableSectionStyle } from '../../../frame/shared/sortable-width';
import { toLength, toRecord } from '../../shared/utils';
import { toDisplayImageSrc } from '../../shared/image-source';
import { featureIconKind } from './icon';
import { featureAccentOf } from './palette';

const props = defineProps<RendererModuleViewerProps>();
const value = computed(() => props.node.module.props);
const eyebrow = computed(() => String(value.value.eyebrow || ''));
const title = computed(() => String(value.value.title || ''));
const description = computed(() => String(value.value.description || ''));
const align = computed(() => String(value.value.align || 'center'));
const hasHeader = computed(() => Boolean(eyebrow.value || title.value || description.value));
const items = computed(() => (Array.isArray(value.value.items) ? value.value.items : []).map(toRecord));
const rootStyle = computed(() => rendererSortableSectionStyle(String(value.value.accent || '')));
const gridStyle = computed(() => ({
	'--docs-renderer-columns': Math.max(1, toLength(value.value.columns, 3)),
	'gap': `${Math.max(0, toLength(value.value.gap, 20))}px`
}) as CSSProperties);
const cardStyle = (item: Record<string, unknown>, index: number) => {
	const accent = String(item.accent || featureAccentOf(index));
	return {
		'--docs-renderer-card-accent': accent,
		'--docs-renderer-delay': `${index * 70}ms`
	} as CSSProperties;
};
const iconValue = (item: Record<string, unknown>) => toDisplayImageSrc(item.icon);
const iconKind = (item: Record<string, unknown>) => featureIconKind(item.icon);
const fallbackGlyph = (item: Record<string, unknown>) => {
	const heading = String(item.title || '').trim();
	return heading ? Array.from(heading)[0] : '✦';
};
</script>
