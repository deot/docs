<template>
	<button
		ref="trigger"
		class="docs-search-trigger"
		type="button"
		:aria-label="t('client.search.dialogLabel')"
		@click="handleOpen"
	>
		<span class="docs-search-trigger__icon" aria-hidden="true"></span>
		<kbd class="docs-search-trigger__shortcut">{{ shortcut }}</kbd>
	</button>
</template>
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useLocale } from '@deot/docs-locale';
import { DocsSearch } from './portal';

const route = useRoute();
const router = useRouter();
const { locale, t } = useLocale();
const trigger = ref<HTMLButtonElement>();
const lang = computed(() => String(route.params.lang || 'zh-CN'));
const shortcut = /Mac|iPhone|iPad/i.test(`${navigator.platform} ${navigator.userAgent}`)
	? '⌘K'
	: 'Ctrl K';

const handleOpen = () => {
	DocsSearch.popup({
		lang: lang.value,
		locale: locale.value,
		onNavigate: (target: { path: string; hash: string }) => router.push(target),
		onDestroyed: () => trigger.value?.focus()
	});
};
const handleShortcut = (event: KeyboardEvent) => {
	if (event.repeat || event.altKey || event.code !== 'KeyK') return;
	if (!event.metaKey && !event.ctrlKey) return;
	event.preventDefault();
	if (document.querySelector('.docs-search')) return;
	handleOpen();
};

// Portal 独立挂载在 body；语言切换或 Header 卸载时必须同步释放旧弹层。
watch(lang, () => DocsSearch.destroy());
onMounted(() => window.addEventListener('keydown', handleShortcut));
onBeforeUnmount(() => {
	window.removeEventListener('keydown', handleShortcut);
	DocsSearch.destroy();
});
</script>
<style lang="scss">
@use '../../styles/bem' as *;

@include block(docs-search-trigger) {
	display: inline-flex;
	width: 54px;
	height: 24px;
	padding: 0 8px;
	color: varfix(foreground-color-light);
	cursor: pointer;
	background: varfix(background-color-soft);
	border: 1px solid varfix(border-color);
	border-radius: 999px;
	box-sizing: border-box;
	align-items: center;
	justify-content: space-between;
	column-gap: 4px;

	&:hover,
	&:focus-visible {
		color: varfix(foreground-color-light);
		background: varfix(background-color-mute);
		border-color: varfix(border-color);
		outline: none;
	}

	@include element(icon) {
		position: relative;
		display: block;
		flex: none;
		width: 12px;
		height: 12px;
		color: inherit;
		border: 1.5px solid currentcolor;
		border-radius: 50%;

		&::after {
			position: absolute;
			right: -3px;
			bottom: -1px;
			width: 4px;
			height: 1.5px;
			background: currentcolor;
			content: "";
			transform: rotate(45deg);
			transform-origin: left center;
		}
	}

	@include element(shortcut) {
		padding: 0;
		font: inherit;
		font-size: 12px;
		font-weight: 500;
		line-height: 1;
		color: #6a7282;
		background: transparent;
		border: 0;
		box-shadow: none;
	}
}

@media screen and (width <= 768px) {
	@include block(docs-search-trigger) {
		width: 24px;
		height: 24px;
		justify-content: center;
		padding: 0;

		@include element(shortcut) {
			display: none;
		}
	}
}
</style>
