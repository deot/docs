<template>
	<ul
		class="docs-sidebar"
		:class="{ 'docs-sidebar--nested': nested }"
		:style="nested ? { '--docs-sidebar-depth': depth } : undefined"
	>
		<li
			v-for="item in items"
			:key="`${item.label}:${item.value || ''}`"
			class="docs-sidebar__item"
		>
			<a
				v-if="item.value && isExternal(item.value)"
				class="docs-sidebar__link"
				:href="item.value"
			>
				<SidebarGlyph :item="item" />
				<span class="docs-sidebar__text">{{ item.label }}</span>
				<span v-if="item.tag" class="docs-sidebar__tag">{{ item.tag }}</span>
			</a>
			<RouterLink
				v-else-if="item.value"
				class="docs-sidebar__link"
				:class="{ 'is-active': isItemActive(item.value) }"
				:to="toPath(item.value)"
			>
				<SidebarGlyph :item="item" :selected="isItemActive(item.value)" />
				<span class="docs-sidebar__text">{{ item.label }}</span>
				<span v-if="item.tag" class="docs-sidebar__tag">{{ item.tag }}</span>
			</RouterLink>
			<span v-else class="docs-sidebar__label">
				<SidebarGlyph :item="item" />
				<span class="docs-sidebar__text">{{ item.label }}</span>
				<span v-if="item.tag" class="docs-sidebar__tag">{{ item.tag }}</span>
			</span>
			<DefaultSidebar
				v-if="item.children?.length"
				:items="item.children"
				nested
				:depth="depth + 1"
			/>
		</li>
	</ul>
</template>
<script setup lang="ts">
import { RouterLink, useRoute } from 'vue-router';
import type { SidebarItem } from '../../types';
import SidebarGlyph from './sidebar-glyph.vue';

defineOptions({ name: 'DefaultSidebar' });
withDefaults(defineProps<{ items: SidebarItem[]; nested?: boolean; depth?: number }>(), {
	depth: 0
});
const route = useRoute();
const isExternal = (value: string) => (
	/^[a-z][a-z\d+.-]*:/i.test(value) || value.startsWith('//')
);
const toPath = (value: string) => {
	const lang = String(route.params.lang || '');
	return `/${lang}/${value.replace(/^\/+/, '')}`;
};
const isItemActive = (value: string) => {
	const target = toPath(value);
	return route.path === target || route.path.startsWith(`${target}/`);
};
</script>
<style lang="scss">
@use '../../styles/bem' as *;

@include block(docs-sidebar) {
	display: flex;
	flex-direction: column;
	gap: 8px;
	width: 100%;
	padding: 24px;
	margin: 0;
	list-style: none;

	@include modifier(nested) {
		gap: 8px;
		padding: 0;
		margin: 0;
		border-left: 1px solid color-mix(in srgb, varfix(foreground-color) 10%, transparent);

		.docs-sidebar--nested {
			border-left-color: transparent;
		}
	}

	@include element(item) {
		padding: 0;
		margin: 0;
		list-style: none;
	}

	@include element(link) {
		display: inline-flex;
		gap: 12px;
		max-width: 100%;
		padding: 0;
		font-size: 14px;
		font-weight: 400;
		line-height: 28px;
		color: varfix(foreground-color-light);
		cursor: pointer;
		background: transparent;
		border: 0;
		border-radius: 0;
		align-items: center;

		&:hover {
			color: varfix(foreground-color);
			background: transparent;
		}

		&.is-active,
		&.router-link-active {
			font-weight: 600;
			color: varfix(foreground-color);
			background: transparent;
		}
	}

	@include element(label) {
		display: flex;
		padding: 0;
		margin: 24px 0 12px;
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
		font-size: 12px;
		font-weight: 500;
		line-height: 24px;
		letter-spacing: 0.1em;
		color: varfix(foreground-color-mute);
		text-transform: uppercase;
		gap: 8px;
		align-items: center;
	}

	> .docs-sidebar__item:first-child > .docs-sidebar__label {
		margin-top: 0;
	}

	@include modifier(nested) {
		@include element(item) {
			display: flex;
			flex-direction: column;
			gap: 8px;
			margin-left: -1px;
			align-items: flex-start;
		}

		@include element(link) {
			display: flex;
			width: 100%;
			padding: 0 0 0 calc(16px + (var(--docs-sidebar-depth, 1) - 1) * 14px);
			font-size: 14px;
			line-height: 24px;
			border-left: 1px solid transparent;

			&:hover {
				border-left-color: color-mix(in srgb, varfix(foreground-color) 25%, transparent);
			}

			&.is-active,
			&.router-link-active {
				border-left-color: varfix(foreground-color);
			}
		}

		@include element(label) {
			padding-left: calc(16px + (var(--docs-sidebar-depth, 1) - 1) * 14px);
			margin: 16px 0 12px;
		}
	}

	@include element(icon) {
		display: inline-flex;
		width: 16px;
		height: 16px;
		font-size: 16px;
		color: inherit;
		flex-shrink: 0;
		align-items: center;
		justify-content: center;

		.vc-icon {
			font-size: 16px;
			color: inherit;
		}

		svg {
			display: block;
			width: 16px;
			height: 16px;
		}
	}

	@include element(media) {
		display: block;
		width: 16px;
		height: 16px;
		object-fit: contain;
	}

	@include element(glyph) {
		display: block;
		width: 16px;
		height: 16px;
		font-size: 16px;
	}

	@include element(text) {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		flex: 0 1 auto;
	}

	@include element(tag) {
		position: relative;
		display: inline-flex;
		padding: 0 6px;
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
		font-size: 10px;
		font-weight: 500;
		line-height: 18px;
		letter-spacing: 0.04em;
		color: varfix(link-color);
		white-space: nowrap;
		background: color-mix(in srgb, varfix(link-color) 12%, transparent);
		border: 1px dashed color-mix(in srgb, varfix(link-color) 48%, transparent);
		flex-shrink: 0;
		align-items: center;

		&::before {
			position: absolute;
			color: color-mix(in srgb, varfix(link-color) 55%, white);
			pointer-events: none;
			background-image:
				linear-gradient(currentcolor, currentcolor),
				linear-gradient(currentcolor, currentcolor),
				linear-gradient(currentcolor, currentcolor),
				linear-gradient(currentcolor, currentcolor),
				linear-gradient(currentcolor, currentcolor),
				linear-gradient(currentcolor, currentcolor),
				linear-gradient(currentcolor, currentcolor),
				linear-gradient(currentcolor, currentcolor);
			background-position:
				0 2px,
				2px 0,
				100% 2px,
				calc(100% - 2px) 0,
				0 calc(100% - 2px),
				2px 100%,
				100% calc(100% - 2px),
				calc(100% - 2px) 100%;
			background-repeat: no-repeat;
			background-size:
				5px 1px,
				1px 5px,
				5px 1px,
				1px 5px,
				5px 1px,
				1px 5px,
				5px 1px,
				1px 5px;
			content: "";
			inset: -2.5px;
		}
	}
}
</style>
