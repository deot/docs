<template>
	<div class="docs-remote-sfc" :class="{ 'docs-remote-sfc--viewport': useIframeViewport }">
		<div v-if="error" class="docs-remote-sfc__error">{{ error }}</div>
		<div v-else-if="loading" class="docs-remote-sfc__loading">{{ t('client.common.loading') }}</div>
		<component
			:is="PlaygroundComponent"
			v-else-if="PlaygroundComponent"
			:key="`${revision}:${playgroundProps.local}`"
			v-bind="playgroundProps"
			@navigate="handleNavigate"
		/>
	</div>
</template>
<script setup lang="ts">
import { computed, inject, markRaw, onBeforeUnmount, ref, watch } from 'vue';
import type { Component } from 'vue';
import { useLocale } from '@deot/docs-locale';
import { useRouter } from 'vue-router';
import { Gateway } from '../../modules/gateway';
import { resolveDocsPlaygroundComponent } from '../../utils/components';
import { createResourceIdentity, resolveResource, resourceIdentityKey } from '../../utils/resolver';
import {
	collectResourceImports,
	collectResourceStyleImports,
	dependencyUrlCandidates,
	resolveDependencyRequestUrl,
	getResourceType,
	isSupportedDependency,
	toLogicalResourceSource
} from '../../utils/resource-graph';
import { createGithubSourceResolver, rewritePackageStyleImports } from '../../utils/github-source';
import { assertResolvableSourceGlobs } from '../../utils/source-dependencies';
import { getDocsConfig } from '../../utils/runtime';
import { previewConfigKey } from '../../modules/preview/config';
import { parsePreviewStyleUrls } from '../../modules/preview/styles';
import { ResourceRequestError } from '../../modules/gateway/types';
import type { ResourceContentRecord } from '../../modules/gateway';

const props = defineProps<{ source: string; lang: string }>();
const { locale, t } = useLocale();
const router = useRouter();
const config = getDocsConfig();
const preview = inject(previewConfigKey, undefined);
const loading = ref(true);
const error = ref('');
const files = ref<Record<string, string>>({});
const entry = ref('');
const revision = ref(0);
const PlaygroundComponent = ref<Component | null>(null);
const subscriptions: Array<() => void> = [];
let controller: AbortController | undefined;
let generation = 0;

const playgroundDefaults = computed(() => resolveDocsPlaygroundComponent(config));
const previewModules = computed(() => JSON.stringify(preview?.value?.modules || {}));
const previewPlayground = computed(() => JSON.stringify(preview?.value?.playground || {}));
// 样式变化不创建新的 options 引用，避免触发 local 预览重新编译。
const playgroundOptions = computed(() => {
	const siteOptions = playgroundDefaults.value.options || {};
	const siteImportMap = siteOptions.builtinImportMap || {};
	return {
		...siteOptions,
		builtinImportMap: {
			...siteImportMap,
			imports: {
				...siteImportMap.imports,
				...config.modules,
				...JSON.parse(previewModules.value)
			}
		}
	};
});
const playgroundProps = computed(() => {
	const site = playgroundDefaults.value;
	const overrides = JSON.parse(previewPlayground.value);
	return {
		...site,
		files: files.value,
		entry: entry.value,
		locale: locale.value,
		styleless: true,
		...overrides,
		local: overrides.local ?? site.local ?? true,
		...(previewStyleHead.value
			? { previewOptions: {
					...site.previewOptions,
					headHTML: `${site.previewOptions?.headHTML || ''}${previewStyleHead.value}`
				} }
			: {}),
		options: playgroundOptions.value
	};
});
const useIframeViewport = computed(() => (
	!!preview?.value && !playgroundProps.value.local && playgroundProps.value.styleless
	&& !Array.isArray(playgroundProps.value.viewport)
));

// iframe 模式也接收同一份链接 CSS；local 模式由外层样式引用管理器注入。
const previewStyleHead = computed(() => {
	try {
		return parsePreviewStyleUrls(preview?.value?.styles, location.href)
			.map(url => `<link rel="stylesheet" href="${url.replaceAll('&', '&amp;').replaceAll('"', '&quot;')}">`).join('');
	} catch {
		return '';
	}
});

const clearSubscriptions = () => {
	while (subscriptions.length) subscriptions.pop()?.();
};

const getFilename = (url: string, lang: string) => {
	const pathname = decodeURIComponent(new URL(url, location.href).pathname);
	const marker = `/${lang}/`;
	const index = pathname.indexOf(marker);
	return (index >= 0 ? pathname.slice(index + marker.length) : pathname.replace(/^\/+/, ''));
};

/**
 * 加载一份完整源码依赖图。generation token 用于阻止过期结果提交；
 * 路由变化或插槽卸载时，controller 同时取消所有未完成的依赖请求。
 */
