<template>
	<header class="docs-header">
		<RouterLink class="docs-header__brand" :to="`/${lang}`">
			{{ t('client.header.brand') }}
		</RouterLink>
		<div class="docs-header__search"><DocsSearch /></div>
		<div class="docs-header__actions">
			<ThemeToggler class="docs-header__theme" />
			<nav v-if="localeOptions.length > 1" class="docs-header__locales">
				<Dropdown
					v-model="localeMenuVisible"
					class="docs-header__locale-dropdown"
					portal-class="docs-header__locale-portal"
					trigger="hover"
					placement="bottom-right"
				>
					<button
						type="button"
						class="docs-header__action docs-header__locale-trigger"
						:title="t('client.header.language')"
						:aria-label="t('client.header.language')"
						:aria-expanded="localeMenuVisible"
						aria-haspopup="menu"
					>
						<ClientIcon name="language" />
					</button>
					<template #content>
						<DropdownMenu
							class="docs-header__locale-options"
							role="menu"
							:aria-label="t('client.header.language')"
						>
							<DropdownItem
								v-for="item in localeOptions"
								:key="item.value"
								class="docs-header__locale-option"
								:value="item.value"
								:selected="item.value === lang"
								role="menuitemradio"
								:aria-checked="item.value === lang"
								@click="handleLocale"
							>
								{{ item.label }}
							</DropdownItem>
						</DropdownMenu>
					</template>
				</Dropdown>
			</nav>
			<button
				type="button"
				class="docs-header__action docs-header__editor"
				:title="t('client.header.editor')"
				:aria-label="t('client.header.editor')"
				@click="handleEditor"
			>
				<ClientIcon name="editor" />
			</button>
			<RouterLink
				class="docs-header__action docs-header__playground-resource"
				:to="playgroundResourcePath"
				:title="t('client.header.playgroundResource')"
				:aria-label="t('client.header.playgroundResource')"
			>
				<ClientIcon name="playgroundResource" />
			</RouterLink>
			<RouterLink
				class="docs-header__action docs-header__database"
				:to="databasePath"
				:title="t('client.header.database')"
				:aria-label="t('client.header.database')"
			>
				<ClientIcon name="database" />
			</RouterLink>
		</div>
	</header>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue';
import { Dropdown, DropdownItem, DropdownMenu } from '@deot/vc';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { useLocale } from '@deot/docs-locale';
import DocsSearch from '../search';
import ThemeToggler from '../theme-toggler';
import ClientIcon from '../icon';
import { getDocsConfig } from '../../utils/runtime';
import { getRouteValue } from '../../utils/route';
import { stashInlineRendererDocument } from '../../pages/renderer-editor/inline';
import type { DocsRoute, DocsContent } from '../../types';

