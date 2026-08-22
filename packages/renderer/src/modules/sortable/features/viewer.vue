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

.docs-renderer-features {
	--docs-renderer-accent: varfix(primary-color);

	@include docs-renderer-section-copy;

	// 段面跟站点主题，避免暗色下标题用浅色字却落在白色画板上。
	padding: 48px 0;
	background: varfix(background-color);
	border-radius: 0;
	box-sizing: border-box;

	@at-root .docs-renderer-node.is-full-width #{&} {
		max-width: none;
		padding-right: max(24px, calc((100% - var(--docs-renderer-content-width, 100%)) / 2));
		padding-left: max(24px, calc((100% - var(--docs-renderer-content-width, 100%)) / 2));
	}

	&__grid {
		display: grid;
		grid-template-columns: repeat(var(--docs-renderer-columns, 3), minmax(0, 1fr));
		gap: var(--docs-renderer-gap, 16px);
	}

	&__item {
		--docs-renderer-card-accent: var(--docs-renderer-accent);

		position: relative;
		display: grid;
		padding: 22px 22px 24px;
		overflow: hidden;
		background:
			linear-gradient(
				160deg,
				color-mix(in srgb, var(--docs-renderer-card-accent) 16%, varfix(background-color-soft)) 0%,
				varfix(background-color-soft) 62%
			);
		border: 1px solid color-mix(in srgb, var(--docs-renderer-card-accent) 20%, varfix(border-color));
		border-radius: 22px;
		align-content: start;
		animation: docs-renderer-rise 0.55s ease var(--docs-renderer-delay, 0ms) backwards;
		isolation: isolate;
		transition: transform 0.28s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.28s ease, border-color 0.2s ease;

		&::before {
			position: absolute;
			top: -36px;
			right: -28px;
			z-index: 0;
			width: 120px;
			height: 120px;
			pointer-events: none;
			background: radial-gradient(
				circle,
				color-mix(in srgb, var(--docs-renderer-card-accent) 22%, transparent) 0%,
				transparent 68%
			);
			content: '';
		}

		&:hover {
			border-color: color-mix(in srgb, var(--docs-renderer-card-accent) 46%, varfix(border-color));
			transform: translateY(-6px);
			box-shadow: 0 22px 40px color-mix(in srgb, var(--docs-renderer-card-accent) 16%, transparent);

			.docs-renderer-features__index {
				transform: translateY(-2px) scale(1.04);
			}
		}
	}

	&__meta,
	&__title,
	&__description {
		position: relative;
		z-index: 1;
	}

	&__meta {
		display: flex;
		gap: 12px;
		margin-bottom: 18px;
		align-items: flex-start;
		justify-content: space-between;
	}

	&__index {
		display: inline-flex;
		width: 46px;
		height: 46px;
		font-size: 18px;
		font-weight: 700;
		line-height: 1;
		color: #fff;
		background: var(--docs-renderer-card-accent);
		border-radius: 14px;
		box-shadow: 0 12px 22px color-mix(in srgb, var(--docs-renderer-card-accent) 30%, transparent);
		font-variant-numeric: tabular-nums;
		align-items: center;
		justify-content: center;
		transition: transform 0.22s ease;

		.vc-icon {
			font-size: 22px;
			color: inherit;
		}
	}

	&__media {
		display: block;
		width: 22px;
		height: 22px;
		object-fit: contain;
	}

	&__badge {
		display: inline-flex;
		padding: 4px 9px;
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.04em;
		color: var(--docs-renderer-card-accent);
		background: color-mix(in srgb, var(--docs-renderer-card-accent) 12%, varfix(background-color));
		border: 1px solid color-mix(in srgb, var(--docs-renderer-card-accent) 22%, transparent);
		border-radius: 999px;
		align-items: center;
	}

	&__title {
		margin: 0 0 8px;
		font-size: 18px;
		font-weight: 600;
		line-height: 1.35;
		letter-spacing: -0.03em;
		color: varfix(foreground-color);
	}

	&__description {
		margin: 0;
		font-size: 14px;
		line-height: 1.7;
		color: varfix(foreground-color-light);
	}

	@media (width <= 860px) {
		&__grid {
			grid-template-columns: minmax(0, 1fr);
		}
	}
}

@media (prefers-reduced-motion: reduce) {
	.docs-renderer-features__item {
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
	.docs-renderer-features__item {
		animation: none;
	}
}

@media screen and (width <= 768px) {
	.docs-renderer-features {
		padding: 24px 0;
		grid-template-columns: minmax(0, 1fr);
	}
}
</style>
