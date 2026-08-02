import { createWebHistory, createRouter } from 'vue-router';
import Home from '../pages/home/index.vue';

export const router = createRouter({
	history: createWebHistory('/'),
	routes: [
		{ path: '/', redirect: '/home' },
		{ path: '/home', component: Home }
	],
});
