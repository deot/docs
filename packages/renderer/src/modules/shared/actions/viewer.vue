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
<style lang="scss">
@use '../../../../node_modules/@deot/docs-theme/src/functions' as *;

.docs-renderer-actions {
	display: flex;
	gap: 12px;
	align-items: center;
	flex-wrap: wrap;
}

.docs-renderer-action {
	--docs-renderer-action-color: var(--docs-renderer-accent, varfix(primary-color));

	display: inline-flex;
	min-height: 36px;
	padding: 0 16px;
	font: inherit;
	font-size: 14px;
	font-weight: 600;
	line-height: 1.2;
	color: var(--docs-renderer-action-text, #fff);
	text-decoration: none;
	cursor: pointer;
	background: var(--docs-renderer-action-color);
	border: 1px solid var(--docs-renderer-action-color);
	border-radius: 10px;
	box-sizing: border-box;
	transition: transform 0.22s ease, filter 0.22s ease, background 0.22s ease, box-shadow 0.22s ease;
	appearance: none;
	user-select: none;
	align-items: center;
	justify-content: center;

	&.is-small {
		min-height: 28px;
		padding: 0 12px;
		font-size: 12px;
	}

	&.is-large {
		min-height: 48px;
		padding: 0 22px;
		font-size: 15px;
		border-radius: 12px;
	}

	&.is-outline,
	&.is-ghost,
	&.is-link {
		color: var(--docs-renderer-action-text, var(--docs-renderer-action-color));
		background: transparent;
	}

	&.is-outline {
		border-color: color-mix(in srgb, var(--docs-renderer-action-color) 55%, varfix(border-color));
	}

	&.is-ghost {
		background: color-mix(in srgb, var(--docs-renderer-action-color) 12%, transparent);
		border-color: transparent;
	}

	&.is-link {
		min-height: 0;
		padding: 0;
		border-color: transparent;
		border-radius: 0;
	}

	&:hover,
	&:focus-visible {
		outline: none;
		filter: brightness(1.06);
		transform: translateY(-1px);
		box-shadow: 0 8px 18px color-mix(in srgb, var(--docs-renderer-action-color) 24%, transparent);
	}

	&.is-outline:hover,
	&.is-outline:focus-visible,
	&.is-ghost:hover,
	&.is-ghost:focus-visible {
		background: color-mix(in srgb, var(--docs-renderer-action-color) 12%, transparent);
		filter: none;
	}

	&.is-link:hover,
	&.is-link:focus-visible {
		text-decoration: underline;
		filter: none;
		transform: none;
		box-shadow: none;
	}

	&:disabled {
		cursor: not-allowed;
		opacity: 0.45;
		filter: none;
		transform: none;
		box-shadow: none;
	}
}

@media (prefers-reduced-motion: reduce) {
	.docs-renderer-action {
		animation: none !important;
		transition: none !important;
	}
}
</style>
