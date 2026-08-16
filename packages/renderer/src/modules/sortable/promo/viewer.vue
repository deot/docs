<template>
	<section
		class="docs-renderer-ads"
		:class="{
			[`is-${layout}`]: true,
			[`is-${style}`]: true,
			'is-looping': looping
		}"
		:style="rootStyle"
	>
		<div class="docs-renderer-ads__viewport">
			<div class="docs-renderer-ads__track">
				<div v-for="copy in copies" :key="copy" class="docs-renderer-ads__set">
					<component
						:is="tagOf(item)"
						v-for="(item, index) in items"
						:key="`${copy}-${index}`"
						class="docs-renderer-ads__item"
						:class="{ 'is-plain': !srcOf(index) }"
						:href="tagOf(item) === 'a' ? hrefOf(item) : undefined"
						:target="tagOf(item) === 'a' ? '_blank' : undefined"
						:rel="tagOf(item) === 'a' ? 'noopener noreferrer' : undefined"
						:aria-label="String(item.title || item.alt || '')"
						@click="event => handleClick(event, item)"
					>
						<div v-if="srcOf(index)" class="docs-renderer-ads__visual">
							<img
								class="docs-renderer-ads__media"
								:src="srcOf(index)"
								:alt="String(item.alt || item.title || '')"
								loading="lazy"
							>
						</div>
						<span v-else class="docs-renderer-ads__fallback" aria-hidden="true">{{ markOf(item) }}</span>
						<span v-if="item.title" class="docs-renderer-ads__title">{{ item.title }}</span>
					</component>
				</div>
			</div>
		</div>
	</section>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { CSSProperties } from 'vue';
import type { RendererModuleViewerProps } from '../../../types';
import { toEnumValue, toLength, toRecord } from '../../shared/utils';
import { resolveImageSource } from '../../shared/image-source';
import { ADS_LAYOUTS, ADS_STYLES, isUnsafeHref } from './constants';

const props = defineProps<RendererModuleViewerProps>();
const resolved = ref<string[]>([]);
let generation = 0;
const items = computed(() => (
	Array.isArray(props.node.module.props.items) ? props.node.module.props.items : []
).map(toRecord));
const layout = computed(() => toEnumValue(props.node.module.props.layout, ADS_LAYOUTS, 'tile'));
const style = computed(() => toEnumValue(props.node.module.props.style, ADS_STYLES, 'banner'));
const looping = computed(() => layout.value === 'scroll' && items.value.length > 1);
const copies = computed(() => looping.value ? [0, 1] : [0]);
const interactive = computed(() => props.context.readonly);
const resolve = async (value: unknown) => resolveImageSource(
	value,
	props.context.services?.resolveAsset,
	props.context.source
);
watch(
	() => [
		items.value.map(item => String(item.src)).join('\0'),
		props.context.source,
		props.context.services?.resolveAsset
	] as const,
	async () => {
		const active = ++generation;
		try {
			const values = await Promise.all(items.value.map(item => resolve(item.src)));
			if (active === generation) resolved.value = values;
		} catch {
			if (active === generation) resolved.value = items.value.map(() => '');
		}
	},
	{ immediate: true }
);
const rootStyle = computed(() => {
	const columns = Math.max(1, toLength(props.node.module.props.columns, 2));
	const gap = Math.max(0, toLength(props.node.module.props.gap, 12));
	const height = Math.max(80, toLength(props.node.module.props.height, 180));
	const speed = Math.max(2, toLength(props.node.module.props.speed, 4));
	return {
		'--docs-renderer-columns': columns,
		'--docs-renderer-gap': `${gap}px`,
		'--docs-renderer-ads-height': `${height}px`,
		'--docs-renderer-ads-duration': `${Math.max(8, items.value.length * speed)}s`
	} as CSSProperties;
});
const srcOf = (index: number) => resolved.value[index] || '';
const markOf = (item: Record<string, unknown>) => {
	const title = String(item.title || item.alt || '').trim();
	return title ? [...title][0] : '●';
};
const hrefValue = (item: Record<string, unknown>) => String(item.href || '').trim();
const unsafe = (value: string) => isUnsafeHref(value);
const external = (value: string) => /^[a-z][a-z\d+.-]*:/iu.test(value) || value.startsWith('//');
const tagOf = (item: Record<string, unknown>) => {
	const value = hrefValue(item);
	return value && !unsafe(value) && interactive.value ? 'a' : 'div';
};
const hrefOf = (item: Record<string, unknown>) => {
	const value = hrefValue(item);
	if (!value || unsafe(value)) return '';
	return external(value) ? value : props.context.services?.resolveLink?.(value) || value;
};
const handleClick = async (event: MouseEvent, item: Record<string, unknown>) => {
	if (!interactive.value) {
		event.preventDefault();
		return;
	}
	const value = hrefValue(item);
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
