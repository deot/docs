<template>
	<section class="docs-markdown-editor">
		<header class="docs-markdown-editor__toolbar">
			<h1>{{ t('client.markdownEditor.title') }}</h1>
			<button type="button" @click="fileInput?.click()">{{ t('client.markdownEditor.open') }}</button>
			<input ref="fileInput" type="file" accept=".md,.markdown,.txt,text/markdown,text/plain" hidden @change="openFile" />
			<Clipboard tag="button" type="button" :value="text">{{ t('client.markdownEditor.copy') }}</Clipboard>
			<button type="button" :disabled="exporting || loading || Boolean(preview.error) || renderedSource !== text" @click="exportPdf">
				{{ t('client.markdownEditor.pdf') }}
			</button>
			<button type="button" @click="reset">{{ t('client.markdownEditor.reset') }}</button>
			<label><input v-model="syncEnabled" type="checkbox" /> {{ t('client.markdownEditor.sync') }}</label>
			<ThemeToggler />
		</header>
		<p v-if="loading" class="docs-markdown-editor__status" role="status">{{ t('client.common.loading') }}</p>
		<p v-if="preview.error || error || styleError" class="docs-markdown-editor__status" role="alert">
			{{ preview.error || error || styleError }}
		</p>
		<div
			class="docs-markdown-editor__panes"
			:style="{ '--docs-markdown-editor-columns': `minmax(0, ${editorRatio}fr) 8px minmax(0, ${100 - editorRatio}fr)` }"
		>
			<SourceEditor
				:key="documentKey"
				ref="editor"
				:model-value="text"
				:label="t('client.markdownEditor.source')"
				@wheel.capture="scrollSource = 'editor'"
				@pointerdown.capture="scrollSource = 'editor'"
				@keydown.capture="scrollSource = 'editor'"
				@update:model-value="edit"
				@scroll="syncScroll('editor')"
			/>
			<PaneDivider v-model="editorRatio" />
			<Scroller
				ref="previewScroller"
				class="docs-markdown-editor__preview"
				:native="false"
				:wheel="false"
				:auto-resize="true"
				:always="true"
				height="100%"
				@wheel.capture="scrollSource = 'preview'"
				@pointerdown.capture="scrollSource = 'preview'"
				@keydown.capture="scrollSource = 'preview'"
				@scroll="syncScroll('preview')"
			>
				<article ref="article" @load.capture="syncScroll()">
					<Markdown
						:key="documentKey"
						:model-value="previewSource"
						:theme="markdownDefaults.theme"
						:indicator="markdownDefaults.indicator"
						:locale="locale"
						:playground="playgroundDefaults"
						@rendered="onRendered"
					/>
				</article>
			</Scroller>
		</div>
	</section>
</template>
<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { ComponentPublicInstance } from 'vue';
import { useRoute } from 'vue-router';
import { Clipboard, Scroller } from '@deot/vc';
import type { ScrollerExposed } from '@deot/vc';
import { Markdown } from '@deot/docs-markdown';
import { useLocale } from '@deot/docs-locale';
import SourceEditor from './components/source-editor.vue';
import PaneDivider from './components/pane-divider.vue';
import ThemeToggler from '../../components/theme-toggler/index.vue';
import { getDocsConfig } from '../../utils/runtime';
import { createResourceIdentity, getDocsDeploymentBase, getDocsNamespace, resolveResource } from '../../utils/resolver';
import { resolveDocsMarkdownComponent, resolveDocsPlaygroundComponent } from '../../utils/components';
import { Gateway } from '../../modules/gateway';
import { Settings } from '../../modules/settings';
import { readPreviewConfig } from '../../modules/preview/config';
import { acquirePreviewStyles, parsePreviewStyleUrls } from '../../modules/preview/styles';

const SAMPLE = '# Markdown\n\n## Hello\n\nEdit **Markdown** and preview it here.\n\n'
	+ '| Name | Value |\n| --- | --- |\n| Markdown | Live preview |\n\n```js\nconsole.log("Hello Markdown");\n```\n';
