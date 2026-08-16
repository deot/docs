<template>
	<div class="docs-renderer-actions">
		<component
			:is="tagOf(item)"
			v-for="(item, index) in items"
			:key="index"
			class="docs-renderer-action"
			:class="classOf(item)"
			:style="styleOf(item)"
			:href="tagOf(item) === 'a' ? href(item) : undefined"
			:target="tagOf(item) === 'a' && item.target === '_blank' ? '_blank' : undefined"
			:rel="tagOf(item) === 'a' && item.target === '_blank' ? 'noopener noreferrer' : undefined"
			:type="tagOf(item) === 'button' ? 'button' : undefined"
			:disabled="tagOf(item) === 'button' && !target(item)"
			@click="event => handleClick(event, item)"
		>
			{{ item.label }}
		</component>
	</div>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import type { CSSProperties } from 'vue';
import type { RendererModuleViewerProps } from '../../../types';
import {
	normalizeActionVariant,
	toEnumValue,
	toRecord,
	ACTION_SIZES
} from '../utils';

const props = defineProps<RendererModuleViewerProps>();
const items = computed(() => (
	Array.isArray(props.node.module.props.items) ? props.node.module.props.items : []
).map(toRecord));
const interactive = computed(() => props.context.readonly);
const target = (item: Record<string, unknown>) => String(item.to || '').trim();
const unsafe = (value: string) => /^(?:data|javascript|vbscript):/iu.test(value);
const external = (value: string) => /^[a-z][a-z\d+.-]*:/iu.test(value) || value.startsWith('//');
const tagOf = (item: Record<string, unknown>) => (
	target(item) && interactive.value ? 'a' : 'button'
);
const classOf = (item: Record<string, unknown>) => ({
	[`is-${normalizeActionVariant(item.variant)}`]: true,
	[`is-${toEnumValue(item.size, ACTION_SIZES, 'medium')}`]: true
});
const styleOf = (item: Record<string, unknown>) => {
	const color = String(item.color || '');
	const textColor = String(item.textColor || '');
	return {
		...(color ? { '--docs-renderer-action-color': color } : {}),
		...(textColor ? { '--docs-renderer-action-text': textColor } : {})
	} as CSSProperties;
};
const href = (item: Record<string, unknown>) => {
	const value = target(item);
	if (!value || unsafe(value)) return '';
	return external(value) ? value : props.context.services?.resolveLink?.(value) || value;
};
const handleClick = async (event: MouseEvent, item: Record<string, unknown>) => {
	if (!interactive.value) {
		event.preventDefault();
		return;
	}
	const value = target(item);
	if (!value || unsafe(value) || external(value) || item.target === '_blank') return;
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
