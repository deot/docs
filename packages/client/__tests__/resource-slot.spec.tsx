// @vitest-environment jsdom

import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { defineComponent, reactive } from 'vue';
import ResourceSlot from '../src/components/layout/resource-slot.vue';
import { isPlainNavigationClick } from '../src/utils/link';

const {
	route: routeState,
	routerPush,
	routerResolve,
	load,
	subscribe,
	unsubscribe,
	subscription
} = vi.hoisted(() => ({
	route: {
		fullPath: '/zh-CN/components/installation',
		path: '/zh-CN/components/installation',
		query: { tab: 'api' },
		hash: '',
		params: { lang: 'zh-CN', name: 'installation' },
		meta: {
			docsRoute: {
				content: 'default',
				sidebar: './sidebar.json',
				header: 'default',
				footer: 'default'
			} as Record<string, string | null>
		}
	},
	routerPush: vi.fn(async () => undefined),
	routerResolve: vi.fn((target: string) => ({
		href: `/docs${target}`,
		fullPath: target
	})),
	load: vi.fn(async () => ({
		content: '[{"label":"Install","value":"/installation"}]'
	})),
	subscribe: vi.fn(),
	unsubscribe: vi.fn(),
	subscription: { listener: undefined as undefined | ((record: { content: string }) => void) }
}));
const route = reactive(routeState);
enableAutoUnmount(afterEach);

vi.mock('vue-router', async original => ({
	...await original<any>(),
	useRoute: () => route,
	useRouter: () => ({ push: routerPush, resolve: routerResolve })
}));
vi.mock('../src/router', () => ({ getRouteValue: () => 'installation' }));
vi.mock('../src/modules', () => ({
	Gateway: {
		load,
		subscribe: (identity: any, listener: (record: { content: string }) => void) => {
			subscription.listener = listener;
			subscribe(identity, listener);
			return unsubscribe;
		}
	}
}));
vi.mock('@deot/docs-markdown', async () => ({
	Markdown: (await import('vue')).defineComponent({
		props: { value: String },
		setup: props => () => (
			<div class="markdown">
				<h2 id="%E5%9F%BA%E6%9C%AC">
					<a class="header-anchor" href="#%E5%9F%BA%E6%9C%AC">#</a>
					{props.value}
				</h2>
				<a class="document-anchor" href="#details"><span>Details</span></a>
				<h3 id="details">Details</h3>
				<a class="readme-link" href="../dever/README.md?tab=api#rules">
					<code>@deot/docs-dever</code>
				</a>
				<a class="blank-link" href="../cli/README.md" target="_blank">CLI blank</a>
				<a class="download-link" href="../cli/README.md" download>CLI download</a>
				<a class="external-link" href="https://example.com/docs">External</a>
				<a class="unknown-link" href="../unknown/README.md">Unknown</a>
				<a class="invalid-link" href="../invalid/README.md">Invalid</a>
			</div>
		)
	})
}));
vi.mock('../src/components/remote-sfc', async () => ({
	default: (await import('vue')).defineComponent({
		props: { source: String, lang: String },
		setup: props => () => (
			<div class="remote-sfc">{`${props.source}:${props.lang}`}</div>
		)
	})
}));

const RouterLinkStub = defineComponent({
	setup: (_props, { slots }) => () => <a>{slots.default?.()}</a>
});

