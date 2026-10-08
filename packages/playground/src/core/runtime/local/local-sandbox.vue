<template>
	<div ref="containerEl" class="docs-playground-local">
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
		/>
	</div>
</template>
<script setup lang="ts">
import {
	defineComponent,
	h,
	nextTick,
	onBeforeUnmount,
	onErrorCaptured,
	onMounted,
	provide,
	ref,
	shallowRef,
	watch
} from 'vue';
import type { App, Component } from 'vue';
import * as Vue from 'vue';
import * as VueRouter from 'vue-router';
import { Scroller } from '@deot/vc';
import type {
	PlaygroundFiles,
	PlaygroundOptions,
	PlaygroundPreviewScroller
} from '../../../types';
import { createLocalPlayground } from './playground';
import { createRuntimeImports } from '../../store';
import { PREVIEW_SCROLL_CONTENT_CLASS } from '../../preview-scroll';
import {
	installLocalBridge,
	LOCAL_BRIDGE_SRCDOC,
	LocalPreviewPort
} from './port';
import { injectStyle, removeStyle } from './compile/css';
import { formatPlaygroundRuntimeError } from './format-error';

const props = withDefaults(defineProps<{
	files: PlaygroundFiles;
	entry: string;
	options: PlaygroundOptions;
	previewScroller?: PlaygroundPreviewScroller;
	clearConsole?: boolean;
	autoHeight?: boolean;
}>(), {
	previewScroller: false,
	clearConsole: false,
	autoHeight: false
});

const emit = defineEmits<{
	error: [payload: { compile: string; runtime: string }];
}>();

const bridgeSrcdoc = LOCAL_BRIDGE_SRCDOC;
const containerEl = ref<HTMLElement | null>(null);
const bridgeEl = ref<HTMLIFrameElement | null>(null);
const mountEl = ref<HTMLElement | null>(null);
const compileError = ref('');
const runtimeError = ref('');
const messageSource = shallowRef<Window | null>(null);
let port: LocalPreviewPort | null = null;
let previewApp: App<Element> | null = null;
let version = 0;
let pendingMount: { component: Component; css: string[]; version: number } | null = null;
const styleId = `docs-local-${Math.random().toString(36).slice(2, 10)}`;

const publishError = () => {
	emit('error', {
		compile: compileError.value,
		runtime: runtimeError.value
	});
};

watch([compileError, runtimeError], publishError);

const createDocsLink = (preview: LocalPreviewPort) => defineComponent({
	name: 'DocsLink',
	props: {
		to: { type: String, default: '' }
	},
	setup(linkProps, { slots }) {
		return () => h('a', {
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

const mountPreview = (component: Component, preview: LocalPreviewPort, css: string[]) => {
	if (!mountEl.value) return;
	destroyPreview();
	injectStyle(styleId, css);
	if (props.clearConsole) console.clear();
	const useScroller = props.previewScroller === true;
	const app = Vue.createApp({
		name: 'LocalSandboxRoot',
		setup() {
			const service = createLocalPlayground(Vue);
			provide('docs:playground', service);
			onErrorCaptured((error) => {
				const message = formatPlaygroundRuntimeError(error);
				if (message) runtimeError.value = message;
				return false;
			});
			onBeforeUnmount(() => service.dispose());
			return () => {
				const content = h(component);
				if (!useScroller) return content;
				return h(Scroller, {
					height: '100%',
					native: false,
					autoResize: true,
					showBar: true,
					contentClass: PREVIEW_SCROLL_CONTENT_CLASS
				}, { default: () => content });
			};
		}
	});
	app.component('DocsLink', createDocsLink(preview));
	app.config.errorHandler = (error) => {
		const message = formatPlaygroundRuntimeError(error);
		if (message) runtimeError.value = message;
	};
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
	mountPreview(job.component, preview, job.css);
};

const run = async () => {
	const current = ++version;
	pendingMount = null;
	compileError.value = '';
	runtimeError.value = '';
	publishError();
	destroyPreview();
	try {
		const [{ compilePlayground }, { linkPlayground }, modulesApi, fileApi] = await Promise.all([
			import('./compile'),
			import('./linker'),
			import('./modules'),
			import('./compile/files')
		]);
		/* istanbul ignore if -- 并发编译时只保留最后一次 */
		if (current !== version) return;
		const compiled = await compilePlayground(props.files, { entry: props.entry });
		// 后到的编译结果直接丢弃，避免旧任务覆盖新预览。
		/* istanbul ignore if -- 并发编译时只保留最后一次 */
		if (current !== version) return;
		if (compiled.errors.length || !compiled.entry) {
			compileError.value = compiled.errors.join('\n') || '[Playground] 未能确定入口';
			publishError();
			return;
		}
		const imports = createRuntimeImports(props.options.cdnURL, props.options.builtinImportMap);
		const specifiers = fileApi.collectBareSpecifiers(
			props.files,
			fileApi.collectReachableFilenames(props.files, compiled.entry)
		);
		const { createRemoteLoader } = await import('./remote');
		const remote = createRemoteLoader(
			imports,
			{ vue: Vue, vueRouter: VueRouter },
			props.options.cdnURL
		);
		const loaded = await modulesApi.loadLocalModules(
			specifiers,
			imports,
			{ vue: Vue, vueRouter: VueRouter },
			url => remote.load(url),
			props.options.cdnURL
		);
		/* istanbul ignore if -- 并发编译时只保留最后一次 */
		if (current !== version) return;
		if (loaded.errors.length) {
			compileError.value = loaded.errors.join('\n');
			publishError();
			return;
		}
		const linked = linkPlayground(compiled, props.files, { modules: loaded.modules });
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
	void run();
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
});

defineExpose({
	container: containerEl,
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
}
</style>
