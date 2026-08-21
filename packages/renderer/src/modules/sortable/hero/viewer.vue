<template>
	<section
		class="docs-renderer-hero"
		:class="{
			'is-center': align === 'center',
			'is-plain': !showVisual
		}"
		:style="style"
	>
		<div class="docs-renderer-hero__content">
			<div class="docs-renderer-hero__heading">
				<h1 class="docs-renderer-hero__title">{{ node.module.props.title }}</h1>
				<span v-if="node.module.props.eyebrow" class="docs-renderer-hero__eyebrow">{{ node.module.props.eyebrow }}</span>
			</div>
			<p v-if="node.module.props.description" class="docs-renderer-hero__description">{{ node.module.props.description }}</p>
			<ActionsViewer :node="actionsNode" :context="context" />
			<ul v-if="highlights.length" class="docs-renderer-hero__stats">
				<li
					v-for="(item, index) in highlights"
					:key="index"
					class="docs-renderer-hero__stat"
					:style="statStyle(item)"
				>
					<strong>{{ item.value }}</strong>
					<span>{{ item.label }}</span>
				</li>
			</ul>
		</div>
		<div v-if="showVisual" class="docs-renderer-hero__visual" aria-hidden="true">
			<span class="docs-renderer-hero__glow" />
			<div class="docs-renderer-hero__window">
				<div class="docs-renderer-hero__chrome"><i /><i /><i /></div>
				<div class="docs-renderer-hero__body">
					<div class="docs-renderer-hero__rail"><span /><span /><span /></div>
					<div class="docs-renderer-hero__screen"><span /><span /><span /><span /></div>
				</div>
			</div>
		</div>
	</section>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import type { CSSProperties } from 'vue';
import type { RendererModuleViewerProps, RendererSortableNode } from '../../../types';
import ActionsViewer from '../../shared/actions/viewer.vue';
import { toLength, toRecord } from '../../shared/utils';

const props = defineProps<RendererModuleViewerProps>();
const align = computed(() => String(props.node.module.props.align || 'left'));
const showVisual = computed(() => props.node.module.props.showVisual !== false);
const highlights = computed(() => (
	Array.isArray(props.node.module.props.highlights) ? props.node.module.props.highlights : []
).map(toRecord).filter(item => String(item.value || '') || String(item.label || '')));
const statStyle = (item: Record<string, unknown>) => {
	const color = String(item.color || '').trim();
	return (color ? { '--docs-renderer-stat-color': color } : undefined) as CSSProperties | undefined;
};
const style = computed(() => {
	const value = props.node.module.props;
	const accent = String(value.accent || '');
	const accentSecondary = String(value.accentSecondary || '');
	const background = String(value.background || '');
	const minHeight = Math.max(0, toLength(value.minHeight, 420));
	return {
		...(accent ? { '--docs-renderer-accent': accent } : {}),
		...(accentSecondary ? { '--docs-renderer-accent-2': accentSecondary } : {}),
		...(background ? { '--docs-renderer-hero-background': background } : {}),
		...(minHeight > 0 ? { minHeight: `${minHeight}px` } : {})
	} as CSSProperties;
});
const actionsNode = computed<RendererSortableNode>(() => ({
	id: `${props.node.id}-actions`,
	module: { type: 'actions', version: 1, props: { items: props.node.module.props.actions || [] } },
	appearance: { marginTop: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 }
}));
</script>
<style lang="scss">
@use '../../../../node_modules/@deot/docs-theme/src/functions' as *;

@mixin docs-renderer-heading-row {
	display: flex;
	flex-wrap: wrap;
	gap: 10px 12px;
	margin-bottom: 12px;
	align-items: center;
}

@mixin docs-renderer-tag {
	display: inline-flex;
	padding: 4px 10px;
	font-size: 11px;
	font-weight: 600;
	line-height: 1.3;
	letter-spacing: 0.06em;
	color: var(--docs-renderer-accent, varfix(primary-color));
	white-space: nowrap;
	background: color-mix(in srgb, var(--docs-renderer-accent, varfix(primary-color)) 10%, transparent);
	border: 1px solid color-mix(in srgb, var(--docs-renderer-accent, varfix(primary-color)) 22%, transparent);
	border-radius: 999px;
	align-items: center;
	flex-shrink: 0;
}

