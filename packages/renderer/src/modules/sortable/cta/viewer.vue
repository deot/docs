<template>
	<section
		class="docs-renderer-cta"
		:class="{
			'is-center': align === 'center'
		}"
		:style="style"
	>
		<div class="docs-renderer-cta__content">
			<div class="docs-renderer-cta__heading">
				<h2 class="docs-renderer-cta__title">{{ node.module.props.title }}</h2>
				<span v-if="node.module.props.eyebrow" class="docs-renderer-cta__eyebrow">{{ node.module.props.eyebrow }}</span>
			</div>
			<p v-if="node.module.props.description" class="docs-renderer-cta__description">{{ node.module.props.description }}</p>
			<ActionsViewer :node="actionsNode" :context="context" />
		</div>
	</section>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import type { CSSProperties } from 'vue';
import type { RendererModuleViewerProps, RendererSortableNode } from '../../../types';
import ActionsViewer from '../../shared/actions/viewer.vue';

const props = defineProps<RendererModuleViewerProps>();
const align = computed(() => String(props.node.module.props.align || 'center'));
const style = computed(() => {
	const value = props.node.module.props;
	const accent = String(value.accent || '');
	const accentSecondary = String(value.accentSecondary || '');
	const background = String(value.background || '');
	return {
		...(accent ? { '--docs-renderer-accent': accent } : {}),
		...(accentSecondary ? { '--docs-renderer-accent-2': accentSecondary } : {}),
		...(background ? { '--docs-renderer-cta-background': background } : {})
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

.docs-renderer-cta {
	--docs-renderer-accent: varfix(primary-color);
	--docs-renderer-accent-2: varfix(link-color);

	position: relative;
	padding: 72px clamp(24px, 5vw, 80px);
	overflow: hidden;
	text-align: left;
	background:
		radial-gradient(ellipse at 50% -20%, color-mix(in srgb, var(--docs-renderer-accent) 22%, transparent), transparent 52%),
		color-mix(
			in srgb,
			var(--docs-renderer-accent) 5%,
			var(--docs-renderer-cta-background, varfix(background-color-soft))
		);
	border: 0;
	border-top: 1px solid varfix(border-color-light);
	border-radius: 0;

	&::before {
		position: absolute;
		top: -30%;
		right: 8%;
		width: 280px;
		height: 280px;
		pointer-events: none;
		background: radial-gradient(circle, color-mix(in srgb, var(--docs-renderer-accent) 24%, transparent), transparent 70%);
		content: '';
		animation: docs-renderer-pulse 6s ease-in-out infinite;
	}

	@at-root .docs-renderer-node.is-full-width #{&} {
		padding-right: max(24px, calc((100% - var(--docs-renderer-content-width, 100%)) / 2));
		padding-left: max(24px, calc((100% - var(--docs-renderer-content-width, 100%)) / 2));
		border-inline: 0;
		border-radius: 0;
	}

	@at-root .docs-renderer-node:not(.is-full-width) #{&} {
		border: 1px solid varfix(border-color-light);
		border-radius: 24px;
	}

	&.is-center {
		text-align: center;
	}

	&.is-center &__heading,
	&.is-center .docs-renderer-actions {
		justify-content: center;
	}

	&__content {
		position: relative;
		max-width: 40rem;
	}

	&.is-center &__content {
		margin-inline: auto;
	}

	&__heading {
		@include docs-renderer-heading-row;

		margin-bottom: 12px;
	}

	&__eyebrow {
		@include docs-renderer-tag;
	}

	&__title {
		margin: 0;
		font-size: clamp(32px, 4vw, 44px);
		font-weight: 700;
		line-height: 1.15;
		letter-spacing: -0.04em;
		color: varfix(foreground-color);
		text-wrap: balance;
	}

	&__description {
		margin: 0 0 28px;
		font-size: 16px;
		line-height: 1.7;
		color: varfix(foreground-color-light);
	}
}

@media (prefers-reduced-motion: reduce) {
	.docs-renderer-cta::before {
		animation: none !important;
		transition: none !important;
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

.docs-renderer-node.is-editing {
	.docs-renderer-cta::before {
		animation: none;
	}
}
</style>
