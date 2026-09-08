<template>
	<nav
		v-if="previous || next"
		class="docs-page-footer"
		:aria-label="t('client.page.navigation')"
	>
		<RouterLink
			v-if="previous"
			class="docs-page-footer__link docs-page-footer__link--previous"
			:to="toPath(previous.value)"
			:aria-label="t('client.page.previous', { label: previous.label })"
		>
			<svg class="docs-page-footer__icon" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
				<path
					fill-rule="evenodd"
					clip-rule="evenodd"
					d="M9.78 4.22a.75.75 0 0 1 0 1.06L7.06 8l2.72 2.72a.75.75 0 1
						1-1.06 1.06L5.47 8.53a.75.75 0 0 1 0-1.06l3.25-3.25a.75.75 0 0 1 1.06 0Z"
				/>
			</svg>
			<span>{{ previous.label }}</span>
		</RouterLink>
		<RouterLink
			v-if="next"
			class="docs-page-footer__link docs-page-footer__link--next"
			:to="toPath(next.value)"
			:aria-label="t('client.page.next', { label: next.label })"
		>
			<span>{{ next.label }}</span>
			<svg class="docs-page-footer__icon" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
				<path
					fill-rule="evenodd"
					clip-rule="evenodd"
					d="M6.22 4.22a.75.75 0 0 1 1.06 0l3.25 3.25a.75.75 0 0 1 0
						1.06l-3.25 3.25a.75.75 0 0 1-1.06-1.06L8.94 8 6.22 5.28a.75.75 0 0 1 0-1.06Z"
				/>
			</svg>
		</RouterLink>
	</nav>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { useLocale } from '@deot/docs-locale';
import { sidebarItems } from '../../modules/sidebar';
import { findSidebarNeighbors } from '../../utils/sidebar';
import { localizeRoutePath } from '../../utils/route';

defineOptions({ name: 'DocsPageFooter' });

const route = useRoute();
const { t } = useLocale();
const lang = computed(() => String(route.params.lang || 'zh-CN'));
const neighbors = computed(() => {
	if (!sidebarItems.value?.length) return {};
	return findSidebarNeighbors(sidebarItems.value, route.path, lang.value);
});
const previous = computed(() => neighbors.value.previous);
const next = computed(() => neighbors.value.next);
const toPath = (value?: string) => localizeRoutePath(lang.value, value || '/');
</script>
<style lang="scss">
@use '../../styles/bem' as *;

@include block(docs-page-footer) {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 8px;
	margin-top: 64px;
	font-size: 14px;
	line-height: 24px;
	color: #364153;

	@include element(link) {
		display: flex;
		min-width: 0;
		align-items: center;
		gap: 8px;
		color: inherit;
		text-decoration: none;

		span {
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}

		&:hover,
		&:focus-visible {
			color: #030712;
			outline: none;
		}

		@include modifier(next) {
			margin-left: auto;
		}
	}

	@include element(icon) {
		display: block;
		flex: none;
		width: 16px;
		height: 16px;
	}
}

[data-doc-theme='dark'] .docs-page-footer,
[data-vc-theme='dark'] .docs-page-footer {
	color: #e5e7eb;

	.docs-page-footer__link:hover,
	.docs-page-footer__link:focus-visible {
		color: #fff;
	}
}
</style>