const loadFiles = async () => {
	const current = ++generation;
	controller?.abort();
	const activeController = new AbortController();
	controller = activeController;
	const sourceSnapshot = props.source;
	const langSnapshot = props.lang;
	loading.value = true;
	error.value = '';
	clearSubscriptions();
	try {
		const rootUrl = await resolveResource(config, {
			source: sourceSnapshot,
			type: 'sfc',
			lang: langSnapshot
		});
		if (current !== generation || activeController.signal.aborted) return;
		const github = createGithubSourceResolver(rootUrl, activeController.signal);
		const nextFiles: Record<string, string> = {};
		const visited = new Set<string>();
		const activeLoads = new Set<string>();
		const visit = async (url: string, logicalSource?: string) => {
			if (current !== generation || visited.has(url)) return;

			const type = getResourceType(url);
			const source = logicalSource || toLogicalResourceSource(config, langSnapshot, url);
			const identity = createResourceIdentity(config, langSnapshot, type, source);
			const key = resourceIdentityKey(identity);
			// 首次加载成功时，内容订阅通知会早于 load() 返回；忽略这次自身通知，
			// 避免每个依赖都重新启动整张资源图。
			const reload = () => {
				if (!activeLoads.has(key)) void loadFiles();
			};

			activeLoads.add(key);
			let record: ResourceContentRecord;
			try {
				record = await Gateway.load(identity, {
					url: resolveDependencyRequestUrl(url),
					priority: 100,
					signal: activeController.signal
				});
			} finally {
				activeLoads.delete(key);
			}
			if (current !== generation) return;
			visited.add(url);
			subscriptions.push(Gateway.subscribe(identity, reload));
			let content = github && type === 'module' ? await github.expandGlob(record.content, url) : record.content;
			if (!github && type !== 'style') assertResolvableSourceGlobs(content, url);
			if (github && type === 'style') content = rewritePackageStyleImports(content);
			nextFiles[getFilename(url, langSnapshot)] = content;
			const imports = /\.json(?:$|[?#])/i.test(url) ? [] : await collectResourceImports(content, type);
			const styles = collectResourceStyleImports(content, type);
			await Promise.all(imports.filter(isSupportedDependency).map(async (value) => {
				const style = styles.includes(value) || /\.(?:scss|sass)(?:$|[?#])/i.test(value);
				const candidates = github
					? await github.resolve(value, url, style)
					: dependencyUrlCandidates(value, url, style);
				if (candidates.some(dependency => visited.has(dependency))) return;
				for (const [index, dependency] of candidates.entries()) {
					try {
						await visit(dependency);
						break;
					} catch (reason) {
						if (
							visited.has(dependency) || !(reason instanceof ResourceRequestError)
							|| reason.status !== 404 || index === candidates.length - 1
						) throw reason;
					}
				}
			}));
		};
		await visit(rootUrl, sourceSnapshot);
		if (current !== generation) return;
		let component = PlaygroundComponent.value;
		if (!PlaygroundComponent.value) {
			const module = await import('@deot/docs-playground');
			component = markRaw(module.Playground);
		}
		if (current !== generation || activeController.signal.aborted) return;
		files.value = nextFiles;
		entry.value = getFilename(rootUrl, langSnapshot);
		PlaygroundComponent.value = component;
		revision.value += 1;
	} catch (reason) {
		activeController.abort();
		if (current === generation && controller === activeController) {
			error.value = reason instanceof Error ? reason.message : t('client.common.resourceRequestFailed');
		}
	} finally {
		// 缓存加载返回后可能仍有静默刷新，因此在下一张资源图替换它或组件
		// 卸载之前，需要持续保留当前图的 signal。
		if (current === generation) loading.value = false;
	}
};

const handleNavigate = (to: string) => {
	if (/^[a-z][a-z\d+.-]*:/i.test(to) || to.startsWith('//')) {
		location.href = to;
		return;
	}
	const languages = Object.keys(config.locales)
		.map(value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
	const languagePattern = new RegExp(`^/(?:${languages.join('|')})(?:/|$)`);
	void router.push(languagePattern.test(to) ? to : `/${props.lang}/${to.replace(/^\/+/, '')}`);
};

watch(() => [props.source, props.lang], loadFiles, { immediate: true });
onBeforeUnmount(() => {
	generation += 1;
	controller?.abort();
	controller = undefined;
	clearSubscriptions();
});
</script>
<style lang="scss">
@use '../../styles/bem' as *;

@include block(docs-remote-sfc) {
	@include modifier(viewport) {
		// 独立预览由 iframe 内部滚动，sticky / vh 才能相对真实视口生效。
		.docs-playground-runtime--styleless {
			height: 100dvh !important;
		}
	}

	@include element(loading) {
		padding: 16px;
		color: varfix(foreground-color-mute);
	}

	@include element(error) {
		padding: 16px;
		color: var(--vc-color-error);
	}
}
</style>
