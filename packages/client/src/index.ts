import { computed, createApp, watch } from 'vue';
import { provideLocale, resolveLocale } from '@deot/docs-locale';
import '../../../node_modules/@deot/style/dist/index.normalize-only.css';
import '../../../node_modules/@deot/vc-components/dist/index.style.css';
import App from './app.vue';
import { connectResourceEvents } from './events';
import { IdlePrefetch } from './modules/idle-prefetch';
import { ThemeRuntime } from './modules/theme';
import { createDocsRouter } from './router';
import { getDefaultLanguage } from './utils/resolver';
import { initializeDocsRuntime } from './utils/runtime';
import type { DocsConfig } from './types';

export * from './utils/resolver';
export * from './utils/runtime';
export * from './types';
export { Gateway, Network, ResourceGateway, Theme } from './modules';
export type {
	ResourceContentRecord,
	ResourceLoadOptions,
	ResourcePollOptions,
	ResourcePrefetchOptions,
	ResourceRecord,
	ResourceStatus,
	ResourceStatusHistory,
	ResourceVersion
} from './modules';

export const bootstrap = (config?: DocsConfig) => {
	config ||= window.$docs || { locales: {}, routes: {} };
	initializeDocsRuntime(window, config);
	const stopTheme = ThemeRuntime.start(config);
	const router = createDocsRouter(config);
	const app = createApp(App);
	app.use(router);
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
	let stopPrefetch: () => void = () => undefined;
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
		stopPrefetch();
		stopDocumentLanguage();
		stopTheme();
	};
	return { app, router, disconnect };
};

if (typeof window !== 'undefined'
	&& typeof document !== 'undefined'
	&& document.querySelector('#app')) bootstrap();
