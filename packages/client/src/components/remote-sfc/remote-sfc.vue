<template>
	<div class="docs-remote-sfc">
		<div v-if="error" class="docs-remote-sfc__error">{{ error }}</div>
		<div v-else-if="loading" class="docs-remote-sfc__loading">{{ t('client.common.loading') }}</div>
		<component
			:is="PlaygroundComponent"
			v-else-if="PlaygroundComponent"
			:key="revision"
			:files="files"
			:entry="entry"
			:options="playgroundOptions"
			:locale="locale"
			:styleless="true"
			@navigate="handleNavigate"
		/>
	</div>
</template>
<script setup lang="ts">
import { computed, markRaw, onBeforeUnmount, ref, watch } from 'vue';
import type { Component } from 'vue';
import { useLocale } from '@deot/docs-locale';
import { useRouter } from 'vue-router';
import { Gateway } from '../../modules';
import { createResourceIdentity, resolveResource, resourceIdentityKey } from '../../utils/resolver';
import {
	collectResourceImports,
	getResourceType,
	isSupportedDependency,
	resolveDependencyUrl,
	toLogicalResourceSource
} from '../../utils/resource-graph';
import { getDocsConfig } from '../../utils/runtime';
import type { ResourceContentRecord } from '../../modules';

const props = defineProps<{ source: string; lang: string }>();
const { locale, t } = useLocale();
const router = useRouter();
const config = getDocsConfig();
const loading = ref(true);
const error = ref('');
const files = ref<Record<string, string>>({});
const entry = ref('');
const revision = ref(0);
const PlaygroundComponent = ref<Component | null>(null);
const subscriptions: Array<() => void> = [];
let controller: AbortController | undefined;
let generation = 0;

const playgroundOptions = computed(() => ({
	builtinImportMap: { imports: { ...config.modules } }
}));

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
		const nextFiles: Record<string, string> = {};
		const visited = new Set<string>();
		const activeLoads = new Set<string>();
		const visit = async (url: string, logicalSource?: string) => {
			if (current !== generation || visited.has(url)) return;
			visited.add(url);
			const type = getResourceType(url);
			const source = logicalSource || toLogicalResourceSource(config, langSnapshot, url);
			const identity = createResourceIdentity(config, langSnapshot, type, source);
			const key = resourceIdentityKey(identity);
			// 首次加载成功时，内容订阅通知会早于 load() 返回；忽略这次自身通知，
			// 避免每个依赖都重新启动整张资源图。
			const reload = () => {
				if (!activeLoads.has(key)) void loadFiles();
			};
			subscriptions.push(Gateway.subscribe(identity, reload));
			activeLoads.add(key);
			let record: ResourceContentRecord;
			try {
				record = await Gateway.load(identity, {
					url,
					priority: 100,
					signal: activeController.signal
				});
			} finally {
				activeLoads.delete(key);
			}
			if (current !== generation) return;
			nextFiles[getFilename(url, langSnapshot)] = record.content;
			const imports = await collectResourceImports(record.content, type);
			await Promise.all(imports.filter(isSupportedDependency).map(async (value) => {
				const dependency = resolveDependencyUrl(value, url);
				await visit(dependency);
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
