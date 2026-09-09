<template>
	<footer
		v-if="footer !== false"
		class="docs-footer"
		:data-content-width="contentWidth"
	>
		<div v-if="groups.length" class="docs-footer__inner">
			<div class="docs-footer__content">
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
		</div>
		<div class="docs-footer__bar">
			<div class="docs-footer__bar-inner">
				<a
					v-if="brandExternal"
					class="docs-footer__brand"
					:href="brandValue"
					target="_blank"
					rel="noopener noreferrer"
				>
					<img v-if="brandLogo" class="docs-footer__brand-logo" :src="brandLogo" alt="">
					{{ brandLabel }}
				</a>
				<RouterLink v-else class="docs-footer__brand" :to="brandPath">
					<img v-if="brandLogo" class="docs-footer__brand-logo" :src="brandLogo" alt="">
					{{ brandLabel }}
				</RouterLink>
				<div v-if="poweredBy" class="docs-footer__powered-by">{{ poweredBy }}</div>
			</div>
		</div>
	</footer>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { useLocale } from '@deot/docs-locale';
import { getDocsConfig } from '../../utils/runtime';
import { getDefaultLanguage } from '../../utils/resolver';
import { findLanguageValue } from '../../utils/sidebar';
import { localizePath } from '../../utils/route';
import { isExternalLink } from '../../utils/link';
import { ContentWidth } from '../../modules/settings';
import { sidebarItems } from '../../modules/sidebar';
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
const brandOptions = config.layout?.header?.brand;
/** Home / no-sidebar pages stay on the wide column; docs with a sidebar follow the toggle. */
const contentWidth = computed(() => (
	sidebarItems.value?.length ? ContentWidth.current.value : 'wide'
));

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
const brandLogo = computed(() => resolveLocalized(brandOptions?.logo) || '');
const brandLabel = computed(() => (
	resolveLocalized(brandOptions?.label) || config.namespace || t('client.header.brand')
));
const brandValue = computed(() => resolveLocalized(brandOptions?.value) || `/${lang.value}`);
const brandExternal = computed(() => isExternalLink(brandValue.value));
const brandPath = computed(() => localizePath(config, lang.value, brandValue.value));
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
	align-items: stretch;
	width: 100%;
	font-family: "PingFang SC", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
	font-size: 14px;
	line-height: 28px;
	color: varfix(foreground-color);
	background: transparent;

	&:has(.docs-footer__content) {
		border-top: 1px solid varfix(pattern-fg);
	}

	@include element(inner) {
		width: 100%;
		max-width: 1020px;
		margin: 0 auto;
		border-right: 1px solid varfix(pattern-fg);
		border-left: 1px solid varfix(pattern-fg);
		box-sizing: border-box;
	}

	@include element(content) {
		display: grid;
		width: 100%;
		box-sizing: border-box;
		grid-template-columns: minmax(0, 1fr);
	}

	@include element(group) {
		padding: 32px 24px;
		margin: 0;
		box-sizing: border-box;
	}

	@include element(title) {
		margin: 0;
		font-size: 14px;
		font-weight: 600;
		line-height: 28px;
		color: varfix(foreground-color);
	}

	@include element(links) {
		display: grid;
		gap: 16px;
		padding: 0;
		margin: 16px 0 0;
		list-style: none;

		li {
			margin: 0;
		}

		a,
		span {
			color: varfix(foreground-color);
			text-decoration: none;
		}

		a:hover {
			text-decoration: underline;
		}
	}

	@include element(bar) {
		width: 100%;
		border-top: 1px solid varfix(pattern-fg);
	}

	@include element(bar-inner) {
		display: flex;
		width: 100%;
		max-width: 1020px;
		padding: 40px 8px 96px;
		margin: 0 auto;
		font-size: 14px;
		line-height: 24px;
		box-sizing: border-box;
		flex-wrap: wrap;
		gap: 12px 24px;
		align-items: center;
		justify-content: space-between;
	}

	&[data-content-width='wide'],
	&[data-content-width='full'] {
		.docs-footer__inner,
		.docs-footer__bar-inner {
			max-width: 1200px;
		}
	}

	@include element(brand) {
		display: inline-flex;
		gap: 8px;
		font-size: 14px;
		font-weight: 600;
		line-height: 24px;
		color: varfix(foreground-color);
		text-decoration: none;
		align-items: center;

		&:hover {
			text-decoration: underline;
		}
	}

	@include element(brand-logo) {
		display: block;
		width: auto;
		height: 20px;
		object-fit: contain;
		flex-shrink: 0;
	}

	@include element(powered-by) {
		color: varfix(foreground-color-light);
		text-align: right;
	}
}

@media screen and (width >= 768px) {
	@include block(docs-footer) {
		@include element(content) {
			grid-template-columns: repeat(4, minmax(0, 1fr));
		}

		@include element(group) {
			padding: 40px 8px;

			& + .docs-footer__group {
				border-left: 1px solid varfix(pattern-fg);
			}
		}
	}
}
</style>
