import { createApp } from 'vue';
import '../../../node_modules/@deot/style/dist/index.normalize-only.css';
import '../../../node_modules/@deot/vc-components/dist/index.style.css';
import App from './app.vue';
import { connectResourceEvents } from './events';
import { createDocsRouter } from './router';
import { initializeDocsRuntime } from './utils/runtime';
import type { DocsConfig } from './types';

export * from './utils/resolver';
export * from './utils/runtime';
export * from './types';
export { Gateway, Network, ResourceGateway } from './network';
export type {
	ResourceContentRecord,
	ResourceLoadOptions,
	ResourcePollOptions,
	ResourceRecord,
	ResourceStatus,
	ResourceStatusHistory,
	ResourceVersion
} from './network';

export const bootstrap = (config?: DocsConfig) => {
	config ||= window.$docs || { locales: {}, routes: {} };
	initializeDocsRuntime(window, config);
	const router = createDocsRouter(config);
	const app = createApp(App);
	app.use(router);
	app.mount('#app');
	const disconnect = connectResourceEvents();
	return { app, router, disconnect };
};

if (typeof window !== 'undefined'
	&& typeof document !== 'undefined'
	&& document.querySelector('#app')) bootstrap();
