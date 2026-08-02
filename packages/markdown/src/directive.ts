import { createApp, h } from 'vue';
import { Clipboard } from '@deot/vc';
import hljs from 'highlight.js';
import * as DocsPlayground from '@deot/docs-playground';
import { Markdown } from './markdown';

const TAB_REPLACE_RE = /^(<[^>]+>|\t)+/gm;
const hljsPlugin = {
	'after:highlight': (e) => {
		e.value = e.value.replace(TAB_REPLACE_RE, (m: string) =>
			m.replace(/\t/g, '    ')
		);
	},
	'after:highlightElement': (e) => {
		const { el, text } = e;
		const root = document.createElement('div');
		const app = createApp(() => h(Clipboard, {
			value: text,
			style: {
				position: 'absolute',
				top: '3px',
				right: '5px',
				cursor: 'pointer'
			}
		}, '复制'));
		app.mount(root);
		el.appendChild(root);
	}
};

hljs.addPlugin(hljsPlugin);
DocsPlayground.registerVueHighlight(hljs);

export const vMarkdown = (el: any, binding: any) => {
	const source = binding.value;
	let result = '';
	if (source) {
		result = Markdown.render(source);
	}

	el.innerHTML = result;

	const palygrounds = el.querySelectorAll('div[data-playground]');
	[...palygrounds].forEach((it) => {
		const code = it.dataset.code;
		let files;
		let propsData = {};
		try {
			propsData = JSON.parse(it.dataset.props || '{}');
		} catch { /* empty */ };
		try {
			files = it.dataset.files ? JSON.parse(it.dataset.files) : undefined;
		} catch { /* empty */ }
		const runtimeProps = files
			? { files, entry: it.dataset.entry }
			: { modelValue: code };
		const app = createApp(() => h(DocsPlayground.Playground, {
			...(typeof propsData === 'object' ? propsData : {}),
			...runtimeProps
		}));
		app.mount(it);
	});

	const blocks = el.querySelectorAll('pre code:not(.hljs)');
	[...blocks].forEach((block) => {
		hljs.highlightElement(block);
	});
};
