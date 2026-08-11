<template>
	<button
		ref="trigger"
		class="docs-search-trigger"
		type="button"
		:aria-label="t('client.search.dialogLabel')"
		@click="handleOpen"
	>
		<span class="docs-search-trigger__icon" aria-hidden="true"></span>
		<span>{{ t('client.search.trigger') }}</span>
	</button>
</template>
<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useLocale } from '@deot/docs-locale';
import { DocsSearch } from './portal';

const route = useRoute();
const router = useRouter();
const { locale, t } = useLocale();
const trigger = ref<HTMLButtonElement>();
const lang = computed(() => String(route.params.lang || 'zh-CN'));

const handleOpen = () => {
	DocsSearch.popup({
		lang: lang.value,
		locale: locale.value,
		onNavigate: (target: { path: string; hash: string }) => router.push(target),
		onDestroyed: () => trigger.value?.focus()
	});
};

// Portal 独立挂载在 body；语言切换或 Header 卸载时必须同步释放旧弹层。
watch(lang, () => DocsSearch.destroy());
onBeforeUnmount(() => DocsSearch.destroy());
</script>
<style lang="scss">
@use '../../styles/bem' as *;

@include block(docs-search-trigger) {
	display: grid;
	width: min(240px, 100%);
	height: 34px;
	padding: 0 12px;
	font: inherit;
	color: #8c96a5;
	text-align: left;
	cursor: pointer;
	background: #f7f8fa;
	border: 1px solid #e8eaec;
	border-radius: 5px;
	grid-template-columns: 16px minmax(0, 1fr);
	gap: 8px;
	align-items: center;

	&:hover,
	&:focus-visible {
		color: #873bf4;
		border-color: #c9a8f8;
		outline: none;
	}

	@include element(icon) {
		width: 14px;
		height: 14px;
		border: 1.5px solid currentcolor;
		border-radius: 50%;

		&::after {
			display: block;
			width: 6px;
			height: 1.5px;
			margin: 10px 0 0 10px;
			background: currentcolor;
			content: "";
			transform: rotate(45deg);
		}
	}
}

@media screen and (width <= 768px) {
	@include block(docs-search-trigger) {
		width: 34px;
		padding: 0 9px;

		span:last-child {
			display: none;
		}
	}
}
</style>
