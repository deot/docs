<template>
	<header class="docs-header">
		<RouterLink class="docs-header__brand" :to="`/${lang}`">
			{{ t('client.header.brand') }}
		</RouterLink>
		<div class="docs-header__search"><DocsSearch /></div>
		<nav class="docs-header__locales">
			<RouterLink
				v-for="(localeConfig, locale) in config.locales"
				:key="locale"
				:to="localePath(locale)"
			>
				{{ localeConfig.label }}
			</RouterLink>
		</nav>
	</header>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { useLocale } from '@deot/docs-locale';
import DocsSearch from '../search';
import { getDocsConfig } from '../../utils/runtime';

const route = useRoute();
const config = getDocsConfig();
const { t } = useLocale();
const lang = computed(() => String(route.params.lang));
const localePath = (locale: string) => {
	const segments = route.path.split('/').filter(Boolean);
	segments[0] = locale;
	return {
		path: `/${segments.join('/')}`,
		query: route.query,
		hash: route.hash
	};
};
</script>
<style lang="scss">
@use '../../styles/bem' as *;

@include block(docs-header) {
	display: grid;
	grid-template-columns: minmax(160px, 1fr) minmax(180px, 320px) minmax(160px, 1fr);
	width: 100%;
	height: 60px;
	padding: 0 30px;
	background: #fff;
	align-items: center;

	@include element(brand) {
		display: grid;
		height: 60px;
		font-size: 16px;
		font-weight: 600;
		align-items: center;
	}

	@include element(locales) {
		display: grid;
		grid-auto-columns: max-content;
		grid-auto-flow: column;
		height: 60px;
		align-items: stretch;
		justify-self: end;

		a {
			display: grid;
			padding: 5px 20px;
			font-size: 14px;
			color: #697b8c;
			align-items: center;
			transition: color 0.2s ease;

			&:hover,
			&.router-link-active {
				color: #873bf4;
			}

			&.router-link-active {
				box-shadow: inset 0 2px 0 #873bf4;
			}
		}
	}

	@include element(search) {
		display: grid;
		min-width: 0;
		justify-items: center;
	}
}

@media screen and (width <= 768px) {
	@include block(docs-header) {
		grid-template-columns: minmax(110px, 1fr) 34px auto;
		padding: 0 12px;

		@include element(locales) {
			a {
				padding-right: 8px;
				padding-left: 8px;
			}
		}
	}
}
</style>
