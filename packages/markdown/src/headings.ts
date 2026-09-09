export interface MarkdownHeading {
	element: HTMLElement;
	id: string;
	level: number;
	text: string;
}

const HEADING_SELECTOR = 'h1[id], h2[id], h3[id], h4[id], h5[id], h6[id]';
const SKIP_CLOSEST = [
	'pre',
	'.docs-markdown-code-preview',
	'[data-playground][data-code]',
	'[data-playground][data-files]',
	'.docs-markdown-tabs__panel[hidden]'
].join(', ');

/**
 * 去掉 markdown-it-anchor 的井号后，读取标题的可见文案。
 * @param element 当前标题节点。
 * @returns 单行章节标题。
 */
export const getMarkdownHeadingTitle = (element: HTMLElement) => {
	const clone = element.cloneNode(true) as HTMLElement;
	clone.querySelectorAll('.header-anchor').forEach(node => node.remove());
	return (clone.textContent || '').replace(/\s+/g, ' ').trim();
};

/**
 * 从已渲染的 Markdown 中收集带 id 的标题，规则与文档壳大纲一致：
 * 忽略代码块 / Playground 内部标题；有章节标题时不把页面 h1 算进去。
 * @param root Markdown 所在容器。
 * @returns 大纲条目，按出现顺序排列。
 */
export const collectMarkdownHeadings = (
	root: ParentNode | null | undefined
): MarkdownHeading[] => {
	if (!root || !('querySelectorAll' in root)) return [];
	return [...root.querySelectorAll<HTMLElement>(HEADING_SELECTOR)]
		.filter(element => (
			!element.closest(SKIP_CLOSEST)
			&& Boolean(getMarkdownHeadingTitle(element))
		))
		.map(element => ({
			element,
			id: element.id,
			level: Number(element.tagName.slice(1)),
			text: getMarkdownHeadingTitle(element)
		}))
		.filter((item, _, headings) => (
			item.level > 1 || headings.every(heading => heading.level === 1)
		));
};
