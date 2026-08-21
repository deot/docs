<template>
	<section class="docs-renderer-area" :class="{ 'is-editing': editing }">
		<img
			v-if="source"
			class="docs-renderer-area__image"
			:src="source"
			:alt="alt"
		>
		<div v-else class="docs-renderer-area__empty">
			{{ t('renderer.editor.areaNeedImage') }}
		</div>
		<component
			:is="tagOf(item)"
			v-for="(item, index) in areas"
			:key="index"
			class="docs-renderer-area__zone"
			:style="styleOf(item)"
			:href="tagOf(item) === 'a' ? hrefOf(item) : undefined"
			:target="tagOf(item) === 'a' && external(item.to) ? '_blank' : undefined"
			:rel="tagOf(item) === 'a' && external(item.to) ? 'noopener noreferrer' : undefined"
			:aria-label="labelOf(item, index)"
			@click="event => handleClick(event, item)"
		>
			<span v-if="editing" class="docs-renderer-area__label">{{ labelOf(item, index) }}</span>
		</component>
	</section>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { CSSProperties } from 'vue';
import { useLocale } from '@deot/docs-locale';
import type { RendererModuleViewerProps } from '../../../types';
import { resolveImageSource } from '../../shared/image-source';
import { isUnsafeHref } from '../../shared/utils';
import { normalizeAreaZones, type RendererAreaZone } from './zones';

const props = defineProps<RendererModuleViewerProps>();
const { t } = useLocale(computed(() => props.context.locale));
const source = ref('');
let generation = 0;
watch(
	() => [props.node.module.props.src, props.context.source, props.context.services?.resolveAsset] as const,
	async () => {
		const active = ++generation;
		try {
			const next = await resolveImageSource(
				props.node.module.props.src,
				props.context.services?.resolveAsset,
				props.context.source
			);
			if (active === generation) source.value = next;
		} catch {
			if (active === generation) source.value = '';
		}
	},
	{ immediate: true }
);
const alt = computed(() => String(props.node.module.props.alt || ''));
const areas = computed(() => normalizeAreaZones(props.node.module.props.areas ?? props.node.module.props.list));
const editing = computed(() => props.context.scene === 'combo' && !props.context.readonly);
const interactive = computed(() => props.context.readonly);
const unsafe = (value: string) => isUnsafeHref(value);
const external = (value: string) => /^[a-z][a-z\d+.-]*:/iu.test(value) || value.startsWith('//');
const targetOf = (item: RendererAreaZone) => item.to.trim();
const tagOf = (item: RendererAreaZone) => (
	targetOf(item) && interactive.value && !unsafe(item.to) ? 'a' : 'div'
);
const hrefOf = (item: RendererAreaZone) => {
	const value = targetOf(item);
	if (!value || unsafe(value)) return '';
	return external(value) ? value : props.context.services?.resolveLink?.(value) || value;
};
const labelOf = (item: RendererAreaZone, index: number) => (
	item.label.trim() || t('renderer.editor.areaItem', { index: index + 1 })
);
const styleOf = (item: RendererAreaZone) => ({
	left: `${item.x}%`,
	top: `${item.y}%`,
	width: `${item.width}%`,
	height: `${item.height}%`,
	zIndex: item.zIndex
}) as CSSProperties;
const handleClick = async (event: MouseEvent, item: RendererAreaZone) => {
	if (!interactive.value) {
		event.preventDefault();
		return;
	}
	const value = targetOf(item);
	if (!value || unsafe(value) || external(value)) return;
	if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
	if (!props.context.services?.navigate) return;
	event.preventDefault();
	try {
		await props.context.services.navigate(value);
	} catch {
		// 导航失败由宿主处理，Viewer 保持当前页面。
	}
};
</script>
<style lang="scss">
@use '../../../../node_modules/@deot/docs-theme/src/functions' as *;

.docs-renderer-area {
	position: relative;
	display: block;
	overflow: hidden;
	background: varfix(background-color);

	&__image {
		display: block;
		width: 100%;
		height: auto;
	}

	&__empty {
		display: grid;
		min-height: 160px;
		color: varfix(foreground-color-mute);
		border: 1px dashed varfix(border-color);
		place-items: center;
	}

	&__zone {
		position: absolute;
		box-sizing: border-box;
	}

	&.is-editing &__zone {
		pointer-events: none;
		border: 1px dashed varfix(primary-color);
	}

	&:not(.is-editing) &__zone {
		pointer-events: none;
	}

	&:not(.is-editing) a.docs-renderer-area__zone {
		pointer-events: auto;
		cursor: pointer;
	}

	&__label {
		display: inline-block;
		padding: 1px 4px;
		font-size: 12px;
		line-height: 1.2;
		color: #fff;
		white-space: nowrap;
		background: varfix(primary-color);
	}
}
</style>
