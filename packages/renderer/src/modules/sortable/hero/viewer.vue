<template>
	<section
		ref="root"
		class="docs-renderer-hero"
		:class="{
			'is-center': align === 'center',
			'is-right': align === 'right',
			'is-plain': !showVisual
		}"
		:style="style"
	>
		<div class="docs-renderer-hero__content">
			<div class="docs-renderer-hero__heading">
				<span v-if="node.module.props.eyebrow" class="docs-renderer-hero__eyebrow">{{ node.module.props.eyebrow }}</span>
				<h1 class="docs-renderer-hero__title">{{ node.module.props.title }}</h1>
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
		<div v-if="showVisual" class="docs-renderer-hero__visual">
			<HeroPanel :visual="visual" />
		</div>
	</section>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import type { CSSProperties } from 'vue';
import type { RendererModuleViewerProps, RendererSortableNode } from '../../../types';
import ActionsViewer from '../../shared/actions/viewer.vue';
import { toLength, toRecord } from '../../shared/utils';
import { useLandingMotion } from '../../shared/landing-motion';
import HeroPanel from './panel.vue';
import { normalizeHeroVisual } from './visual';

const props = defineProps<RendererModuleViewerProps>();
const root = useLandingMotion(() => props.context);
const visual = computed(() => normalizeHeroVisual(props.node.module.props.visual));
const align = computed(() => String(props.node.module.props.align || 'left'));
const showVisual = computed(() => props.node.module.props.showVisual !== false);
const highlights = computed(() => (
	Array.isArray(props.node.module.props.highlights) ? props.node.module.props.highlights : []
).map(toRecord).filter(item => String(item.value || '') || String(item.label || '')));
const statStyle = (item: Record<string, unknown>) => ({
	'--docs-renderer-stat-color': String(item.color || '').trim() || undefined
}) as CSSProperties;
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
		...(minHeight > 0 ? { '--docs-renderer-hero-min-height': `${minHeight}px` } : {})
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

.docs-renderer-hero {
	@include landing.colors;
	@include landing.motion;
	@include landing.full-width-rule;
	@include landing.full-width-background(
		color-mix(in srgb, var(--docs-renderer-accent) 1.5%, var(--docs-renderer-hero-background, varfix(background-color)))
	);

	--docs-renderer-accent-2: #{varfix(color-secondary)};
	--docs-renderer-stat-color: color-mix(in srgb, var(--docs-renderer-accent) 25%, var(--docs-renderer-muted));
	--docs-renderer-paper: light-dark(#{varfix(background-color)}, #{varfix(background-color-deep)});
	--docs-renderer-paper-rule: light-dark(
		color-mix(in srgb, var(--docs-renderer-accent) 10%, #{varfix(background-color)}),
		var(--docs-renderer-rule)
	);

	position: relative;
	display: grid;
	grid-template-columns: minmax(0, 0.82fr) minmax(0, 1.18fr);
	gap: 56px;
	min-height: var(--docs-renderer-hero-min-height, 420px);
	padding: 75px 48px 72px;
	overflow: hidden;
	color: var(--docs-renderer-ink);
	border-bottom: 1px solid var(--docs-renderer-rule);
	box-sizing: border-box;
	align-items: center;

	@at-root .docs-renderer-node.is-full-width #{&} {
		padding-inline: max(48px, calc((100% - min(1280px, var(--docs-renderer-content-width, 100%))) / 2));
	}

	&.is-plain, &.is-center, &.is-right {
		grid-template-columns: minmax(0, 1fr);
	}

	&.is-center {
		text-align: center;
	}

	&.is-center &__stats, &.is-center .docs-renderer-actions {
		justify-content: center;
	}

	&.is-center &__stats, &.is-center &__description {
		margin-inline: auto;
	}

	&.is-center &__visual {
		justify-self: center;
	}

	&.is-right {
		text-align: right;
	}

	&.is-right &__description, &.is-right &__stats {
		margin-left: auto;
	}

	&.is-right .docs-renderer-actions {
		justify-content: flex-end;
	}

	&__content, &__visual {
		min-width: 0;
	}

	&__eyebrow {
		@include landing.eyebrow;

		margin-bottom: 19px;
	}

	&__title {
		margin: 0;
		font-size: 44px;
		font-weight: 550;
		line-height: 1.25;
		color: var(--docs-renderer-ink);
		text-wrap: balance;
		overflow-wrap: anywhere;
	}

	&__description {
		max-width: 390px;
		margin: 20px 0 26px;
		font-size: 15px;
		line-height: 1.9;
		color: var(--docs-renderer-muted);
		text-wrap: balance;
	}

	&__stats {
		display: flex;
		width: fit-content;
		padding: 25px 0 0;
		margin: 29px 0 0;
		list-style: none;
		border-top: 1px solid var(--docs-renderer-rule);
		flex-wrap: wrap;
		gap: 20px 0;
	}

	&__stat {
		display: grid;
		gap: 7px;
		padding-right: 28px;
		margin-right: 28px;
		border-right: 1px solid var(--docs-renderer-rule);

		&:last-child {
			padding-right: 0;
			margin-right: 0;
			border-right: 0;
		}

		strong {
			font-size: 21px;
			font-weight: 600;
			line-height: 1.2;
			color: var(--docs-renderer-stat-color);
		}

		span {
			font-size: 12px;
			line-height: 1.5;
			color: var(--docs-renderer-muted);
		}
	}

	&__visual {
		width: 100%;
		max-width: 680px;
		justify-self: end;
	}

	@container (width <= 1100px) {
		grid-template-columns: minmax(0, 1fr);
		gap: 28px;

		&:not(.is-plain) {
			text-align: center;
		}

		&:not(.is-plain) &__description, &:not(.is-plain) &__stats {
			margin-inline: auto;
		}

		&:not(.is-plain) &__stats, &:not(.is-plain) .docs-renderer-actions {
			justify-content: center;
		}

		&__visual {
			justify-self: center;
		}
	}

	@container (width <= 760px) {
		&, .docs-renderer-node.is-full-width & {
			padding: 43px 20px 45px;
		}

		&__title {
			font-size: 32px;
		}

		&__description {
			font-size: 14px;
		}

		&__stats {
			padding-top: 23px;
			margin-top: 25px;
		}

		&__stat {
			padding-right: 25px;
			margin-right: 25px;
		}

		&__stat strong {
			font-size: 20px;
		}

		&__stat span {
			font-size: 10px;
		}
	}

	@container (width <= 359px) {
		&__title {
			font-size: 29px;
		}

		&__stat {
			padding-right: 19px;
			margin-right: 19px;
		}
	}
}
</style>
