import { createApp, h } from 'vue';
import hljs from 'highlight.js';

import { Markdown } from './utils';
import Playground from '../playground.vue';

hljs.configure({
	// 一个缩进为四空格
	tabReplace: '    '
});

export const vMarkdown = (el: any, binding: any) => {
	const source = binding.value;
	let result = '';
	if (source) {
		result = Markdown.render(source);
	}

	el.innerHTML = result;

	const palygrounds = el.querySelectorAll('div[data-code]');
	[...palygrounds].forEach((it) => {
		const code = it.dataset.code;
		const app = createApp(() => h(Playground, { source: code }));
		app.mount(`#${it.id}`);
	});

	const blocks = el.querySelectorAll('pre code:not(.hljs)');
	[...blocks].forEach((block) => {
		hljs.highlightBlock(block);
	});
};
