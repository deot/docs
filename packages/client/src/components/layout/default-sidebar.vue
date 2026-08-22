<template>
	<ul class="docs-sidebar" :class="{ 'docs-sidebar--nested': nested }">
		<li v-for="item in items" :key="`${item.label}:${item.value || ''}`">
			<a v-if="item.value && isExternal(item.value)" :href="item.value">{{ item.label }}</a>
			<RouterLink v-else-if="item.value" :to="toPath(item.value)">{{ item.label }}</RouterLink>
			<span v-else class="docs-sidebar__label">{{ item.label }}</span>
			<DefaultSidebar v-if="item.children?.length" :items="item.children" nested />
		</li>
	</ul>
</template>
<script setup lang="ts">
import { RouterLink, useRoute } from 'vue-router';
import type { SidebarItem } from '../../types';

defineOptions({ name: 'DefaultSidebar' });
defineProps<{ items: SidebarItem[]; nested?: boolean }>();
const route = useRoute();
const isExternal = (value: string) => (
	/^[a-z][a-z\d+.-]*:/i.test(value) || value.startsWith('//')
);
const toPath = (value: string) => {
	const lang = String(route.params.lang || '');
	return `/${lang}/${value.replace(/^\/+/, '')}`;
};
</script>
<style lang="scss">
@use '../../styles/bem' as *;

@include block(docs-sidebar) {
	display: grid;
	grid-auto-rows: max-content;
	width: 260px;
	padding: 29px 0 24px;
	margin: 0;
	list-style: none;
	align-content: start;

	@include modifier(nested) {
		width: 100%;
		padding: 0;
	}

	li {
		padding: 0;
		margin: 0;
		list-style: none;

		a {
			display: grid;
			height: 36px;
			padding-left: 54px;
			font-size: 14px;
			font-weight: 400;
			color: varfix(foreground-color-light);
			cursor: pointer;
			border-right: 3px solid transparent;
			align-items: center;

			&:hover {
				color: varfix(link-color);
				background: varfix(background-color-soft);
			}

			&.router-link-active {
				color: varfix(primary-color);
				background: varfix(primary-color-light);
				border-right-color: varfix(primary-color);
			}
		}
	}

	@include element(label) {
		display: grid;
		height: 40px;
		padding-left: 42px;
		font-size: 14px;
		font-weight: 600;
		color: varfix(foreground-color);
		align-items: center;
	}

	&--nested &__label {
		height: 36px;
		padding: 10px 0 0 54px;
		font-size: 12px;
		font-weight: 400;
		color: varfix(foreground-color-mute);
		align-items: end;
	}
}

@media screen and (width <= 768px) {
	@include block(docs-sidebar) {
		width: 100%;
		padding-top: 12px;

		li a {
			height: 44px;
			padding-left: 32px;
		}

		@include element(label) {
			height: 44px;
			padding-left: 24px;
		}

		&--nested &__label {
			height: 40px;
			padding-left: 32px;
		}
	}
}
</style>
