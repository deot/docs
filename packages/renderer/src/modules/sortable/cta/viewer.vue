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
