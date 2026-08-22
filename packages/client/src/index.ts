import { computed, createApp, watch } from 'vue';
import { provideLocale, resolveLocale } from '@deot/docs-locale';
import '../../../node_modules/@deot/style/dist/index.normalize-only.css';
import '../../../node_modules/@deot/vc-components/dist/index.style.css';
import App from './app.vue';
import { provideRendererModules } from './components/renderer';
import { connectResourceEvents } from './events';
import { IdlePrefetch } from './modules/idle-prefetch';
import { PlaygroundResource } from './modules/playground-resource';
import { Settings, ThemeRuntime } from './modules/settings';
import { createDocsRouter } from './router';
import { getDefaultLanguage } from './utils/resolver';
import { initializeDocsRuntime } from './utils/runtime';
import type { DocsConfig } from './types';

export * from './utils/resolver';
export * from './utils/runtime';
export * from './types';
export {
	Gateway,
	Network,
	PlaygroundResource,
	PlaygroundResourceCache,
	ResourceGateway,
	Theme
} from './modules';
export type {
	PlaygroundResourceKind,
	PlaygroundResourceLastAction,
	PlaygroundResourceProbeSummary,
	PlaygroundResourceRecord,
	PlaygroundResourceRequestStatus,
	PlaygroundResourceRow,
	ResourceContentRecord,
	ResourceLoadOptions,
	ResourcePollOptions,
	ResourcePrefetchOptions,
	ResourceRecord,
	ResourceRecordInput,
	ResourceStatus,
	ResourceStatusHistory,
	ResourceVersion
} from './modules';
export {
	RENDERER_EDITOR_DEMOS,
	createRendererEditorDemoDocument,
	isRendererEditorDemo,
	listRendererEditorDemos,
	rendererEditorDemoPath
} from './pages/renderer-editor-demos/catalog';
export type { RendererEditorDemo } from './pages/renderer-editor-demos/catalog';

export const bootstrap = async (config?: DocsConfig) => {
	config ||= window.$docs || { locales: {}, routes: {} };
	initializeDocsRuntime(window, config);
	const stopTheme = ThemeRuntime.start(config);
	const stopPlaygroundResource = await PlaygroundResource.start(config);
	const initialLanguage = await Settings.language.restore(config);
	const router = createDocsRouter(config, { initialLanguage });
	const stopLanguagePersistence = router.afterEach((to) => {
		void Settings.language.persist(config, to.params.lang);
	});
	const app = createApp(App);
	app.use(router);
	provideRendererModules(app, config);
	const locale = computed(() => resolveLocale(
		String(router.currentRoute.value.params.lang || getDefaultLanguage(config)),
		config.locales
	));
	provideLocale(locale, app);
	const stopDocumentLanguage = watch(locale, (value) => {
		document.documentElement.lang = value.name;
	}, { immediate: true });
	app.mount('#app');
	const disconnectEvents = connectResourceEvents();
	let disconnected = false;
	let stopPrefetch = () => {};
	// 首屏路由和插槽先完成加载，再让低优先级资源进入空闲队列。
	void (async () => {
		try {
			await router.isReady();
			if (!disconnected) stopPrefetch = IdlePrefetch.start(config);
		} catch {
			// Router 启动失败时应用本身会呈现错误，不再启动后台预加载。
		}
	})();
	const disconnect = () => {
		if (disconnected) return;
		disconnected = true;
		disconnectEvents();
		stopLanguagePersistence();
		stopPrefetch();
		stopDocumentLanguage();
		stopPlaygroundResource();
		stopTheme();
	};
	return { app, router, disconnect };
};

if (typeof window !== 'undefined'
	&& typeof document !== 'undefined'
	&& document.querySelector('#app')) void bootstrap();
