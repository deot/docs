<template>
	<section
		ref="root"
		class="docs-renderer-cta"
		:class="{
			'is-center': align === 'center',
			'is-right': align === 'right'
		}"
		:style="style"
	>
		<div class="docs-renderer-cta__content">
			<div class="docs-renderer-cta__heading">
				<span v-if="node.module.props.eyebrow" class="docs-renderer-cta__eyebrow">{{ node.module.props.eyebrow }}</span>
				<h2 class="docs-renderer-cta__title">{{ node.module.props.title }}</h2>
			</div>
			<p v-if="node.module.props.description" class="docs-renderer-cta__description" data-landing-reveal>{{ node.module.props.description }}</p>
			<ActionsViewer :node="actionsNode" :context="context" />
		</div>
	</section>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import type { CSSProperties } from 'vue';
import type { RendererModuleViewerProps, RendererSortableNode } from '../../../types';
import ActionsViewer from '../../shared/actions/viewer.vue';
import { useLandingMotion } from '../../shared/landing-motion';

const props = defineProps<RendererModuleViewerProps>();
const root = useLandingMotion(() => props.context);
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
	appearance: {
		marginTop: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0
	}
}));
</script>
<style lang="scss">
@use '../../../../node_modules/@deot/docs-theme/src/functions' as *;
@use '../../shared/landing' as landing;

.docs-renderer-cta {
	@include landing.colors;
	@include landing.motion;
	@include landing.full-width-rule;
	@include landing.full-width-background(
		color-mix(in srgb, var(--docs-renderer-accent) 2%, var(--docs-renderer-cta-background, varfix(background-color)))
	);
	@include landing.side-label(64px);

	--docs-renderer-accent-2: #{varfix(link-color)};

	padding: 64px 48px 68px;
	text-align: left;
	border-top: 1px solid var(--docs-renderer-rule);
	box-sizing: border-box;

	@at-root .docs-renderer-node.is-full-width #{&} {
		padding-inline: max(48px, calc((100% - var(--docs-renderer-content-width, 100%)) / 2 + 48px));
	}

	&.is-center {
		text-align: center;
	}

	&.is-center &__content {
		margin-inline: auto;
	}

	&.is-center .docs-renderer-actions {
		justify-content: center;
	}

	&.is-right {
		text-align: right;
	}

	&.is-right &__content {
		margin-left: auto;
	}

	&.is-right .docs-renderer-actions {
		justify-content: flex-end;
	}

	&__content {
		max-width: 640px;
	}

	&__eyebrow {
		@include landing.eyebrow;

		margin-bottom: 16px;
	}

	&__title {
		margin: 0 0 14px;
		font-size: 29px;
		font-weight: 550;
		line-height: 1.45;
		color: var(--docs-renderer-ink);
		text-wrap: balance;
	}

	&__description {
		margin: 0 0 25px;
		font-size: 14px;
		line-height: 1.85;
		color: var(--docs-renderer-muted);
	}

	@container (width <= 760px) {
		&, .docs-renderer-node.is-full-width & {
			padding: 43px 25px 49px;
		}

		&__title {
			font-size: 24px;
			line-height: 1.5;
		}

		&__description {
			font-size: 13px;
			line-height: 1.9;
		}
	}
}
</style>
