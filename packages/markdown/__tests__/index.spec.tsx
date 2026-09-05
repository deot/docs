// @vitest-environment jsdom

import { defineComponent, provide, ref } from 'vue';
import { flushPromises, mount } from '@vue/test-utils';
import { zhCN } from '@deot/docs-locale';
import { Markdown as MarkdownRenderer } from '../src/markdown';
import { Markdown, parseMarkdownSearchSections } from '../src';

const htmlElementOf = (
	value: { readonly element: EventTarget | Node | null }
): HTMLElement => {
	if (!(value.element instanceof HTMLElement)) throw new TypeError('expected HTMLElement');
	return value.element;
};

const { codePreviewUnmounted, getScrollerMock, MockResizeObserver, playgroundUnmounted, resizeObservers } = vi.hoisted(() => {
	const observers: Array<{ callback: () => void }> = [];
	class ResizeObserverMock {
		callback: () => void;
		constructor(callback: () => void) {
			this.callback = callback;
			observers.push(this);
		}

		disconnect() {}
		observe() {}
		unobserve() {}
	}
	vi.stubGlobal('ResizeObserver', ResizeObserverMock);
	return {
		codePreviewUnmounted: vi.fn(),
		getScrollerMock: vi.fn(),
		MockResizeObserver: ResizeObserverMock,
		playgroundUnmounted: vi.fn(),
		resizeObservers: observers
	};
});

const runtimeWithConfig = (config: string, body: string) => [
	':::playground',
	'<!--',
	'<config lang="json5">',
	config,
	'</config>',
	'-->',
	body,
	':::'
].join('\n');

const dispatchPointer = (
	element: Element,
	type: string,
	options: { button?: number; clientY?: number; pointerId?: number } = {}
) => {
	const event = new MouseEvent(type, {
		bubbles: true,
		button: options.button || 0,
		clientY: options.clientY || 0
	});
	Object.defineProperty(event, 'pointerId', { value: options.pointerId || 1 });
	element.dispatchEvent(event);
};

const mockAnimationFrames = () => {
	let nextId = 0;
	const callbacks = new Map<number, FrameRequestCallback>();
	const request = vi.fn((callback: FrameRequestCallback) => {
		const id = ++nextId;
		callbacks.set(id, callback);
		return id;
	});
	const cancel = vi.fn((id: number) => callbacks.delete(id));
	vi.stubGlobal('requestAnimationFrame', request);
	vi.stubGlobal('cancelAnimationFrame', cancel);
	return {
		cancel,
		flush: () => {
			const pending = [...callbacks.entries()];
			callbacks.clear();
			pending.forEach(([, callback]) => callback(0));
		},
		request
	};
};

vi.mock('@deot/vc', () => ({
	Clipboard: defineComponent({
		name: 'Clipboard',
		props: ['value'],
		setup: (_, { slots }) => () => (
			<button class="clipboard">{slots.default?.()}</button>
		)
	}),
	Scroller: defineComponent({
		name: 'Scroller',
		props: ['height', 'wrapperStyle'],
		setup(props, { attrs, expose, slots }) {
			const wrapper = ref<HTMLElement>();
			expose({
				setScrollTop: (value: number) => {
					if (wrapper.value) wrapper.value.scrollTop = value;
				}
			});
			return () => (
				<div {...attrs} class={['vc-scroller', attrs.class]}>
					<div
						ref={wrapper}
						class="vc-scroller__wrapper"
						style={[props.wrapperStyle, { height: props.height }]}
					>
						<div class="vc-scroller__content">{slots.default?.()}</div>
					</div>
				</div>
			);
		}
	})
}));

vi.mock('@deot/helper-dom', async () => {
	const actual = await vi.importActual<typeof import('@deot/helper-dom')>('@deot/helper-dom');
	getScrollerMock.mockImplementation(actual.getScroller);
	return {
		...actual,
		getScroller: getScrollerMock
	};
});

