<template>
	<section
		ref="root"
		class="docs-renderer-features"
		:class="{ 'is-center': align === 'center', 'is-left': align === 'left', 'is-right': align === 'right' }"
		:style="rootStyle"
	>
		<header v-if="hasHeader" class="docs-renderer-features__header" data-landing-reveal>
			<div v-if="title || eyebrow" class="docs-renderer-features__heading-row">
				<span v-if="eyebrow" class="docs-renderer-features__eyebrow">{{ eyebrow }}</span>
				<h2 v-if="title" class="docs-renderer-features__heading">{{ title }}</h2>
			</div>
			<p v-if="description" class="docs-renderer-features__lead">{{ description }}</p>
		</header>
		<div class="docs-renderer-features__grid" :style="gridStyle" data-landing-reveal>
			<article
				v-for="(item, index) in items"
				:key="index"
				class="docs-renderer-features__item"
				:style="cardStyle(item)"
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
				<div v-if="item.image" class="docs-renderer-features__illustration">
					<ImageViewer :node="imageNode(item, index)" :context="context" />
				</div>
				<FeatureDiagram v-else-if="align !== 'center'" :index="index" />
			</article>
		</div>
	</section>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import type { CSSProperties } from 'vue';
import { Icon } from '@deot/vc';
import type { RendererModuleViewerProps, RendererSortableNode } from '../../../types';
import { rendererSortableSectionStyle } from '../../../frame/shared/sortable-width';
import { toLength, toRecord } from '../../shared/utils';
import { toDisplayImageSrc } from '../../shared/image-source';
import { featureIconKind } from './icon';
import FeatureDiagram from './diagram.vue';
import { useLandingMotion } from '../../shared/landing-motion';
import ImageViewer from '../../shared/image/viewer.vue';

const props = defineProps<RendererModuleViewerProps>();
const root = useLandingMotion(() => props.context);
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
const cardStyle = (item: Record<string, unknown>) => {
	const accent = String(item.accent || '').trim();
	return {
		'--docs-renderer-card-accent': accent || undefined
	} as CSSProperties;
};
const iconValue = (item: Record<string, unknown>) => toDisplayImageSrc(item.icon);
const iconKind = (item: Record<string, unknown>) => featureIconKind(item.icon);
const fallbackGlyph = (item: Record<string, unknown>) => {
	const heading = String(item.title || '').trim();
	return heading ? Array.from(heading)[0] : '✦';
};
const imageNode = (item: Record<string, unknown>, index: number): RendererSortableNode => ({
	id: `${props.node.id}-image-${index}`,
	module: { type: 'image', version: 1, props: { src: item.image, alt: '', fit: 'contain' } },
	appearance: { marginTop: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 }
});
</script>
<style lang="scss">
@use '../../../../node_modules/@deot/docs-theme/src/functions' as *;
@use '../../shared/landing' as landing;

