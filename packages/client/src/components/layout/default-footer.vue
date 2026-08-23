<template>
	<footer v-if="footer !== false" class="docs-footer">
		<div v-if="groups.length" class="docs-footer__content">
			<section v-for="group in groups" :key="group.label" class="docs-footer__group">
				<h2 class="docs-footer__title">{{ group.label }}</h2>
				<ul v-if="group.children?.length" class="docs-footer__links">
					<li v-for="item in group.children" :key="`${item.label}:${item.value || ''}`">
						<a
							v-if="item.value && isExternal(item.value)"
							:href="item.value"
							target="_blank"
							rel="noopener noreferrer"
						>{{ item.label }}</a>
						<RouterLink v-else-if="item.value" :to="toPath(item.value)">
							{{ item.label }}
						</RouterLink>
						<span v-else>{{ item.label }}</span>
					</li>
				</ul>
			</section>
		</div>
		<div v-if="poweredBy" class="docs-footer__powered-by">{{ poweredBy }}</div>
	</footer>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { useLocale } from '@deot/docs-locale';
import { getDocsConfig } from '../../utils/runtime';
import { getDefaultLanguage } from '../../utils/resolver';
import { findLanguageValue } from '../../utils/sidebar';
import type {
	DocsFooterOptions,
	DocsFooterPoweredBy,
	DocsLocalized,
	SidebarItem
} from '../../types';

const { lang, t } = useLocale();
const route = useRoute();
const config = getDocsConfig();
const footer = config.layout?.footer;

const normalizeRepository = (value?: string) => {
	if (!value) return;
	try {
		const url = new URL(value);
		if (!['http:', 'https:'].includes(url.protocol) || url.hostname.toLowerCase() !== 'github.com') {
			return;
		}
		const [owner, rawRepository, ...rest] = url.pathname.split('/').filter(Boolean);
		const repository = rawRepository?.replace(/\.git$/i, '');
		if (!owner || !repository || rest.length) return;
		return `${url.origin}/${owner}/${repository}`;
	} catch {
		return;
	}
};
const repository = normalizeRepository(config.repository);
const createDefaultGroups = (): SidebarItem[] => {
	const result: SidebarItem[] = [{
		label: t('client.footer.resources'),
		children: [
			{ label: t('client.footer.vueComponents'), value: 'https://deot.github.io/vc/' },
			{ label: t('client.footer.http'), value: 'https://deot.github.io/http/' },
			{ label: t('client.footer.style'), value: 'https://deot.github.io/style/' },
			{ label: t('client.footer.helper'), value: 'https://deot.github.io/helper/' },
			{ label: t('client.footer.env'), value: 'https://deot.github.io/env/' },
			{ label: t('client.footer.uni'), value: 'https://deot.github.io/uni/' }
		]
	}, {
		label: t('client.footer.community'),
		children: [{ label: t('client.footer.github'), value: 'https://github.com' }]
	}];
	if (repository) {
		result.push({
			label: t('client.footer.feedback'),
			children: [
				{ label: t('client.footer.reportIssue'), value: `${repository}/issues` },
				{ label: t('client.footer.requestFeature'), value: `${repository}/issues/new` },
				{ label: t('client.footer.changelog'), value: `${repository}/releases` }
			]
		});
	}
	result.push({
		label: t('client.footer.more'),
		children: [{ label: t('client.footer.moreResources'), value: 'https://github.com/deot' }]
	});
	return result;
};

const options = computed<DocsFooterOptions | undefined>(() => (
	footer && footer !== 'default' ? footer : undefined
));
/**
 * 从固定值或语言映射中选择当前 Footer 配置。
 * @param value 固定配置或按语言声明的配置。
 * @returns 当前语言、站点默认语言或空值。
 */
function resolveLocalized<T>(value?: DocsLocalized<T>): T | undefined {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return value as T | undefined;
	return findLanguageValue(value as Record<string, T>, lang.value)
		?? findLanguageValue(value as Record<string, T>, getDefaultLanguage(config));
}
const groups = computed(() => options.value
	? resolveLocalized(options.value.nav) || []
	: createDefaultGroups()
);
const poweredBy = computed(() => {
	const value = options.value
		? resolveLocalized<DocsFooterPoweredBy>(options.value.poweredBy)
		: 'default';
	if (value === 'default') {
		return t('client.common.poweredBy');
	}
	return value || '';
});
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

@include block(docs-footer) {
	display: flex;
	flex-direction: column;
	align-items: center;
	font-family: "PingFang SC", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
	font-size: 14px;
	line-height: 1.5;
	color: #fff;
	background: varfix(footer-background);

	@include element(content) {
		display: flex;
		flex-wrap: wrap;
		width: 100%;
		max-width: 1180px;
		padding: 100px 50px 70px;
	}

	@include element(group) {
		flex: 2 1 0;
		margin: 0;
	}

	@include element(title) {
		margin: 15px 0 0;
		font-size: 16px;
		font-weight: 400;
		opacity: .5;
	}

	@include element(links) {
		display: grid;
		padding: 0;
		margin: 30px 0 0;
		list-style: none;

		li {
			width: 200px;
			margin: 6px 0;
		}

		a {
			color: inherit;
			text-decoration: none;

			&:hover { color: varfix(link-color); }
		}
	}

	@include element(powered-by) {
		width: calc(100% - 100px);
		padding: 16px 40px;
		color: varfix(footer-foreground);
		text-align: center;
		border-top: 1px solid #666;
	}
}

@media screen and (width <= 768px) {
	@include block(docs-footer) {
		@include element(content) {
			gap: 32px 24px;
			padding: 48px 24px 36px;
		}

		@include element(group) { flex: 1 1 140px; }

		@include element(links) {
			li { width: auto; }
		}

		@include element(powered-by) {
			width: calc(100% - 48px);
			padding: 16px 0;
		}
	}
}

@media screen and (width <= 480px) {
	@include block(docs-footer) {
		@include element(content) {
			display: grid;
			grid-template-columns: minmax(0, 1fr);
			gap: 24px;
			padding: 36px 20px 28px;
		}

		@include element(title) { margin-top: 0; }

		@include element(links) { margin-top: 16px; }

		@include element(powered-by) {
			width: calc(100% - 40px);
		}
	}
}
</style>