vi.mock('@deot/docs-playground', async () => {
	const { default: RealCodePreview } = await import('../../playground/src/core/code-preview/code-preview.vue');
	return {
		CodePreview: defineComponent({
			props: ['code', 'filename', 'language', 'copyLabel'],
			unmounted: codePreviewUnmounted,
			setup(props, { attrs }) {
				return () => <RealCodePreview {...attrs} {...props} />;
			}
		}),
		Playground: defineComponent({
			props: [
				'modelValue',
				'theme',
				'files',
				'entry',
				'views',
				'viewport',
				'viewportOptions',
				'previewInset',
				'expandable'
			],
			unmounted: playgroundUnmounted,
			setup(props) {
				return () => {
					const summary = [
						props.modelValue || '',
						props.entry || '',
						JSON.stringify(props.files || {}),
						props.theme || '',
						JSON.stringify(props.views || []),
						JSON.stringify(props.viewport),
						JSON.stringify(props.viewportOptions),
						JSON.stringify(props.previewInset),
						JSON.stringify(props.expandable)
					].join('-');
					return (
						<div class="playground">
							<span>{summary}</span>
							<pre class="playground-code">
								<code class="hljs language-js">runtime preview</code>
							</pre>
						</div>
					);
				};
			}
		})
	};
});