const route = useRoute();
const docs = getDocsConfig();
const base = getDocsDeploymentBase(docs);
const namespace = getDocsNamespace(docs);
const { locale, t } = useLocale();
const lang = computed(() => String(route.params.lang || locale.value.name));
const messageOf = (reason: unknown) => reason instanceof Error ? reason.message : String(reason);
const preview = computed(() => {
	try { return { config: readPreviewConfig(route.query), error: '' }; } catch (reason) { return { config: undefined, error: messageOf(reason) }; }
});
const markdownDefaults = computed(() => resolveDocsMarkdownComponent(docs));
const playgroundDefaults = computed(() => {
	const site = resolveDocsPlaygroundComponent(docs);
	const config = preview.value.config;
	return {
		...site,
		...config?.playground,
		options: {
			...site.options,
			builtinImportMap: {
				...site.options?.builtinImportMap,
				imports: { ...site.options?.builtinImportMap?.imports, ...config?.modules }
			}
		}
	};
});
const text = ref(SAMPLE);
const previewSource = ref(SAMPLE);
const renderedSource = ref<string>();
const sourceBase = ref(base);
const documentKey = ref(0);
const loading = ref(false);
const exporting = ref(false);
const error = ref('');
const styleError = ref('');
const syncEnabled = ref(false);
const editorRatio = ref(50);
const fileInput = ref<HTMLInputElement>();
const editor = ref<InstanceType<typeof SourceEditor>>();
const previewScroller = ref<ScrollerExposed & ComponentPublicInstance>();
const article = ref<HTMLElement>();
let initialText = SAMPLE;
let generation = 0;
let previewTimer: ReturnType<typeof setTimeout> | undefined;
let draftTimer: ReturnType<typeof setTimeout> | undefined;
let scrollSource: 'editor' | 'preview' = 'editor';
let sourceLines: number[] = [];
const syncScroll = (side = scrollSource) => {
	// 程序滚动产生的 scroll 事件不能反向回写用户正在操作的一侧。
	if (!syncEnabled.value || side !== scrollSource || renderedSource.value !== text.value) return;
	const panes = {
		editor: { element: editor.value?.getScrollElement(), view: editor.value },
		preview: { element: previewScroller.value?.$el as HTMLElement | undefined, view: previewScroller.value }
	};
	const from = panes[side].element;
	const to = panes[side === 'editor' ? 'preview' : 'editor'];
	if (!from || !to.element) return;
	const end = {
		editor: Math.max(0, panes.editor.element!.scrollHeight - panes.editor.element!.clientHeight),
		preview: Math.max(0, panes.preview.element!.scrollHeight - panes.preview.element!.clientHeight)
	};
	const points = [{ editor: 0, preview: 0 }];
	const content = article.value?.querySelector('.docs-markdown-reset');
	const origin = content?.getBoundingClientRect().top || 0;
	content && [...content.children].forEach((block, index) => {
		const line = sourceLines[index];
		if (!line) return;
		const point = { editor: editor.value!.getLineTop(line), preview: block.getBoundingClientRect().top - origin };
		const previous = points[points.length - 1];
		if (point.editor > previous.editor && point.preview > previous.preview
			&& point.editor < end.editor && point.preview < end.preview) points.push(point);
	});
	points.push(end);
	let index = 1;
	while (index < points.length - 1 && points[index][side] <= from.scrollTop) index++;
	const start = points[index - 1];
	const finish = points[index];
	const progress = (from.scrollTop - start[side]) / (finish[side] - start[side] || 1);
	const other = side === 'editor' ? 'preview' : 'editor';
	const top = start[other] + progress * (finish[other] - start[other]);
	if (Math.abs(to.element.scrollTop - top) <= 1) return;
	to.view?.setScrollTop(top);
};
const saveDraft = () => {
	if (draftTimer === undefined) return;
	clearTimeout(draftTimer);
	draftTimer = undefined;
	void Settings.set(namespace, 'markdown-editor:draft', { text: text.value, base: sourceBase.value }).catch(() => {});
};
const scheduleDraft = () => {
	clearTimeout(draftTimer);
	draftTimer = setTimeout(saveDraft, 300);
};
const replaceDocument = (value: string, resourceBase: string, initial = value) => {
	clearTimeout(previewTimer);
	text.value = previewSource.value = value;
	sourceBase.value = resourceBase;
	initialText = initial;
	documentKey.value++;
	scrollSource = 'editor';
	void nextTick(() => previewScroller.value?.setScrollTop(0));
};
const edit = (value: string) => {
	generation++;
	loading.value = false;
	text.value = value;
	error.value = '';
	clearTimeout(previewTimer);
	previewTimer = setTimeout(() => previewSource.value = text.value, 150);
	scheduleDraft();
};
const load = async () => {
	saveDraft();
	const token = ++generation;
	error.value = '';
	const config = preview.value.config;
	loading.value = Boolean(config);
	if (!config) return;
	try {
		if (config.url) {
			const resolved = await resolveResource(docs, { source: config.url, type: 'markdown', lang: lang.value });
			const url = new URL(resolved, base).href;
			const record = await Gateway.revalidate(createResourceIdentity(docs, lang.value, 'markdown', config.url), { url, priority: 100 });
			if (token === generation) replaceDocument(record.content, url);
		} else {
			const draft = await Settings.get<{ text: string; base: string }>(namespace, 'markdown-editor:draft');
			if (token === generation) replaceDocument(draft?.text ?? SAMPLE, draft?.base || base, SAMPLE);
		}
	} catch (reason) {
		if (token === generation) error.value = messageOf(reason);
	} finally {
		if (token === generation) loading.value = false;
	}
};
const openFile = async (event: Event) => {
	const input = event.target as HTMLInputElement;
	const file = input.files?.[0];
	input.value = '';
	if (!file) return;
	generation++;
	error.value = '';
	loading.value = true;
	replaceDocument(await file.text(), base);
	loading.value = false;
	scheduleDraft();
};
const reset = () => {
	if (text.value !== initialText && !window.confirm(t('client.markdownEditor.confirmReset'))) return;
	generation++;
	loading.value = false;
	error.value = '';
	replaceDocument(initialText, sourceBase.value);
	scheduleDraft();
};
const onRendered = (source: string, lines: number[]) => {
	renderedSource.value = source;
	sourceLines = lines;
	article.value?.querySelectorAll<HTMLImageElement | HTMLAnchorElement>('img[src], a[href]').forEach((node) => {
		const attr = node instanceof HTMLImageElement ? 'src' : 'href';
		const value = node.getAttribute(attr);
		if (!value || value.startsWith('#')) return;
		try { node.setAttribute(attr, new URL(value, sourceBase.value).href); } catch { /* 保留原文中的无效地址。 */ }
	});
	syncScroll();
};
const exportPdf = async () => {
	exporting.value = true;
	await Promise.all([
		document.fonts?.ready,
		...[...(article.value?.querySelectorAll('img') || [])].map(img => img.decode?.().catch(() => {}))
	]);
	window.print();
	exporting.value = false;
};
watch([() => preview.value.config?.url, () => preview.value.error, lang], load, { immediate: true });
watch(() => preview.value.config?.styles, (styles, _, onCleanup) => {
	styleError.value = '';
	try {
		onCleanup(acquirePreviewStyles(parsePreviewStyleUrls(styles, base),
			url => styleError.value = t('client.common.previewStyleFailed', { url })));
	} catch (reason) { styleError.value = messageOf(reason); }
}, { immediate: true });
watch(syncEnabled, (value) => {
	scrollSource = 'editor';
	syncScroll();
	void Settings.set(namespace, 'markdown-editor:sync', value).catch(() => {});
});
watch(editorRatio, () => { void nextTick(() => requestAnimationFrame(() => syncScroll())); });
onMounted(() => {
	void Settings.get<boolean>(namespace, 'markdown-editor:sync').then(value => syncEnabled.value = value ?? false).catch(() => {});
});
onBeforeUnmount(() => {
	generation++;
	saveDraft();
	clearTimeout(previewTimer);
});
</script>
<style lang="scss" src="./style.scss"></style>
