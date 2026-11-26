<template>
	<div
		ref="containerEl"
		class="docs-playground-local"
		:class="{ 'docs-playground-local--contained': mobile }"
	>
		<iframe
			ref="bridgeEl"
			class="docs-playground-local__bridge"
			tabindex="-1"
			aria-hidden="true"
			title=""
			:srcdoc="bridgeSrcdoc"
			@load="handleBridgeLoad"
		/>
		<div
			ref="mountEl"
			class="docs-playground-local__mount"
			:class="{ 'docs-playground-local__mount--auto': autoHeight }"
			:style="rootStyle"
			v-bind="styleScopeAttrs"
		/>
		<div
			v-if="mobile"
			ref="overlayEl"
			class="docs-playground-local__overlay"
			:style="rootStyle"
			v-bind="styleScopeAttrs"
		/>
	</div>
</template>
<script setup lang="ts">
import {
	nextTick,
	onBeforeUnmount,
	onMounted,
	ref,
	shallowRef,
	watch
} from 'vue';
import type { App, Component } from 'vue';
import * as Vue from 'vue';
import * as VueRouter from 'vue-router';
import type {
	PlaygroundFiles,
	PlaygroundOptions,
	PlaygroundOverlayOptions,
	PlaygroundPreviewScroller
} from '../../../types';
import { markPreviewActive, trackPreviewActivity } from './activity';
import { createPreviewOverlay } from './overlay';
import type { PreviewOverlayController } from './overlay';
import { createLocalPlayground } from './playground';
import { createRuntimeImports, createRuntimeImportOverrides } from '../../store';
import { acquireRuntimeStyles, createRuntimeStyleUrls } from '../../styles';
import { PREVIEW_SCROLL_CONTENT_CLASS } from '../../preview-scroll';
import {
	installLocalBridge,
	LOCAL_BRIDGE_SRCDOC,
	LocalPreviewPort
} from './port';
import { injectStyle, removeStyle } from './compile/css';
import { PREVIEW_STYLE_SCOPE_ATTR } from './compile/style-scope';
import { formatPlaygroundRuntimeError } from './format-error';
import { linkPlayground } from './linker';
import { loadLocalModules } from './modules';
import { createRemoteLoader } from './remote';
import { collectBareSpecifiers, collectReachableFilenames } from './compile/files';

const props = withDefaults(defineProps<{
	files: PlaygroundFiles;
	entry: string;
	options: PlaygroundOptions;
	previewScroller?: PlaygroundPreviewScroller;
	clearConsole?: boolean;
	autoHeight?: boolean;
	/**
	 * 写到挂载根上的 CSS 变量。只影响当前预览。
	 */
	rootStyle?: Record<string, string>;
	/**
	 * 移动端分栏：预览区成为 fixed 的包含块，并提供弹层挂载节点。
	 */
	mobile?: boolean;
	/**
	 * 站点弹层适配器，只在 `mobile` 时使用。
	 */
	overlay?: PlaygroundOverlayOptions;
}>(), {
	previewScroller: false,
	clearConsole: false,
	autoHeight: false,
	mobile: false
});

const emit = defineEmits<{
	error: [payload: { compile: string; runtime: string }];
}>();

const bridgeSrcdoc = LOCAL_BRIDGE_SRCDOC;
const containerEl = ref<HTMLElement | null>(null);
const bridgeEl = ref<HTMLIFrameElement | null>(null);
const mountEl = ref<HTMLElement | null>(null);
const overlayEl = ref<HTMLElement | null>(null);
let overlayController: PreviewOverlayController | null = null;
let stopActivity: (() => void) | undefined;
const compileError = ref('');
const runtimeError = ref('');
const messageSource = shallowRef<Window | null>(null);
let port: LocalPreviewPort | null = null;
let previewApp: App<Element> | null = null;
let releaseStyles: (() => void) | undefined;
let version = 0;
let pendingMount: {
	component: Component;
	vue: typeof Vue;
	scroller?: Component;
	css: string[];
	version: number;
} | null = null;
const styleId = `docs-local-${Math.random().toString(36).slice(2, 10)}`;
const styleScopeAttrs = { [PREVIEW_STYLE_SCOPE_ATTR]: styleId };

const reportOverlayError = (error: unknown) => {
	const message = formatPlaygroundRuntimeError(error);
	runtimeError.value = `[Playground] overlay.setup: ${message || String(error)}`;
};

