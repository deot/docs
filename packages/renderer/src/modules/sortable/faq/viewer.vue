<template>
	<section
		class="docs-renderer-faq"
		:class="{ 'is-center': align === 'center', 'is-left': align === 'left' }"
		:style="rootStyle"
	>
		<header v-if="hasHeader" class="docs-renderer-faq__header">
			<div v-if="title || eyebrow" class="docs-renderer-faq__heading-row">
				<h2 v-if="title" class="docs-renderer-faq__heading">{{ title }}</h2>
				<span v-if="eyebrow" class="docs-renderer-faq__eyebrow">{{ eyebrow }}</span>
			</div>
			<p v-if="description" class="docs-renderer-faq__lead">{{ description }}</p>
		</header>
		<div class="docs-renderer-faq__list">
			<details
				v-for="(item, index) in items"
				:key="index"
				class="docs-renderer-faq__item"
				:open="index === 0"
			>
				<summary class="docs-renderer-faq__question">{{ item.question }}</summary>
				<p class="docs-renderer-faq__answer">{{ item.answer }}</p>
			</details>
		</div>
	</section>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import type { RendererModuleViewerProps } from '../../../types';
import { rendererSortableSectionStyle } from '../../../frame/shared/sortable-width';
import { toRecord } from '../../shared/utils';

const props = defineProps<RendererModuleViewerProps>();
const value = computed(() => props.node.module.props);
const eyebrow = computed(() => String(value.value.eyebrow || ''));
const title = computed(() => String(value.value.title || ''));
const description = computed(() => String(value.value.description || ''));
const align = computed(() => String(value.value.align || 'center'));
const hasHeader = computed(() => Boolean(eyebrow.value || title.value || description.value));
const items = computed(() => (Array.isArray(value.value.items) ? value.value.items : []).map(toRecord));
const rootStyle = computed(() => rendererSortableSectionStyle(String(value.value.accent || '')));
</script>