.docs-renderer-features {
	@include landing.section;

	@at-root .docs-renderer-node--hero + .docs-renderer-node--features #{&} {
		border-top: 0;
	}

	&__grid {
		display: grid;
		grid-template-columns: repeat(var(--docs-renderer-columns, 3), minmax(0, 1fr));
	}

	&__item {
		--docs-renderer-card-accent: var(--docs-renderer-accent);

		display: flex;
		min-width: 0;
		min-height: 296px;
		padding: 28px;
		overflow: hidden;
		background: color-mix(in srgb, var(--docs-renderer-card-accent) 3%, varfix(background-color-lightest));
		border: 0;
		border-radius: 18px;
		box-sizing: border-box;
		flex-direction: column;
		transition: translate 250ms ease, box-shadow 250ms ease;
	}

	&.has-motion &__item:hover {
		box-shadow: 0 8px 24px color-mix(in srgb, var(--docs-renderer-card-accent) 7%, transparent);
		translate: 0 -3px;
	}

	&__meta {
		display: flex;
		gap: 12px;
		margin-bottom: 18px;
		align-items: center;
		justify-content: space-between;
	}

	&__index {
		display: inline-flex;
		width: 38px;
		height: 38px;
		font-size: 16px;
		line-height: 1;
		color: var(--docs-renderer-card-accent);
		background: color-mix(in srgb, var(--docs-renderer-card-accent) 6%, varfix(background-color-lightest));
		border-radius: 11px;
		align-items: center;
		justify-content: center;
	}

	&__glyph {
		font-size: 19px;
	}

	&__media {
		display: block;
		width: 21px;
		height: 21px;
		object-fit: contain;
	}

	&__badge {
		font-size: 10px;
		line-height: 1.5;
		color: var(--docs-renderer-muted);
	}

	&__title {
		margin: 0 0 9px;
		font-size: 17px;
		font-weight: 600;
		line-height: 1.45;
		color: var(--docs-renderer-ink);
	}

	&__description {
		max-width: 29em;
		margin: 0;
		font-size: 13px;
		line-height: 1.85;
		color: var(--docs-renderer-muted);
		white-space: pre-line;
		text-wrap: pretty;
	}

	&.is-center &__item {
		min-height: 0;
		padding: 27px 27px 29px;
		text-align: left;
	}

	&.is-center &__grid {
		grid-template-columns: repeat(var(--docs-renderer-columns, 3), minmax(0, 384px));
		justify-content: center;
	}

	&.is-right &__item {
		text-align: right;
	}

	&.is-right &__meta {
		flex-direction: row-reverse;
	}

	&.is-right &__description {
		margin-left: auto;
	}

	&__diagram, &__illustration {
		width: 100%;
		height: 124px;
		padding-top: 20px;
		margin-top: auto;
		color: var(--docs-renderer-card-accent);
		pointer-events: none;
		box-sizing: border-box;
	}

	&__diagram {

		svg {
			display: block;
			width: 100%;
			height: 100%;
		}

		.is-paper {
			fill: varfix(background-color-lightest);
			fill-opacity: 0.68;
			stroke: currentcolor;
			stroke-opacity: 0.16;
		}

		.is-line {
			fill: none;
			stroke: currentcolor;
			stroke-opacity: 0.2;
		}

		.is-ink {
			fill: currentcolor;
			fill-opacity: 0.12;
		}

		.is-pale {
			fill: currentcolor;
			fill-opacity: 0.035;
		}

		.is-path {
			fill: none;
			stroke: currentcolor;
			stroke-opacity: 0.3;
			stroke-width: 1.2;
			stroke-dasharray: 3 5;
		}

		.is-signal {
			fill: currentcolor;
			fill-opacity: 0.38;
		}
	}

	&.has-motion &__diagram .is-path {
		animation: docs-renderer-diagram-flow 6s linear infinite;
	}

	&.has-motion &__diagram .is-signal {
		animation: docs-renderer-transfer 6s ease-in-out infinite;
	}

	@container (width <= 1100px) {
		&:not(.is-center) &__grid {
			grid-template-columns: minmax(0, 1fr);
		}

		&__item {
			min-height: 0;
		}
	}

	@container (width <= 1000px) {
		&.is-center &__grid {
			grid-template-columns: repeat(var(--docs-renderer-columns, 3), minmax(0, 1fr));
		}
	}

	@container (width <= 900px) {
		&.is-center &__grid {
			max-width: 560px;
			margin-inline: auto;
			grid-template-columns: minmax(0, 1fr);
		}
	}

	@container (width <= 760px) {
		&__item {
			padding: 24px;
		}

		&__diagram, &__illustration {
			height: 86px;
		}
	}
}

@keyframes docs-renderer-diagram-flow {
	to {
		stroke-dashoffset: -96;
	}
}

@keyframes docs-renderer-transfer {
	0%, 100% {
		opacity: 0;
		transform: translateX(0);
	}

	15% {
		opacity: 1;
	}

	75% {
		opacity: 1;
		transform: translateX(110px);
	}

	90% {
		opacity: 0;
		transform: translateX(110px);
	}
}
</style>