/** 移动端分栏才创建弹层控制器；切换布局时重建。 */
const syncOverlay = () => {
	const element = props.mobile ? overlayEl.value : null;
	if (overlayController && !element) {
		overlayController.teardown();
		overlayController.dispose();
		overlayController = null;
	}
	stopActivity?.();
	stopActivity = undefined;
	if (!element || !containerEl.value) return;
	overlayController ??= createPreviewOverlay({
		scope: styleId,
		element,
		adapter: props.overlay,
		onError: reportOverlayError
	});
	overlayController.updateVars(props.rootStyle);
	stopActivity = trackPreviewActivity(styleId, containerEl.value);
};

const publishError = () => {
	emit('error', {
		compile: compileError.value,
		runtime: runtimeError.value
	});
};

watch([compileError, runtimeError], publishError);

const createDocsLink = (preview: LocalPreviewPort, vue: typeof Vue) => vue.defineComponent({
	name: 'DocsLink',
	props: {
		to: { type: String, default: '' }
	},
	setup(linkProps, { slots }) {
		return () => vue.h('a', {
			href: linkProps.to,
			style: { color: 'inherit', textDecoration: 'none' },
			onClick(event: MouseEvent) {
				event.preventDefault();
				preview.parent.postMessage({ action: 'docs:navigate', to: linkProps.to });
			}
		}, slots.default?.());
	}
});

const destroyPreview = () => {
	previewApp?.unmount();
	previewApp = null;
	removeStyle(styleId);
};

/** 撤销适配器并清空弹层，每次重新运行和卸载时调用。 */
const teardownOverlay = () => {
	overlayController?.teardown();
};

const mountPreview = (job: NonNullable<typeof pendingMount>, preview: LocalPreviewPort) => {
	if (!mountEl.value) return;
	const { component, vue, scroller, css } = job;
	destroyPreview();
	injectStyle(styleId, css);
	if (props.clearConsole) console.clear();
	const app = vue.createApp({
		name: 'LocalSandboxRoot',
		setup() {
			const service = createLocalPlayground(vue, { overlay: props.mobile ? overlayEl.value : null });
			vue.provide('docs:playground', service);
			vue.onErrorCaptured((error) => {
				const message = formatPlaygroundRuntimeError(error);
				if (message) runtimeError.value = message;
				return false;
			});
			vue.onBeforeUnmount(() => service.dispose());
			return () => {
				const content = vue.h(component);
				if (!scroller) return content;
				return vue.h(scroller, {
					height: '100%',
					native: false,
					autoResize: true,
					showBar: true,
					contentClass: PREVIEW_SCROLL_CONTENT_CLASS
				}, { default: () => content });
			};
		}
	});
	app.component('DocsLink', createDocsLink(preview, vue));
	app.config.errorHandler = (error) => {
		const message = formatPlaygroundRuntimeError(error);
		if (message) runtimeError.value = message;
	};
	// 挂载时同步追加到 body 的节点也算本预览的。
	if (overlayController) markPreviewActive(styleId);
	app.mount(mountEl.value);
	previewApp = app;
};

const ensurePort = () => {
	const iframe = bridgeEl.value;
	if (!iframe?.contentWindow) return null;
	try {
		if (!installLocalBridge(iframe)) return null;
	} catch {
		return null;
	}
	port ??= new LocalPreviewPort(iframe);
	messageSource.value = iframe.contentWindow;
	return port;
};

const tryMount = async () => {
	const job = pendingMount;
	/* istanbul ignore if -- 桥接 iframe 尚未就绪或编译已被取代 */
	if (!job || job.version !== version) return;
	const preview = ensurePort();
	/* istanbul ignore if -- 挂载点在编译完成时已经存在 */
	if (!preview || !mountEl.value) return;
	await nextTick();
	/* istanbul ignore if -- 桥接 iframe 尚未就绪或编译已被取代 */
	if (pendingMount !== job || !mountEl.value) return;
	pendingMount = null;
	mountPreview(job, preview);
};