.docs-renderer-hero {
	--docs-renderer-accent: varfix(primary-color);
	--docs-renderer-accent-2: varfix(link-color);

	position: relative;
	display: grid;
	grid-template-columns: minmax(0, 1.05fr) minmax(220px, 0.72fr);
	gap: 56px;
	min-height: 420px;
	padding: 72px clamp(24px, 5vw, 80px) 80px;
	overflow: hidden;
	color: varfix(foreground-color);
	background:
		radial-gradient(ellipse at 50% -10%, color-mix(in srgb, var(--docs-renderer-accent) 22%, transparent), transparent 58%),
		radial-gradient(circle at 92% 88%, color-mix(in srgb, var(--docs-renderer-accent-2) 10%, transparent), transparent 28%),
		var(--docs-renderer-hero-background, varfix(background-color));
	border: 0;
	border-bottom: 1px solid varfix(border-color-light);
	border-radius: 0;
	align-items: center;

	@at-root .docs-renderer-node.is-full-width #{&} {
		padding-right: max(24px, calc((100% - var(--docs-renderer-content-width, 100%)) / 2));
		padding-left: max(24px, calc((100% - var(--docs-renderer-content-width, 100%)) / 2));
		border-inline: 0;
		border-top: 0;
		border-radius: 0;
	}

	@at-root .docs-renderer-node:not(.is-full-width) #{&} {
		border: 1px solid varfix(border-color-light);
		border-radius: 24px;
	}

	&.is-plain,
	&.is-center {
		grid-template-columns: minmax(0, 1fr);
	}

	&.is-center {
		text-align: center;
	}

	&.is-center &__heading,
	&.is-center &__stats,
	&.is-center .docs-renderer-actions {
		justify-content: center;
	}

	&.is-center &__description {
		margin-inline: auto;
	}

	&__content,
	&__visual {
		position: relative;
		min-width: 0;
	}

	&__content {
		animation: docs-renderer-rise 0.7s ease both;
	}

	&__heading {
		@include docs-renderer-heading-row;

		margin-bottom: 0;
		align-items: center;
	}

	&__eyebrow {
		@include docs-renderer-tag;

		padding: 4px 10px;
		font-size: 12px;
	}

	&__title {
		margin: 0;
		font-size: clamp(40px, 5.6vw, 64px);
		font-weight: 700;
		line-height: 1.08;
		letter-spacing: -0.048em;
		color: varfix(foreground-color);
		text-wrap: balance;
	}

	&__description {
		max-width: 38rem;
		margin: 18px 0 28px;
		font-size: 18px;
		line-height: 1.7;
		color: varfix(foreground-color-light);
	}

	&__stats {
		display: flex;
		padding: 24px 0 0;
		margin: 36px 0 0;
		list-style: none;
		border-top: 1px solid varfix(border-color-light);
		flex-wrap: wrap;
	}

	&__stat {
		display: grid;
		gap: 6px;
		min-width: 96px;
		padding-right: 32px;
		margin-right: 32px;
		border-right: 1px solid varfix(border-color-light);
		transition: transform 0.22s ease;

		&:last-child {
			padding-right: 0;
			margin-right: 0;
			border-right: 0;
		}

		&:hover {
			transform: translateY(-2px);
		}

		strong {
			font-size: 28px;
			font-weight: 700;
			line-height: 1.1;
			letter-spacing: -0.045em;
			color: var(--docs-renderer-stat-color, var(--docs-renderer-accent));
		}

		span {
			font-size: 13px;
			line-height: 1.4;
			color: varfix(foreground-color-mute);
		}
	}

	&__visual {
		display: grid;
		min-height: 280px;
		place-items: center;
		animation: docs-renderer-rise 0.8s ease 0.12s both;
	}

	&__glow {
		width: 320px;
		height: 320px;
		pointer-events: none;
		background: radial-gradient(circle, color-mix(in srgb, var(--docs-renderer-accent) 36%, transparent), transparent 68%);
		border-radius: 50%;
		filter: blur(8px);
		grid-area: 1 / 1;
		animation: docs-renderer-pulse 6s ease-in-out infinite;
	}

	&__window {
		position: relative;
		z-index: 1;
		width: min(100%, 360px);
		overflow: hidden;
		background: varfix(background-color);
		border: 1px solid color-mix(in srgb, var(--docs-renderer-accent) 18%, varfix(border-color-light));
		border-radius: 16px;
		box-shadow:
			0 0 0 1px color-mix(in srgb, #fff 55%, transparent) inset,
			0 28px 56px color-mix(in srgb, var(--docs-renderer-accent) 16%, transparent);
		grid-area: 1 / 1;
		animation: docs-renderer-float-front 6s ease-in-out infinite;
	}

	&__chrome {
		display: flex;
		gap: 6px;
		padding: 11px 14px;
		background: varfix(background-color-soft);
		border-bottom: 1px solid varfix(border-color-light);

		i {
			width: 8px;
			height: 8px;
			background: varfix(border-color);
			border-radius: 50%;

			&:first-child {
				background: #ff5f57;
			}

			&:nth-child(2) {
				background: #febc2e;
			}

			&:nth-child(3) {
				background: #28c840;
			}
		}
	}

	&__body {
		display: grid;
		grid-template-columns: 72px minmax(0, 1fr);
		min-height: 188px;
	}

	&__rail {
		display: grid;
		padding: 14px 12px;
		gap: 8px;
		background: color-mix(in srgb, var(--docs-renderer-accent) 6%, varfix(background-color-soft));
		border-right: 1px solid varfix(border-color-light);
		align-content: start;

		span {
			display: block;
			height: 8px;
			background: color-mix(in srgb, var(--docs-renderer-accent) 18%, varfix(background-color-mute));
			border-radius: 999px;

			&:first-child {
				width: 70%;
				height: 10px;
				background: var(--docs-renderer-accent);
			}

			&:nth-child(2) {
				width: 88%;
			}

			&:nth-child(3) {
				width: 54%;
			}
		}
	}

	&__screen {
		display: grid;
		padding: 18px 16px 20px;
		gap: 10px;
		align-content: start;

		span {
			display: block;
			height: 8px;
			background: varfix(background-color-mute);
			border-radius: 999px;
			animation: docs-renderer-shimmer 2.6s ease-in-out infinite;

			&:first-child {
				width: 42%;
				height: 11px;
				background: var(--docs-renderer-accent);
			}

			&:nth-child(2) {
				width: 92%;
				animation-delay: 0.12s;
			}

			&:nth-child(3) {
				width: 74%;
				animation-delay: 0.24s;
			}

			&:nth-child(4) {
				width: 58%;
				animation-delay: 0.36s;
			}
		}
	}

	.docs-renderer-actions {
		justify-content: flex-start;
	}

	@media (width <= 860px) {
		grid-template-columns: minmax(0, 1fr);
		min-height: 0;
		padding: 48px 24px 56px;
		text-align: center;

		&__heading,
		&__stats,
		.docs-renderer-actions {
			justify-content: center;
		}

		&__description,
		&__stats {
			margin-inline: auto;
		}

		&__visual {
			min-height: 200px;
		}

		&__window {
			width: min(100%, 320px);
		}

		&__stat {
			min-width: 72px;
			padding-right: 20px;
			margin-right: 20px;
		}
	}
}

@media (prefers-reduced-motion: reduce) {
	.docs-renderer-hero__content,
	.docs-renderer-hero__visual,
	.docs-renderer-hero__glow,
	.docs-renderer-hero__window,
	.docs-renderer-hero__screen span {
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

@keyframes docs-renderer-float-front {
	0%,
	100% {
		transform: translateY(0);
	}

	50% {
		transform: translateY(-10px);
	}
}

@keyframes docs-renderer-pulse {
	0%,
	100% {
		opacity: 0.55;
		transform: scale(1);
	}

	50% {
		opacity: 1;
		transform: scale(1.08);
	}
}

@keyframes docs-renderer-shimmer {
	0%,
	100% {
		opacity: 0.55;
	}

	50% {
		opacity: 1;
	}
}

.docs-renderer-node.is-editing {
	.docs-renderer-hero__content,
	.docs-renderer-hero__visual,
	.docs-renderer-hero__glow,
	.docs-renderer-hero__window,
	.docs-renderer-hero__screen span {
		animation: none;
	}
}

@media screen and (width <= 768px) {
	.docs-renderer-hero {
		grid-template-columns: minmax(0, 1fr);
		gap: 40px;
		padding: 56px 24px 64px;
	}
}
</style>
