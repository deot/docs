import { onBeforeUnmount, onMounted, ref } from 'vue';
import type { RendererModuleContext } from '../../types';

export const useLandingMotion = (context: () => Readonly<RendererModuleContext>) => {
	const root = ref<HTMLElement>();
	let observer: IntersectionObserver | undefined;
	onMounted(() => {
		if (!root.value || !context().readonly || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
		root.value.classList.add('has-motion');
		if (typeof IntersectionObserver === 'undefined') return;
		observer = new IntersectionObserver((entries) => {
			entries.forEach((entry) => {
				if (!entry.isIntersecting) return;
				entry.target.classList.remove('is-waiting');
				observer?.unobserve(entry.target);
			});
		});
		root.value.querySelectorAll<HTMLElement>('[data-landing-reveal]').forEach((element) => {
			if (element.getBoundingClientRect().top < window.innerHeight) return;
			element.classList.add('is-waiting');
			observer?.observe(element);
		});
	});
	onBeforeUnmount(() => observer?.disconnect());
	return root;
};
