import { createApp, h } from 'vue';
import { RouterView } from 'vue-router';
import { router } from './router';

(async () => {
	const app = createApp(() => [
		h(RouterView, { name: 'header' }),
		h(RouterView, { name: 'sidebar' }),
		h(RouterView),
		h(RouterView, { name: 'footer' }),
		h(RouterView, { name: 'extra' })
	]);
	app.use(router);
	app.mount('#app');
})();
