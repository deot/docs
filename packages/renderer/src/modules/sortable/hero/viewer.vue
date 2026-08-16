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