const route = useRoute();
const router = useRouter();
const config = getDocsConfig();
const { t } = useLocale();
const localeMenuVisible = ref(false);
const lang = computed(() => String(route.params.lang));
const databasePath = computed(() => `/${lang.value}/__docs/database`);
const playgroundResourcePath = computed(() => `/${lang.value}/__docs/playground-resource`);
const localeOptions = computed(() => Object.entries(config.locales).map(([value, item]) => ({
	label: item.label,
	value
})));
const localePath = (locale: string) => {
	const segments = route.path.split('/').filter(Boolean);
	segments[0] = locale;
	return {
		path: `/${segments.join('/')}`,
		query: route.query,
		hash: route.hash
	};
};
const handleLocale = (locale: string | number) => {
	localeMenuVisible.value = false;
	const target = String(locale);
	if (target !== lang.value) void router.push(localePath(target));
};
const isInlineRendererDocument = (value: DocsContent | undefined) => (
	Boolean(value && typeof value === 'object' && 'schemaVersion' in value)
);
const handleEditor = async () => {
	const routeConfig = route.meta.docsRoute as DocsRoute | undefined;
	let source: DocsContent | undefined = routeConfig?.content;
	let type = route.meta.docsHome ? 'home' : '';
	if (route.meta.docsHome) {
		const configured = config.home?.locales?.[lang.value]
			|| config.home?.locales?.['en-US'];
		if (typeof configured === 'string') {
			source = configured;
			type = 'page';
		}
	}
	if (!route.meta.docsHome && isInlineRendererDocument(source)) {
		stashInlineRendererDocument(route.fullPath, source);
		await router.push({
			path: `/${lang.value}/__docs/renderer-editor`,
			query: {
				from: route.fullPath,
				type: 'inline'
			}
		});
		return;
	}
	if (source === 'default' && routeConfig) {
		source = await config.resolve?.markdown?.({
			lang: lang.value,
			value: getRouteValue(route, routeConfig),
			route
		}) || `./${getRouteValue(route, routeConfig)}.md`;
	}
	if (typeof source === 'string') {
		type = /\.page\.json(?:$|[?#])/i.test(source)
			? 'page'
			: /\.vue(?:$|[?#])/i.test(source) ? 'sfc' : 'markdown';
	}
	await router.push({
		path: `/${lang.value}/__docs/renderer-editor`,
		query: {
			from: route.fullPath,
			type,
			...(typeof source === 'string' ? { source } : {})
		}
	});
};
</script>
<style lang="scss">
@use '../../styles/bem' as *;

@include block(docs-header) {
	display: grid;
	grid-template-columns: minmax(160px, 1fr) minmax(180px, 320px) auto;
	column-gap: 8px;
	width: 100%;
	height: 60px;
	padding: 0 30px;
	color: varfix(foreground-color-light);
	background: varfix(background-color);
	align-items: center;

	@include element(brand) {
		display: grid;
		height: 60px;
		font-size: 16px;
		font-weight: 600;
		align-items: center;
	}

	@include element(locales) {
		display: inline-flex;
		align-items: center;
	}

	@include element(locale-dropdown) {
		display: inline-flex;
	}

	@include element(actions) {
		display: grid;
		grid-auto-flow: column;
		grid-auto-columns: max-content;
		align-items: center;
		justify-self: end;
		gap: 4px;
	}

	@include element(action) {
		display: inline-flex;
		width: 36px;
		height: 36px;
		padding: 0;
		font: inherit;
		color: varfix(foreground-color-light);
		cursor: pointer;
		background: transparent;
		border: 0;
		border-radius: 8px;
		align-items: center;
		justify-content: center;
		transition: color 0.2s ease, background-color 0.2s ease;

		&:hover,
		&:focus-visible {
			color: varfix(primary-color);
			background: varfix(primary-color-light);
		}

	}

	@include element(locale-trigger) {
		.docs-client-icon {
			width: 24px;
			height: 24px;
		}
	}

	@include element(editor) {
		.docs-client-icon {
			width: 22px;
			height: 22px;
		}
	}

	@include element(playground-resource) {
		.docs-client-icon {
			width: 22px;
			height: 22px;
		}
	}

	@include element(database) {
		.docs-client-icon {
			width: 21px;
			height: 21px;
		}
	}

	@include element(search) {
		display: grid;
		min-width: 0;
		justify-items: end;
	}

}

@include block(docs-header) {
	@include element(locale-options) {
		min-width: 150px;
		padding: 6px 0;
	}

	@include element(locale-option) {
		padding: 9px 18px;
		font-size: 14px !important;
		line-height: 22px;

		&.is-selected {
			color: var(--vc-color-primary);
			background: var(--vc-color-primary-lighter);
		}
	}
}

@media screen and (width <= 768px) {
	@include block(docs-header) {
		grid-template-columns: minmax(0, 1fr) 34px auto;
		column-gap: 4px;
		padding: 0 12px;

		@include element(brand) {
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}

		@include element(action) {
			width: 32px;
			height: 32px;
		}
	}

	.docs-app:has(.docs-layout__sidebar .docs-sidebar) .docs-header {
		padding-left: 56px;
	}
}

@media screen and (width <= 480px) {
	@include block(docs-header) {
		@include element(editor) { display: none; }

		@include element(playground-resource) { display: none; }

		@include element(database) { display: none; }
	}
}
</style>