describe('markdown', () => {
	it('extracts searchable sections with renderer heading anchors', () => {
		const parsed = parseMarkdownSearchSections([
			'# 文档标题',
			'',
			'正文 **内容** 与 `inline code`。',
			'',
			'```ts',
			'const hidden = true;',
			'```',
			'',
			'<div>hidden html</div>',
			'',
			'## 重复',
			'',
			'第一节内容',
			'',
			'## 重复',
			'',
			'Second section',
			'',
			'| Field | Value |',
			'| --- | --- |',
			'| searchable | table cell |'
		].join('\n'));

		expect(parsed.title).toBe('文档标题');
		expect(parsed.sections.map(section => section.anchor)).toEqual([
			encodeURIComponent('文档标题'),
			encodeURIComponent('重复'),
			`${encodeURIComponent('重复')}-1`
		]);
		expect(parsed.text).toContain('正文 内容 与 inline code');
		expect(parsed.text).not.toContain('const hidden');
		expect(parsed.text).not.toContain('hidden html');
		expect(parsed.text).toContain('searchable table cell');
		expect(parsed.sections[1].text).toBe('第一节内容');
	});
	beforeAll(async () => {
		await import('@deot/docs-playground');
	});

	beforeEach(() => {
		codePreviewUnmounted.mockReset();
		getScrollerMock.mockClear();
		playgroundUnmounted.mockReset();
		resizeObservers.length = 0;
		vi.stubGlobal('ResizeObserver', MockResizeObserver);
	});

	afterEach(() => {
		document.body.innerHTML = '';
		document.getElementById('docs-code-preview-style')?.remove();
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it('renders markdown features and adds the md marker', () => {
		const html = MarkdownRenderer.render([
			'# Title',
			'',
			'https://example.com',
			'',
			':::tip',
			'help',
			':::',
			'',
			'```ts',
			'const value = 1',
			'```'
		].join('\n'));

		expect(html).toContain('class="header-anchor"');
		expect(html).toMatch(/<h1[^>]*><a class="header-anchor"[^>]*>#<\/a> Title<\/h1>/);
		expect(html).not.toMatch(/<\/[^> ]+\s+md=/);
		expect(html).toContain('href="https://example.com"');
		expect(html).toContain('class="tip"');
		expect(html).toContain('md=""');
		expect(html).toContain('<code class="language-ts">');
	});

	it('keeps an unnamed single-file playground block', () => {
		const html = MarkdownRenderer.render(runtimeWithConfig(
			'{ views: [\'runtime\'] }',
			'```vue\n<template>ok</template>\n```'
		));

		expect(html).toContain('data-playground');
		expect(html).toContain('data-code="&lt;template&gt;ok&lt;/template&gt;');
		expect(html).toContain('data-props="{&quot;views&quot;:[&quot;runtime&quot;]}"');
		expect(html).not.toContain('data-files=');
		expect(html).not.toContain('<config');
	});

	it('collects named fences into one multi-file playground', () => {
		const source = runtimeWithConfig(
			'{ entry: \'main.js\', views: [\'files\'] }',
			[
				'```js main.js',
				'import App from "./App.vue";',
				'```',
				'```vue App.vue',
				'<template>multi</template>',
				'```'
			].join('\n')
		);
		const html = MarkdownRenderer.render(source);

		expect(html.match(/data-playground/g)).toHaveLength(1);
		expect(html).toContain('data-entry="main.js"');
		expect(html).toContain('&quot;main.js&quot;');
		expect(html).toContain('&quot;App.vue&quot;');
		expect(html).not.toContain('<pre>');
	});

	it('renders the wrapper, playgrounds and shared code previews', async () => {
		const source = [
			'# Hello',
			'',
			runtimeWithConfig(
				'{ views: [\'runtime\'] }',
				'```vue\n<template>demo</template>\n```'
			),
			'',
			'```js',
			'\tconst n = 1',
			'```'
		].join('\n');
		const wrapper = mount(Markdown, { props: { modelValue: source }, attachTo: document.body });
		await vi.waitFor(
			() => expect(document.querySelector('.playground')).not.toBeNull(),
			{ timeout: 5000 }
		);

		expect(wrapper.find('h1').text()).toContain('Hello');
		expect(document.querySelector('.playground')?.textContent).toContain('<template>demo</template>');
		expect(document.querySelector('.playground')?.textContent).toContain('["runtime"]');
		expect(wrapper.find('.docs-code-preview code').classes()).toContain('hljs');
		expect(wrapper.find('.docs-code-preview code').html()).toContain('hljs-keyword');
		expect(wrapper.find('.docs-code-preview__copy').exists()).toBe(true);
		expect(wrapper.find('.docs-code-preview__language').text()).toBe('js');
		expect(wrapper.find('.docs-code-preview code').text()).toMatch(/const\s+n\s+=\s+1/);
		expect(wrapper.findAll('.docs-code-preview')).toHaveLength(1);
		expect(wrapper.findAll('.docs-markdown-code-preview')).toHaveLength(1);
		expect(wrapper.find('.playground .playground-code').exists()).toBe(true);
		expect(wrapper.find('.playground .docs-code-preview').exists()).toBe(false);
	});

	it('builds a configurable document indicator from rendered blocks', async () => {
		const frames = mockAnimationFrames();
		const scrollTo = vi.fn();
		vi.stubGlobal('scrollTo', scrollTo);
		const wrapper = mount(Markdown, {
			props: {
				indicator: {
					draggable: true,
					height: 480,
					position: 'left',
					preview: true,
					top: '12px'
				},
				modelValue: [
					'# Alpha',
					'',
					'Intro paragraph',
					'',
					'## Beta',
					'',
					'- One',
					'- Two',
					'',
					':::tip',
					'Tip paragraph',
					':::'
				].join('\n')
			},
			attachTo: document.body
		});
		await vi.waitFor(() => {
			expect(wrapper.findAll('.docs-markdown-indicator__marker')).toHaveLength(6);
		});

		const indicator = wrapper.get('.docs-markdown-indicator');
		expect(indicator.classes()).toContain('is-left');
		const markerLabels = wrapper.findAll('.docs-markdown-indicator__marker')
			.map(marker => marker.attributes('aria-label'));
		expect(markerLabels).toEqual([
			'Alpha: Intro paragraph',
			'Alpha: Intro paragraph',
			'Beta: One',
			'Beta: One',
			'Beta: Two',
			'Beta: Tip paragraph'
		]);
		expect(indicator.attributes('style')).toContain('--docs-markdown-indicator-height: 480px');
		expect(indicator.attributes('style')).toContain('--docs-markdown-indicator-top: 12px');
		expect(wrapper.findAll('.docs-markdown-indicator__marker')[0].attributes('style'))
			.toContain('width: 8px');
		expect(wrapper.findAll('.docs-markdown-indicator__marker')[1].attributes('style'))
			.toContain('width: 8px');

		await wrapper.findAll('.docs-markdown-indicator__marker')[1].trigger('click');
		expect(scrollTo).toHaveBeenCalledWith({ behavior: 'smooth', top: -24 });

		await wrapper.setProps({ modelValue: '# Updated\n\nOnly one paragraph' });
		await flushPromises();
		frames.flush();
		await vi.waitFor(() => {
			expect(wrapper.findAll('.docs-markdown-indicator__marker')).toHaveLength(2);
		});
		expect(wrapper.findAll('.docs-markdown-indicator__marker')[0].attributes('aria-label'))
			.toBe('Updated: Only one paragraph');

		await wrapper.setProps({ indicator: false });
		expect(wrapper.find('.docs-markdown-indicator').exists()).toBe(false);
	});

	it('centers the document indicator in the scroll host', async () => {
		const host = document.createElement('div');
		host.style.overflow = 'auto';
		document.body.appendChild(host);
		Object.defineProperty(host, 'clientHeight', { configurable: true, value: 800 });
		const previousScroller = getScrollerMock.getMockImplementation();
		getScrollerMock.mockImplementation(() => host);
		try {
			const wrapper = mount(Markdown, {
				props: {
					indicator: { height: 200 },
					modelValue: '# First\n\nParagraph\n\n## Second\n\nLast paragraph'
				},
				attachTo: host
			});
			await vi.waitFor(() => {
				expect(wrapper.find('.docs-markdown-indicator').exists()).toBe(true);
			});
			expect(wrapper.get('.docs-markdown-indicator').attributes('style'))
				.toContain('--docs-markdown-indicator-inset: 300px');

			await wrapper.setProps({ indicator: { height: 400 } });
			await flushPromises();
			expect(wrapper.get('.docs-markdown-indicator').attributes('style'))
				.toContain('--docs-markdown-indicator-inset: 200px');

			Object.defineProperty(host, 'clientHeight', { configurable: true, value: 900 });
			resizeObservers.forEach(observer => observer.callback());
			await flushPromises();
			expect(wrapper.get('.docs-markdown-indicator').attributes('style'))
				.toContain('--docs-markdown-indicator-inset: 250px');

			Object.defineProperty(host, 'clientHeight', { configurable: true, value: 0 });
			resizeObservers.forEach(observer => observer.callback());
			await flushPromises();
			expect(wrapper.get('.docs-markdown-indicator').attributes('style'))
				.toContain('--docs-markdown-indicator-inset: 0px');

			await wrapper.setProps({ locale: zhCN });
			await flushPromises();
			wrapper.unmount();
		} finally {
			host.remove();
			if (previousScroller) getScrollerMock.mockImplementation(previousScroller);
		}
	});

	it('uses the explicit locale for indicator UI', async () => {
		const wrapper = mount(Markdown, {
			props: {
				locale: zhCN,
				modelValue: '# First\n\nParagraph'
			},
			attachTo: document.body
		});

		await vi.waitFor(() => {
			expect(wrapper.find('.docs-markdown-indicator').exists()).toBe(true);
		});
		expect(wrapper.get('.docs-markdown-indicator').attributes('aria-label'))
			.toBe('文档指示器');
	});

	it('prefers the injected Scroller before searching for a native scroll host', async () => {
		const on = vi.fn();
		const off = vi.fn();
		const setScrollTop = vi.fn();
		const scrollerWrapper = document.createElement('div');
		Object.defineProperty(scrollerWrapper, 'clientHeight', { value: 720 });
		const Host = defineComponent({
			setup() {
				provide('vc-scroller', {
					clientHeight: 720,
					off,
					on,
					scrollTop: 0,
					setScrollTop,
					wrapper: scrollerWrapper
				});
				return () => <Markdown modelValue="# First\n\nParagraph" />;
			}
		});
		const wrapper = mount(Host, { attachTo: document.body });

		await vi.waitFor(() => expect(on).toHaveBeenCalledTimes(1));
		expect(getScrollerMock).not.toHaveBeenCalled();

		wrapper.unmount();
		expect(off).toHaveBeenCalledTimes(1);
	});

	it('previews, scrolls and drags through a Scroller document map', async () => {
		const frames = mockAnimationFrames();
		const host = document.createElement('div');
		host.className = 'vc-scroller__wrapper';
		host.style.overflow = 'auto';
		document.body.appendChild(host);
		const scrollTo = vi.fn();
		host.scrollTo = scrollTo;
		Object.defineProperty(host, 'scrollTop', { value: 50, writable: true });
		Object.defineProperty(host, 'clientHeight', { value: 600 });
		Object.defineProperty(host, 'scrollHeight', { value: 1200 });
		vi.spyOn(host, 'getBoundingClientRect').mockReturnValue({
			left: 0,
			top: 20,
			right: 800,
			bottom: 620,
			width: 800,
			height: 600,
			x: 0,
			y: 20,
			toJSON: () => ({})
		});
		const wrapper = mount(Markdown, {
			props: {
				modelValue: '# First\n\nParagraph\n\n## Second\n\nLast paragraph'
			},
			attachTo: host
		});
		await vi.waitFor(() => {
			expect(wrapper.findAll('.docs-markdown-indicator__marker')).toHaveLength(4);
		});
		expect(wrapper.get('.docs-markdown-indicator').classes()).toContain('is-right');

		const blocks = wrapper.find('.docs-markdown-reset').element.querySelectorAll<HTMLElement>('h1,p,h2');
		[40, 100, 220, 360].forEach((top, index) => {
			vi.spyOn(blocks[index], 'getBoundingClientRect').mockReturnValue({
				left: 100,
				top,
				right: 700,
				bottom: top + 40,
				width: 600,
				height: 40,
				x: 100,
				y: top,
				toJSON: () => ({})
			});
		});
		const indicatorRoot = htmlElementOf(wrapper.get('.docs-markdown-indicator'));
		const viewport = htmlElementOf(wrapper.get('.docs-markdown-indicator__viewport'));
		const indicatorWrapper = htmlElementOf(wrapper.get(
			'.docs-markdown-indicator__scroller .vc-scroller__wrapper'
		));
		vi.spyOn(indicatorRoot, 'getBoundingClientRect').mockReturnValue({
			left: 40,
			top: 100,
			right: 80,
			bottom: 500,
			width: 40,
			height: 400,
			x: 40,
			y: 100,
			toJSON: () => ({})
		});
		vi.spyOn(viewport, 'getBoundingClientRect').mockReturnValue({
			left: 40,
			top: 100,
			right: 80,
			bottom: 500,
			width: 40,
			height: 400,
			x: 40,
			y: 100,
			toJSON: () => ({})
		});
		vi.spyOn(indicatorWrapper, 'getBoundingClientRect').mockReturnValue({
			left: 40,
			top: 100,
			right: 80,
			bottom: 110,
			width: 40,
			height: 10,
			x: 40,
			y: 100,
			toJSON: () => ({})
		});
		const markerElements = wrapper.findAll('.docs-markdown-indicator__marker')
			.map(marker => htmlElementOf(marker));
		[100, 108, 116, 124].forEach((top, index) => {
			vi.spyOn(markerElements[index], 'getBoundingClientRect').mockReturnValue({
				left: 40,
				top,
				right: 44,
				bottom: top + 2,
				width: 4,
				height: 2,
				x: 40,
				y: top,
				toJSON: () => ({})
			});
		});
		const setPointerCapture = vi.fn();
		const releasePointerCapture = vi.fn();
		viewport.setPointerCapture = setPointerCapture;
		viewport.hasPointerCapture = vi.fn(() => true);
		viewport.releasePointerCapture = releasePointerCapture;

		host.dispatchEvent(new Event('scroll'));
		host.dispatchEvent(new Event('scroll'));
		expect(frames.request).toHaveBeenCalledTimes(1);
		frames.flush();
		await flushPromises();
		expect(wrapper.findAll('.docs-markdown-indicator__marker')[1].classes())
			.toContain('is-active');
		expect(indicatorWrapper.scrollTop).toBeGreaterThan(0);

		host.scrollTop = 600;
		host.dispatchEvent(new Event('scroll'));
		frames.flush();
		await flushPromises();
		expect(wrapper.findAll('.docs-markdown-indicator__marker')[3].classes())
			.toContain('is-active');
		host.scrollTop = 50;
		host.dispatchEvent(new Event('scroll'));
		frames.flush();
		await flushPromises();

		const markerTops = markerElements.map(marker => marker.getBoundingClientRect().top);
		dispatchPointer(viewport, 'pointermove', { clientY: 100 });
		await flushPromises();
		expect(wrapper.get('.docs-markdown-indicator__preview-title').text()).toBe('First');
		expect(wrapper.get('.docs-markdown-indicator__preview-content').text()).toBe('Paragraph');
		expect(wrapper.findAll('.docs-markdown-indicator__marker')[0].attributes('style'))
			.toContain('width: 28px');
		expect(wrapper.findAll('.docs-markdown-indicator__marker')[1].attributes('style'))
			.toContain('width: 22px');
		expect(wrapper.findAll('.docs-markdown-indicator__marker')[2].attributes('style'))
			.toContain('width: 16px');
		expect(wrapper.findAll('.docs-markdown-indicator__marker')[3].attributes('style'))
			.toContain('width: 10px');
		expect(markerElements.map(marker => marker.getBoundingClientRect().top)).toEqual(markerTops);
		expect(markerElements.every(marker => !marker.style.top)).toBe(true);

		dispatchPointer(viewport, 'pointerdown', { clientY: 124, pointerId: 7 });
		expect(setPointerCapture).toHaveBeenCalledWith(7);
		expect(scrollTo).toHaveBeenLastCalledWith({ behavior: 'auto', top: 366 });
		dispatchPointer(viewport, 'pointermove', { clientY: 108 });
		expect(scrollTo).toHaveBeenLastCalledWith({ behavior: 'auto', top: 106 });
		dispatchPointer(viewport, 'pointerleave');
		await flushPromises();
		expect(wrapper.find('.docs-markdown-indicator__preview').exists()).toBe(true);
		dispatchPointer(viewport, 'pointerup', { pointerId: 7 });
		expect(releasePointerCapture).toHaveBeenCalledWith(7);
		dispatchPointer(viewport, 'pointerleave');
		await flushPromises();
		expect(wrapper.find('.docs-markdown-indicator__preview').exists()).toBe(false);

		await wrapper.setProps({ indicator: { draggable: false, preview: false } });
		scrollTo.mockClear();
		dispatchPointer(viewport, 'pointerdown', { clientY: 116 });
		dispatchPointer(viewport, 'pointermove', { clientY: 124 });
		await flushPromises();
		expect(scrollTo).not.toHaveBeenCalled();
		expect(wrapper.find('.docs-markdown-indicator__preview').exists()).toBe(false);

		dispatchPointer(viewport, 'pointerdown', { button: 2, clientY: 116 });
		host.dispatchEvent(new Event('scroll'));
		wrapper.unmount();
		expect(frames.cancel).toHaveBeenCalled();
	});

	it('passes Vue, JavaScript and unnamed fences to shared code previews', async () => {
		const source = [
			'```vue',
			'<template />',
			'```',
			'',
			'```js',
			'const value = 1',
			'```',
			'',
			'```',
			'plain',
			'```'
		].join('\n');
		const wrapper = mount(Markdown, { props: { modelValue: source } });
		await vi.waitFor(() => expect(wrapper.findAll('.docs-code-preview')).toHaveLength(3));

		expect(wrapper.findAll('.docs-code-preview__language').map(item => item.text())).toEqual(['vue', 'js']);
		expect(wrapper.findAll('.docs-code-preview code')[0].html()).toContain('hljs-tag');
		expect(wrapper.findAll('.docs-code-preview code')[1].html()).toContain('hljs-keyword');
		expect(wrapper.findAll('.docs-code-preview code')[2].text()).toBe('plain');
		expect(document.querySelectorAll('#docs-code-preview-style')).toHaveLength(1);
	});

	it('cleans up mounted previews when source changes and the wrapper unmounts', async () => {
		const source = (language: string, value: number) => [
			':::playground',
			'```vue',
			`<template>${value}</template>`,
			'```',
			':::',
			'',
			`\`\`\`${language}`,
			`const value = ${value}`,
			'```'
		].join('\n');
		const wrapper = mount(Markdown, { props: { modelValue: source('js', 1) } });
		await vi.waitFor(() => expect(wrapper.findAll('.docs-code-preview')).toHaveLength(1));
		expect(wrapper.findAll('.docs-code-preview')).toHaveLength(1);
		expect(wrapper.findAll('.playground')).toHaveLength(1);
		const previewElement = wrapper.find('.docs-code-preview').element;

		await wrapper.setProps({ value: 'unrelated' });
		await flushPromises();
		expect(wrapper.find('.docs-code-preview').element).toBe(previewElement);
		expect(codePreviewUnmounted).not.toHaveBeenCalled();
		expect(playgroundUnmounted).not.toHaveBeenCalled();

		await wrapper.setProps({ modelValue: source('ts', 2) });
		await vi.waitFor(() => expect(wrapper.find('.docs-code-preview__language').text()).toBe('ts'));
		expect(wrapper.findAll('.docs-code-preview')).toHaveLength(1);
		expect(wrapper.findAll('.playground')).toHaveLength(1);
		expect(wrapper.find('.docs-code-preview__language').text()).toBe('ts');
		expect(codePreviewUnmounted).toHaveBeenCalledTimes(1);
		expect(playgroundUnmounted).toHaveBeenCalledTimes(1);

		wrapper.unmount();
		expect(codePreviewUnmounted).toHaveBeenCalledTimes(2);
		expect(playgroundUnmounted).toHaveBeenCalledTimes(2);
	});

	it('mounts multi-file props through the directive', async () => {
		const source = runtimeWithConfig(
			'{ entry: \'App.vue\', views: [\'files\', \'runtime\'] }',
			[
				'```vue App.vue',
				'<template>app</template>',
				'```',
				'```ts util.ts',
				'export const value = 1',
				'```'
			].join('\n')
		);
		mount(Markdown, { props: { modelValue: source }, attachTo: document.body });
		await vi.waitFor(() => expect(document.querySelector('.playground')).not.toBeNull());

		const text = document.querySelector('.playground')?.textContent || '';
		expect(text).toContain('-App.vue-');
		expect(text).toContain('"App.vue":"<template>app</template>\\n"');
		expect(text).toContain('"util.ts":"export const value = 1\\n"');
		expect(text).toContain('["files","runtime"]');
	});

	it.each([
		[['runtime'], '["runtime"]'],
		[['files'], '["files"]'],
		[['files', 'runtime'], '["files","runtime"]'],
		[['runtime', 'files'], '["runtime","files"]']
	])('passes playground views %j to Playground', async (views, expected) => {
		const source = runtimeWithConfig(
			`{ views: ${JSON.stringify(views)} }`,
			'```vue\n<template />\n```'
		);
		const wrapper = mount(Markdown, { props: { modelValue: source }, attachTo: document.body });
		await vi.waitFor(() => expect(wrapper.find('.playground').exists()).toBe(true));
		expect(wrapper.find('.playground').text()).toContain(expected);
	});

	it('passes playground viewport props to Playground', async () => {
		const source = runtimeWithConfig(
			`{
				viewport: [375, 667],
				viewportOptions: ['auto', 375, [375, 667], 768],
			}`,
			'```vue\n<template />\n```'
		);
		const wrapper = mount(Markdown, { props: { modelValue: source }, attachTo: document.body });
		await vi.waitFor(() => expect(wrapper.find('.playground').exists()).toBe(true));

		const text = wrapper.find('.playground').text();
		expect(text).toContain('[375,667]');
		expect(text).toContain('["auto",375,[375,667],768]');
	});

	it('passes playground preview inset to Playground', async () => {
		const source = runtimeWithConfig(
			'{ previewInset: [8, 16] }',
			'```vue\n<template />\n```'
		);
		const wrapper = mount(Markdown, { props: { modelValue: source }, attachTo: document.body });
		await vi.waitFor(() => expect(wrapper.find('.playground').exists()).toBe(true));

		expect(wrapper.find('.playground').text()).toContain('[8,16]');
	});

	it('passes playground expandable to Playground', async () => {
		const enabled = mount(Markdown, {
			props: {
				modelValue: runtimeWithConfig('{ expandable: true }', '```vue\n<template />\n```')
			},
			attachTo: document.body
		});
		await vi.waitFor(() => expect(enabled.find('.playground').exists()).toBe(true));
		expect(enabled.find('.playground').text()).toContain('true');
		enabled.unmount();

		const fixed = mount(Markdown, {
			props: {
				modelValue: runtimeWithConfig('{ expandable: 600 }', '```vue\n<template />\n```')
			},
			attachTo: document.body
		});
		await vi.waitFor(() => expect(fixed.find('.playground').exists()).toBe(true));
		expect(fixed.find('.playground').text()).toContain('600');
		fixed.unmount();
	});

	it('ignores inline playground props on the opening line', () => {
		const html = MarkdownRenderer.render([
			':::playground { "views": ["files"], "entry": "missing.js" }',
			'```vue',
			'<template />',
			'```',
			':::'
		].join('\n'));

		expect(html).toContain('data-playground');
		expect(html).toContain('data-props="{}"');
		expect(html).not.toContain('files');
	});

	it('ignores plain HTML comments without a json5 config', () => {
		const html = MarkdownRenderer.render([
			':::playground',
			'<!-- note only -->',
			'```vue',
			'<template />',
			'```',
			':::'
		].join('\n'));

		expect(html).toContain('data-playground');
		expect(html).toContain('data-props="{}"');
	});

	it('reports invalid multi-file declarations', () => {
		const missingName = MarkdownRenderer.render(':::playground\n```vue App.vue\n<template />\n```\n```ts\ncode\n```\n:::');
		const duplicateName = MarkdownRenderer.render(':::playground\n```vue App.vue\na\n```\n```vue App.vue\nb\n```\n:::');
		const missingEntry = MarkdownRenderer.render(runtimeWithConfig(
			'{ entry: \'main.js\' }',
			'```vue App.vue\na\n```'
		));

		expect(missingName).toContain('每个代码块都必须声明文件名');
		expect(duplicateName).toContain('文件名 App.vue 重复');
		expect(missingEntry).toContain('入口文件 main.js 不存在');
	});

	it('reports invalid playground views', () => {
		const render = (config: string) => MarkdownRenderer.render(
			runtimeWithConfig(config, '```vue\n<template />\n```')
		);

		expect(render('{ views: [] }')).toContain('views 必须是非空数组');
		expect(render('{ views: \'runtime\' }')).toContain('views 必须是非空数组');
		expect(render('{ views: [\'unknown\'] }')).toContain('views 不支持 unknown');
		expect(render('{ views: [\'runtime\', \'runtime\'] }')).toContain('views 不能重复声明 runtime');
		expect(render('{ view: \'files\' }')).toContain('不支持 view 参数');
	});

	it('reports invalid playground viewport declarations', () => {
		const render = (config: string) => MarkdownRenderer.render(
			runtimeWithConfig(config, '```vue\n<template />\n```')
		);

		expect(render('{ viewport: \'mobile\' }')).toContain('viewport 必须是 auto、正数宽度或 [宽,高]');
		expect(render('{ viewport: 0 }')).toContain('viewport 必须是 auto、正数宽度或 [宽,高]');
		expect(render('{ viewport: [375] }')).toContain('viewport 必须是 auto、正数宽度或 [宽,高]');
		expect(render('{ viewportOptions: \'auto\' }')).toContain('viewportOptions 必须是数组');
		expect(render('{ viewportOptions: [\'auto\', 0] }'))
			.toContain('viewportOptions[1] 必须是 auto、正数宽度或 [宽,高]');
		expect(render('{ viewportOptions: [\'auto\', \'auto\'] }'))
			.toContain('viewportOptions 不能重复声明 auto');
		expect(render('{ viewportOptions: [] }')).toContain('data-playground');
	});

	it('reports invalid playground preview inset declarations', () => {
		const render = (config: string) => MarkdownRenderer.render(
			runtimeWithConfig(config, '```vue\n<template />\n```')
		);
		const error = 'previewInset 必须是非负数或 [垂直,水平] 非负数数组';

		expect(render('{ previewInset: -1 }')).toContain(error);
		expect(render('{ previewInset: Infinity }')).toContain(error);
		expect(render('{ previewInset: [8] }')).toContain(error);
		expect(render('{ previewInset: [8, -1] }')).toContain(error);
		expect(render('{ previewInset: [8, "16"] }')).toContain(error);
	});

	it('reports invalid playground expandable declarations', () => {
		const render = (config: string) => MarkdownRenderer.render(
			runtimeWithConfig(config, '```vue\n<template />\n```')
		);
		const error = 'expandable 必须是 true 或正数';

		expect(render('{ expandable: false }')).toContain(error);
		expect(render('{ expandable: 0 }')).toContain(error);
		expect(render('{ expandable: -1 }')).toContain(error);
		expect(render('{ expandable: \'auto\' }')).toContain(error);
		expect(render('{ expandable: true }')).toContain('data-playground');
		expect(render('{ expandable: 600 }')).toContain('data-playground');
	});

	it('supports empty input, malformed config and multiple markdown instances', async () => {
		const malformed = mount(Markdown, {
			props: {
				value: runtimeWithConfig('{ views: [', '```vue\ndemo\n```')
			},
			attachTo: document.body
		});
		mount(Markdown, {
			props: { value: ':::playground\n```vue\nsecond\n```\n:::' },
			attachTo: document.body
		});
		await vi.waitFor(() => expect(document.querySelectorAll('.playground')).toHaveLength(2));
		expect(document.querySelectorAll('.playground')).toHaveLength(2);
		expect(document.body.innerHTML).toContain('data-props="{}"');

		await malformed.setProps({ value: '' });
		expect(malformed.find('.docs-markdown-reset').text()).toBe('');
	});

	it('keeps an explicitly empty modelValue ahead of the value fallback', async () => {
		const wrapper = mount(Markdown, {
			props: { modelValue: '', value: '# Fallback' }
		});
		expect(wrapper.find('h1').exists()).toBe(false);

		await wrapper.setProps({ modelValue: undefined });
		await vi.waitFor(() => expect(wrapper.find('h1').text()).toContain('Fallback'));
	});
});
