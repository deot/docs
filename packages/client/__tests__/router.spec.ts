// @vitest-environment jsdom

import { mount } from '@vue/test-utils';
import Home from '../src/pages/home/index.vue';
import { router } from '../src/router';

describe('router', () => {
	it('redirects home and renders the home page', async () => {
		await router.push('/');
		await router.isReady();
		expect(router.currentRoute.value.path).toBe('/home');

		const push = vi.spyOn(router, 'push').mockResolvedValue(undefined as any);
		const wrapper = mount(Home, { global: { plugins: [router] } });
		expect(wrapper.text()).toBe('a/Home');
		await wrapper.trigger('click');
		expect(push).toHaveBeenCalledWith('/about/main');
	});
});