const run = async () => {
	const current = ++version;
	pendingMount = null;
	compileError.value = '';
	runtimeError.value = '';
	publishError();
	destroyPreview();
	teardownOverlay();
	try {
		const release = acquireRuntimeStyles(createRuntimeStyleUrls(props.options.cdnURL));
		releaseStyles?.();
		releaseStyles = release;
		const { compilePlayground } = await import('./compile');
		/* istanbul ignore if -- 并发编译时只保留最后一次 */
		if (current !== version) return;
		const compiled = await compilePlayground(props.files, {
			entry: props.entry,
			styleScope: styleId
		});
		// 后到的编译结果直接丢弃，避免旧任务覆盖新预览。
		/* istanbul ignore if -- 并发编译时只保留最后一次 */
		if (current !== version) return;
		if (compiled.errors.length || !compiled.entry) {
			compileError.value = compiled.errors.join('\n') || '[Playground] 未能确定入口';
			publishError();
			return;
		}
		const imports = createRuntimeImports(props.options.cdnURL, props.options.builtinImportMap);
		const overrides = new Set(Object.keys(createRuntimeImportOverrides(props.options.builtinImportMap)));
		const specifiers = collectBareSpecifiers(
			props.files,
			collectReachableFilenames(props.files, compiled.entry),
			false
		);
		specifiers.push('vue');
		if (props.previewScroller === true) specifiers.push('@deot/vc');
		const remote = createRemoteLoader(
			imports,
			{ vue: Vue, vueRouter: VueRouter },
			overrides,
			props.options.cdnURL
		);
		const loaded = await loadLocalModules(
			specifiers,
			imports,
			{ vue: Vue, vueRouter: VueRouter },
			url => remote.load(url),
			overrides
		);
		/* istanbul ignore if -- 并发编译时只保留最后一次 */
		if (current !== version) return;
		if (loaded.errors.length) {
			compileError.value = loaded.errors.join('\n');
			publishError();
			return;
		}
		// 外部模块已经执行，示例代码还没执行：此时配置的弹层节点对顶层代码和事件回调都生效。
		overlayController?.setup(loaded.modules);
		const linked = linkPlayground(compiled, props.files, { modules: loaded.modules, loadModule: remote.loadModule });
		/* istanbul ignore if -- 并发编译时只保留最后一次 */
		if (current !== version) return;
		if (linked.errors.length || !linked.component) {
			compileError.value = (linked.errors.length
				? linked.errors
				: ['[Playground] 未能解析入口组件']).join('\n');
			publishError();
			return;
		}
		pendingMount = {
			component: linked.component as Component,
			vue: loaded.modules.vue as typeof Vue,
			scroller: props.previewScroller === true
				? (loaded.modules['@deot/vc'] as { Scroller?: Component }).Scroller
				: undefined,
			css: linked.css,
			version: current
		};
		await tryMount();
	} catch (error: unknown) {
		/* istanbul ignore next -- 编译器自身异常才进入，普通错误走结果里的 errors */
		if (current !== version) return;
		/* istanbul ignore next -- 同上，只兜底编译器抛错 */
		compileError.value = error instanceof Error ? error.message : String(error);
		/* istanbul ignore next -- 同上，只兜底编译器抛错 */
		publishError();
	}
};

const handleBridgeLoad = () => {
	void tryMount();
};

onMounted(() => {
	syncOverlay();
	void run();
});

watch(() => props.rootStyle, value => overlayController?.updateVars(value));
watch(() => [props.mobile, props.overlay] as const, async () => {
	await nextTick();
	overlayController?.teardown();
	overlayController?.dispose();
	overlayController = null;
	syncOverlay();
	if (containerEl.value) void run();
});

watch(
	() => [props.files, props.entry, props.options, props.previewScroller] as const,
	() => {
		if (!containerEl.value) return;
		void run();
	},
	{ deep: true }
);

onBeforeUnmount(() => {
	version += 1;
	pendingMount = null;
	destroyPreview();
	teardownOverlay();
	overlayController?.dispose();
	overlayController = null;
	stopActivity?.();
	releaseStyles?.();
});

defineExpose({
	container: containerEl,
	overlay: overlayEl,
	messageSource,
	local: true,
	refresh: () => {
		void run();
	}
});
</script>
<style lang="scss">
@use '../../../style' as *;

@include block(docs-playground-local) {
	position: relative;
	width: 100%;
	height: 100%;
	min-width: 0;
	min-height: 0;

	@include element(bridge) {
		position: absolute;
		width: 100%;
		height: 100%;
		pointer-events: none;
		border: 0;
		opacity: 0;
		inset: 0;
	}

	@include element(mount) {
		// 不设 z-index：同页 Modal（1002）必须升到页面层叠，不能被预览根截住。
		// 桥接 iframe 在前，挂载点在后，无需再抬一层。
		position: relative;
		width: 100%;
		height: 100%;
		min-width: 0;
		min-height: 0;

		@include modifier(auto) {
			// 自然高度包含行框与边距，不能继承上一次测量结果。
			display: flow-root;
			height: auto;
		}
	}

	// 移动端分栏：预览区是 fixed 元素的包含块，弹层收在手机框内。
	// 桌面 local 不设，同页 Modal 仍升到页面层叠。
	@include modifier(contained) {
		contain: layout paint;
		isolation: isolate;
	}

	@include element(overlay) {
		position: absolute;
		pointer-events: none;
		inset: 0;

		> * {
			pointer-events: auto;
		}
	}
}
</style>
