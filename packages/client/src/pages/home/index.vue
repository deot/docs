<template>
	<section class="docs-home">
		<RouterLink v-if="entry" class="docs-home__entry" :to="entry">
			<h1 class="docs-home__title">
				{{ t('client.home.greeting') }}
				<span class="docs-home__separator">-</span>
				{{ t('client.home.quickStart') }}
			</h1>
		</RouterLink>
		<h1 v-else class="docs-home__title">
			{{ t('client.home.greeting') }}
			<span class="docs-home__separator">-</span>
			{{ t('client.home.quickStart') }}
		</h1>
	</section>
</template>
<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { useLocale } from '@deot/docs-locale';
import { ResourcePlan } from '../../modules/resource-plan';
import { getDefaultLanguage } from '../../utils/resolver';
import { getDocsConfig } from '../../utils/runtime';

const route = useRoute();
const config = getDocsConfig();
const { t } = useLocale();
const entry = ref('');
let controller: AbortController | undefined;

const loadEntry = async () => {
	controller?.abort();
	const activeController = new AbortController();
	controller = activeController;
	entry.value = '';
	try {
		const lang = String(route.params.lang || getDefaultLanguage(config));
		const target = await ResourcePlan.resolveHomeEntry(config, lang, {
			signal: activeController.signal
		});
		if (!activeController.signal.aborted) entry.value = target || '';
	} catch {
		// 默认首页没有可达文档时保持静态标题，不展示后台资源错误。
	}
};

watch(() => route.params.lang, loadEntry, { immediate: true });
onBeforeUnmount(() => controller?.abort());
</script>
<style lang="scss">
@use '../../styles/bem' as *;

@include block(docs-home) {
	display: grid;
	min-height: 600px;
	place-items: center;

	@include element(entry) {
		display: block;
		padding: 24px;
		border-radius: 12px;
		transition: color 0.2s ease, background-color 0.2s ease;

		&:hover,
		&:focus-visible {
			color: varfix(primary-color);
			background: varfix(primary-color-light);
			outline: none;
		}
	}

	@include element(title) {
		margin: 0;
		font-size: 30px;
		font-weight: 600;
		line-height: 1.4;
		color: varfix(foreground-color);
		text-align: center;
	}

	@include element(separator) {
		margin: 0 6px;
	}
}

@media screen and (width <= 768px) {
	@include block(docs-home) {
		@include element(title) {
			font-size: 24px;
		}
	}
}
</style>
