<template>
	<div class="docs-renderer-image" :style="wrapperStyle">
		<img v-if="source" class="docs-renderer-image__light" :src="source" :alt="alt" :loading="loading" :style="imageStyle">
		<img v-if="dark" class="docs-renderer-image__dark" :src="dark" :alt="alt" :loading="loading" :style="imageStyle">
	</div>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { RendererModuleViewerProps } from '../../../types';
import { toLength } from '../utils';
import { resolveImageSource } from '../image-source';

const props = defineProps<RendererModuleViewerProps>();
const source = ref('');
const dark = ref('');
let generation = 0;
const resolve = async (value: unknown) => resolveImageSource(
	value,
	props.context.services?.resolveAsset,
	props.context.source
);
watch(
	() => [
		props.node.module.props.src,
		props.node.module.props.dark,
		props.context.source,
		props.context.services?.resolveAsset
	],
	async () => {
		const active = ++generation;
		try {
			const values = await Promise.all([resolve(props.node.module.props.src), resolve(props.node.module.props.dark)]);
			if (active !== generation) return;
			[source.value, dark.value] = values;
		} catch {
			if (active === generation) [source.value, dark.value] = ['', ''];
		}
	},
	{ immediate: true }
);
const alt = computed(() => String(props.node.module.props.alt || ''));
const loading = computed(() => props.node.module.props.eager ? 'eager' : 'lazy');
const wrapperStyle = computed(() => ({ borderRadius: `${Math.max(0, toLength(props.node.module.props.borderRadius, 0))}px` }));
const imageStyle = computed(() => ({ objectFit: String(props.node.module.props.fit || 'contain') as 'contain' | 'cover' | 'fill' }));
</script>
<style lang="scss">
.docs-renderer-image {
	display: block;
	height: 100%;
	overflow: hidden;

	img {
		display: block;
		width: 100%;
		height: 100%;
	}

	&__dark {
		display: none !important;
	}
}

[data-vc-theme="dark"] .docs-renderer-image__light:has(+ .docs-renderer-image__dark) {
	display: none;
}

[data-vc-theme="dark"] .docs-renderer-image__dark {
	display: block !important;
}
</style>
