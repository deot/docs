<template>
	<button
		type="button"
		class="docs-renderer-editor-demos-card"
		:style="{ '--docs-demo-accent': item.accent }"
		@click="emit('open', item.name)"
	>
		<i class="docs-renderer-editor-demos-card__accent" aria-hidden="true" />
		<span class="docs-renderer-editor-demos-card__name">{{ item.name }}</span>
		<strong class="docs-renderer-editor-demos-card__title">{{ item.title }}</strong>
		<p class="docs-renderer-editor-demos-card__desc">{{ item.description }}</p>
		<ul v-if="item.modules.length" class="docs-renderer-editor-demos-card__modules">
			<li v-for="type in item.modules" :key="type">{{ type }}</li>
		</ul>
		<span class="docs-renderer-editor-demos-card__action">{{ action || t('client.demos.open') }}</span>
	</button>
</template>
<script setup lang="ts">
import { useLocale } from '@deot/docs-locale';
import type { RendererEditorDemoItem } from '../catalog';

defineProps<{
	item: Omit<RendererEditorDemoItem, 'name'> & { name: string };
	action?: string;
}>();
const emit = defineEmits<{
	open: [name: string];
}>();
const { t } = useLocale();
</script>
<style lang="scss">
.docs-renderer-editor-demos-card {
	display: grid;
	grid-template-rows: auto auto auto 1fr auto auto;
	gap: 10px;
	align-content: start;
	width: 100%;
	min-width: 0;
	padding: 20px;
	color: inherit;
	text-align: left;
	cursor: pointer;
	background: color-mix(in srgb, var(--docs-demo-accent) 8%, varfix(background-color));
	border: 1px solid color-mix(in srgb, var(--docs-demo-accent) 26%, varfix(border-color));
	border-radius: 16px;

	&:hover {
		border-color: var(--docs-demo-accent);
	}

	&__accent {
		display: block;
		height: 4px;
		margin: -20px -20px 2px;
		background: var(--docs-demo-accent);
		border-radius: 16px 16px 0 0;
	}

	&__name {
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 12px;
		color: var(--docs-demo-accent);
	}

	&__title {
		font-size: 18px;
		font-weight: 650;
	}

	&__desc {
		margin: 0;
		line-height: 1.6;
		color: varfix(foreground-color-mute);
	}

	&__modules {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		padding: 0;
		margin: 0;
		list-style: none;
	}

	&__modules li {
		padding: 2px 8px;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 12px;
		background: color-mix(in srgb, var(--docs-demo-accent) 14%, transparent);
		border-radius: 999px;
	}

	&__action {
		font-size: 13px;
		font-weight: 600;
		color: var(--docs-demo-accent);
	}
}
</style>