describe('ResourceSlot', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		subscription.listener = undefined;
		route.fullPath = '/zh-CN/components/installation';
		route.path = route.fullPath;
		route.query = { tab: 'api' };
		route.hash = '';
		route.params = { lang: 'zh-CN', name: 'installation' };
		route.meta.docsRoute = {
			content: 'default',
			sidebar: './sidebar.json',
			header: 'default',
			footer: 'default'
		};
		load.mockResolvedValue({
			content: '[{"label":"Install","value":"/installation"}]'
		});
		routerResolve.mockImplementation((target: string) => ({
			href: `/docs${target}`,
			fullPath: target
		}));
		window.$docs = {
			locales: { 'zh-CN': { label: '简体中文' } },
			routes: {},
			namespace: 'test',
			runtime: { mode: 'development', workspace: '/site/' }
		};
	});

	it('loads and renders recursive sidebar JSON', async () => {
		const wrapper = mount(ResourceSlot, {
			props: { name: 'sidebar' },
			global: { stubs: { RouterLink: RouterLinkStub } }
		});
		await flushPromises();
		expect(wrapper.html()).toContain('docs-sidebar');
		expect(wrapper.text()).toContain('Install');
		expect(load).toHaveBeenCalledOnce();
	});

	it('keeps a fixed sidebar mounted while only the content route changes', async () => {
		const wrapper = mount(ResourceSlot, {
			props: { name: 'sidebar' },
			global: { stubs: { RouterLink: RouterLinkStub } }
		});
		await vi.waitFor(() => expect(wrapper.text()).toContain('Install'));
		const sidebar = wrapper.find('.docs-sidebar').element;

		route.path = '/zh-CN/components/input';
		route.query = { tab: 'examples' };
		await flushPromises();
		expect(load).toHaveBeenCalledOnce();
		expect(unsubscribe).not.toHaveBeenCalled();
		expect(wrapper.find('.docs-sidebar').element).toBe(sidebar);

		load.mockResolvedValueOnce({
			content: '[{"label":"Input","value":"/input"}]'
		});
		route.params = { lang: 'en-US', name: 'input' };
		route.path = '/en-US/components/input';
		await vi.waitFor(() => expect(wrapper.text()).toContain('Input'));
		expect(load).toHaveBeenCalledTimes(2);
		expect(unsubscribe).toHaveBeenCalledOnce();
	});

	it('resolves the built-in sidebar from the default sidebar resource', async () => {
		route.meta.docsRoute.sidebar = 'default';
		const wrapper = mount(ResourceSlot, {
			props: { name: 'sidebar' },
			global: { stubs: { RouterLink: RouterLinkStub } }
		});
		await vi.waitFor(() => expect(wrapper.text()).toContain('Install'));
		expect(load).toHaveBeenCalledWith(expect.objectContaining({
			type: 'sidebar',
			source: './sidebar.json'
		}), expect.objectContaining({
			url: '/site/zh-CN/sidebar.json'
		}));
	});

	it('renders builtin layout slots without a resource request', async () => {
		const wrapper = mount(ResourceSlot, { props: { name: 'footer' } });
		await vi.waitFor(() => expect(wrapper.text()).toContain('Powered by'));
		expect(load).not.toHaveBeenCalled();
	});

	it('loads default Markdown and applies subscription updates', async () => {
		load.mockResolvedValueOnce({ content: '# Initial' });
		window.$docs.resolve = {
			markdown: vi.fn(async ({ value }) => `./docs/${value}.md`)
		};
		const wrapper = mount(ResourceSlot, { props: { name: 'content' } });
		await vi.waitFor(() => expect(wrapper.text()).toContain('# Initial'));
		expect(wrapper.attributes('data-resource-type')).toBe('markdown');
		expect(load).toHaveBeenCalledWith(expect.objectContaining({
			source: './docs/installation.md'
		}), expect.objectContaining({
			url: '/site/zh-CN/docs/installation.md',
			priority: 100
		}));

		subscription.listener?.({ content: '# Updated' });
		await wrapper.vm.$nextTick();
		expect(wrapper.text()).toContain('# Updated');
		const [, options] = load.mock.calls[0] as unknown as [unknown, { signal: AbortSignal }];
		wrapper.unmount();
		expect(options.signal.aborted).toBe(true);
		expect(unsubscribe).toHaveBeenCalled();
	});

	it('rewrites resolved Markdown links and preserves native link gestures', async () => {
		load.mockResolvedValue({ content: '# Links' });
		const link = vi.fn(({ href, lang }: { href: string; lang: string }) => {
			if (href.startsWith('../dever/')) return `/${lang}/dever?tab=api#rules`;
			if (href.startsWith('../cli/')) return `/${lang}/cli`;
			if (href === 'https://example.com/docs') return 'https://mirror.example.com/docs';
			if (href.startsWith('../invalid/')) throw new Error('Invalid link');
			return undefined;
		});
		window.$docs.resolve = {
			markdown: () => 'packages/index/README.md',
			link
		};
		const wrapper = mount(ResourceSlot, { props: { name: 'content' } });
		await vi.waitFor(() => expect(wrapper.find('.readme-link').attributes('href'))
			.toBe('/docs/zh-CN/dever?tab=api#rules'));
		expect(wrapper.find('.blank-link').attributes('href')).toBe('/docs/zh-CN/cli');
		expect(wrapper.find('.download-link').attributes('href')).toBe('/docs/zh-CN/cli');
		expect(wrapper.find('.external-link').attributes('href'))
			.toBe('https://mirror.example.com/docs');
		expect(wrapper.find('.external-link').attributes('data-docs-route')).toBeUndefined();
		expect(wrapper.find('.unknown-link').attributes('href')).toBe('../unknown/README.md');
		expect(wrapper.find('.invalid-link').attributes('href')).toBe('../invalid/README.md');
		expect(link).toHaveBeenCalledWith(expect.objectContaining({
			href: '../dever/README.md?tab=api#rules',
			lang: 'zh-CN',
			source: 'packages/index/README.md',
			route
		}));

		const readmeAnchor = wrapper.find('.readme-link').element as HTMLAnchorElement;
		expect(isPlainNavigationClick(new MouseEvent('click'), readmeAnchor)).toBe(true);
		expect(isPlainNavigationClick(
			new MouseEvent('click', { metaKey: true }),
			readmeAnchor
		)).toBe(false);
		expect(isPlainNavigationClick(
			new MouseEvent('click', { ctrlKey: true }),
			readmeAnchor
		)).toBe(false);
		expect(isPlainNavigationClick(
			new MouseEvent('click', { shiftKey: true }),
			readmeAnchor
		)).toBe(false);
		expect(isPlainNavigationClick(
			new MouseEvent('click', { altKey: true }),
			readmeAnchor
		)).toBe(false);
		expect(isPlainNavigationClick(
			new MouseEvent('click', { button: 1 }),
			readmeAnchor
		)).toBe(false);
		const preventedClick = new MouseEvent('click', { cancelable: true });
		preventedClick.preventDefault();
		expect(isPlainNavigationClick(preventedClick, readmeAnchor)).toBe(false);
		expect(isPlainNavigationClick(
			new MouseEvent('click'),
			wrapper.find('.blank-link').element as HTMLAnchorElement
		)).toBe(false);
		expect(isPlainNavigationClick(
			new MouseEvent('click'),
			wrapper.find('.download-link').element as HTMLAnchorElement
		)).toBe(false);
		expect(routerPush).not.toHaveBeenCalled();

		await wrapper.find('.readme-link code').trigger('click');
		expect(routerPush).toHaveBeenCalledWith('/zh-CN/dever?tab=api#rules');

		subscription.listener?.({ content: '# Updated links' });
		await vi.waitFor(() => expect(wrapper.find('.readme-link').attributes('href'))
			.toBe('/docs/zh-CN/dever?tab=api#rules'));

		route.params = { lang: 'en-US', name: 'index' };
		route.path = '/en-US/index';
		await vi.waitFor(() => expect(wrapper.find('.readme-link').attributes('href'))
			.toBe('/docs/en-US/dever?tab=api#rules'));
	});

	it('recovers a failed Markdown slot when its subscription receives content', async () => {
		load.mockRejectedValueOnce(new Error('Temporary failure'));
		const wrapper = mount(ResourceSlot, { props: { name: 'content' } });
		await vi.waitFor(() => expect(wrapper.text()).toContain('Temporary failure'));

		subscription.listener?.({ content: '# Recovered' });
		await wrapper.vm.$nextTick();
		expect(wrapper.find('.docs-resource-slot__error').exists()).toBe(false);
		expect(wrapper.text()).toContain('# Recovered');
	});

	it('aborts and discards an old Markdown request after route changes', async () => {
		let finishOld!: (record: { content: string }) => void;
		let oldSignal!: AbortSignal;
		load.mockImplementationOnce(async (...args: unknown[]) => {
			const options = args[1] as { signal: AbortSignal };
			oldSignal = options.signal;
			return new Promise<{ content: string }>((resolve) => {
				finishOld = resolve;
			});
		});
		load.mockResolvedValueOnce({ content: '# Current' });
		const wrapper = mount(ResourceSlot, { props: { name: 'content' } });
		await vi.waitFor(() => expect(oldSignal).toBeInstanceOf(AbortSignal));

		route.path = '/zh-CN/components/current';
		await vi.waitFor(() => expect(wrapper.text()).toContain('# Current'));
		expect(oldSignal.aborted).toBe(true);
		finishOld({ content: '# Stale' });
		await flushPromises();
		expect(wrapper.text()).toContain('# Current');
		expect(wrapper.text()).not.toContain('# Stale');
	});

	it('keeps the previous content height while the next route is loading', async () => {
		load.mockResolvedValueOnce({ content: '# Previous' });
		const wrapper = mount(ResourceSlot, { props: { name: 'content' } });
		await vi.waitFor(() => expect(wrapper.text()).toContain('# Previous'));
		vi.spyOn(wrapper.element, 'getBoundingClientRect')
			.mockReturnValue({ height: 920 } as DOMRect);

		let finishNext!: (record: { content: string }) => void;
		load.mockImplementationOnce(async () => new Promise((resolve) => {
			finishNext = resolve;
		}));
		route.path = '/zh-CN/components/next';
		await vi.waitFor(() => expect(wrapper.find('.docs-resource-slot__loading').exists())
			.toBe(true));
		expect((wrapper.element as HTMLElement).style.minHeight).toBe('920px');

		finishNext({ content: '# Next' });
		await vi.waitFor(() => expect(wrapper.text()).toContain('# Next'));
		await vi.waitFor(() => expect((wrapper.element as HTMLElement).style.minHeight).toBe(''));
	});

	it('discards an async resolver result owned by an old route', async () => {
		let finishResolver!: (source: string) => void;
		const markdown = vi.fn()
			.mockImplementationOnce(async () => new Promise<string>((resolve) => {
				finishResolver = resolve;
			}))
			.mockResolvedValue('./current.md');
		window.$docs.resolve = { markdown };
		mount(ResourceSlot, { props: { name: 'content' } });
		await vi.waitFor(() => expect(markdown).toHaveBeenCalledOnce());

		route.path = '/zh-CN/components/current';
		await vi.waitFor(() => expect(load).toHaveBeenCalledWith(expect.objectContaining({
			source: './current.md'
		}), expect.anything()));
		finishResolver('./stale.md');
		await flushPromises();
		expect(load).toHaveBeenCalledOnce();
		expect(load).not.toHaveBeenCalledWith(expect.objectContaining({
			source: './stale.md'
		}), expect.anything());
	});

	it('keeps header and ordinary Markdown anchors on the current route', async () => {
		load.mockResolvedValueOnce({ content: '# Initial' });
		const scroller = document.createElement('div');
		scroller.className = 'vc-scroller__wrapper';
		scroller.scrollTop = 5;
		vi.spyOn(scroller, 'getBoundingClientRect').mockReturnValue({ top: 60 } as DOMRect);
		document.body.appendChild(scroller);
		const wrapper = mount(ResourceSlot, {
			props: { name: 'content' },
			attachTo: scroller
		});
		await vi.waitFor(() => expect(wrapper.find('.header-anchor').exists()).toBe(true));
		vi.spyOn(wrapper.find('h2').element, 'getBoundingClientRect')
			.mockReturnValue({ top: 176 } as DOMRect);

		await wrapper.find('.header-anchor').trigger('click');
		await flushPromises();
		expect(routerPush).toHaveBeenCalledWith({
			path: '/zh-CN/components/installation',
			query: { tab: 'api' },
			hash: '#基本'
		});
		expect(scroller.scrollTop).toBe(121);
		expect(load).toHaveBeenCalledOnce();

		scroller.scrollTop = 0;
		vi.spyOn(wrapper.find('h3').element, 'getBoundingClientRect')
			.mockReturnValue({ top: 220 } as DOMRect);
		await wrapper.find('.document-anchor span').trigger('click');
		await flushPromises();
		expect(routerPush).toHaveBeenLastCalledWith({
			path: '/zh-CN/components/installation',
			query: { tab: 'api' },
			hash: '#details'
		});
		expect(scroller.scrollTop).toBe(160);
		expect(load).toHaveBeenCalledOnce();
		wrapper.unmount();
		scroller.remove();
	});

	it('positions direct and history-driven hashes after Markdown is available', async () => {
		load.mockResolvedValueOnce({ content: '# Initial' });
		route.hash = '#%E5%9F%BA%E6%9C%AC';
		const scroller = document.createElement('div');
		scroller.className = 'vc-scroller__wrapper';
		document.body.appendChild(scroller);
		const rect = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect')
			.mockImplementation(function (this: HTMLElement) {
				if (this === scroller) return { top: 40 } as DOMRect;
				if (this.id === '%E5%9F%BA%E6%9C%AC') return { top: 150 } as DOMRect;
				if (this.id === 'details') return { top: 260 } as DOMRect;
				return { top: 0 } as DOMRect;
			});
		const wrapper = mount(ResourceSlot, {
			props: { name: 'content' },
			attachTo: scroller
		});

		await vi.waitFor(() => expect(scroller.scrollTop).toBe(110));
		route.hash = '#details';
		await vi.waitFor(() => expect(scroller.scrollTop).toBe(330));
		expect(load).toHaveBeenCalledOnce();
		expect(routerPush).not.toHaveBeenCalled();

		wrapper.unmount();
		rect.mockRestore();
		scroller.remove();
	});

	it('renders remote SFC and classifies module and style slots', async () => {
		route.meta.docsRoute.content = './demo.vue';
		const remote = mount(ResourceSlot, { props: { name: 'content' } });
		await vi.waitFor(() => expect(remote.find('.remote-sfc').exists()).toBe(true));
		expect(remote.text()).toContain('./demo.vue:zh-CN');
		expect(load).not.toHaveBeenCalled();

		route.meta.docsRoute.extra = './theme.css?raw';
		const style = mount(ResourceSlot, { props: { name: 'extra' } });
		await flushPromises();
		expect(style.attributes('data-resource-type')).toBe('style');

		route.meta.docsRoute.extra = './runtime.ts';
		const module = mount(ResourceSlot, { props: { name: 'extra' } });
		await flushPromises();
		expect(module.attributes('data-resource-type')).toBe('module');
	});

	it('handles missing, null and invalid sidebar configurations', async () => {
		delete (route.meta as any).docsRoute;
		const missing = mount(ResourceSlot, { props: { name: 'content' } });
		await flushPromises();
		expect(missing.text()).toBe('');

		route.meta.docsRoute = { content: null };
		const empty = mount(ResourceSlot, { props: { name: 'content' } });
		await flushPromises();
		expect(empty.text()).toBe('');

		route.meta.docsRoute = { sidebar: './sidebar.json' };
		load.mockResolvedValueOnce({ content: '{invalid' });
		const invalid = mount(ResourceSlot, { props: { name: 'sidebar' } });
		await flushPromises();
		expect(invalid.find('.docs-sidebar').exists()).toBe(false);
		expect(invalid.find('.docs-resource-slot__error').exists()).toBe(true);

		load.mockResolvedValueOnce({ content: '{"label":"not-an-array"}' });
		const object = mount(ResourceSlot, { props: { name: 'sidebar' } });
		await flushPromises();
		expect(object.find('.docs-sidebar').exists()).toBe(false);
		expect(object.text()).toContain('Invalid sidebar resource');
	});

	it('renders request failures and ignores aborted work on unmount', async () => {
		window.$docs.resolve = {
			markdown: vi.fn(async () => {
				throw new Error('Resolver failed');
			})
		};
		const resolverFailed = mount(ResourceSlot, { props: { name: 'content' } });
		await vi.waitFor(() => expect(resolverFailed.text()).toContain('Resolver failed'));
		delete window.$docs.resolve;

		load.mockRejectedValueOnce(new Error('Markdown failed'));
		const failed = mount(ResourceSlot, { props: { name: 'content' } });
		await vi.waitFor(() => expect(failed.text()).toContain('Markdown failed'));

		load.mockRejectedValueOnce(new Error('plain failure'));
		const plain = mount(ResourceSlot, { props: { name: 'content' } });
		await vi.waitFor(() => expect(plain.text()).toContain('plain failure'));

		load.mockRejectedValueOnce(new Error('404 Not Found'));
		const missing = mount(ResourceSlot, { props: { name: 'content' } });
		await vi.waitFor(() => expect(missing.text()).toContain('404 Not Found'));

		load.mockRejectedValueOnce({ unexpected: true });
		const unknown = mount(ResourceSlot, { props: { name: 'content' } });
		await vi.waitFor(() => expect(unknown.text()).toContain('Resource request failed'));

		let reject!: (reason: unknown) => void;
		load.mockReturnValueOnce(new Promise((_resolve, rejectPromise) => {
			reject = rejectPromise;
		}));
		const pending = mount(ResourceSlot, { props: { name: 'content' } });
		await flushPromises();
		pending.unmount();
		reject(new Error('aborted'));
		await flushPromises();
	});
});
