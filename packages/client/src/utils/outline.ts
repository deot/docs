import type { InjectionKey, Ref } from 'vue';

export interface OutlineHeading {
	element: HTMLElement;
	id: string;
	level: number;
	text: string;
}

export interface OutlineItem {
	children: OutlineItem[];
	id: string;
	level: number;
	text: string;
}

export const markdownArticleKey: InjectionKey<Ref<HTMLElement | undefined>> = Symbol('docs-markdown-article');

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
export const getOutlineHeadingTitle = (element: HTMLElement) => {
	const clone = element.cloneNode(true) as HTMLElement;
	clone.querySelectorAll('.header-anchor').forEach(node => node.remove());
	return (clone.textContent || '').replace(/\s+/g, ' ').trim();
};

/**
 * 从已渲染的 Markdown 中收集带 id 的标题。
 * 忽略代码块 / Playground 内部标题；有章节标题时不把页面 h1 算进去。
 * @param root Markdown 所在容器。
 * @returns 大纲条目，按出现顺序排列。
 */
export const collectOutlineHeadings = (
	root: ParentNode | null | undefined
): OutlineHeading[] => {
	if (!root || !('querySelectorAll' in root)) return [];
	return [...root.querySelectorAll<HTMLElement>(HEADING_SELECTOR)]
		.filter(element => (
			!element.closest(SKIP_CLOSEST)
			&& Boolean(getOutlineHeadingTitle(element))
		))
		.map(element => ({
			element,
			id: element.id,
			level: Number(element.tagName.slice(1)),
			text: getOutlineHeadingTitle(element)
		}))
		.filter((item, _, headings) => (
			item.level > 1 || headings.every(heading => heading.level === 1)
		));
};

/**
 * 按标题层级把扁平大纲收成树，供嵌套列表渲染。
 * @param headings 扁平标题列表。
 * @returns 嵌套大纲树。
 */
export const buildOutlineTree = (
	headings: Array<Pick<OutlineHeading, 'id' | 'level' | 'text'>>
): OutlineItem[] => {
	const root: OutlineItem[] = [];
	const stack: OutlineItem[] = [];
	for (const heading of headings) {
		const node: OutlineItem = {
			children: [],
			id: heading.id,
			level: heading.level,
			text: heading.text
		};
		while (stack.length && stack[stack.length - 1]!.level >= heading.level) {
			stack.pop();
		}
		const parent = stack[stack.length - 1];
		if (parent) parent.children.push(node);
		else root.push(node);
		stack.push(node);
	}
	return root;
};

/**
 * 把路由 hash 对上 Markdown 标题 id，兼容编码和未编码两种形式。
 * @param hash 当前 hash，可带井号。
 * @param ids 已收集的标题 id。
 * @returns 匹配到的原始 id；没有匹配时为空字符串。
 */
export const matchOutlineHeadingId = (hash: string, ids: Iterable<string>) => {
	const raw = hash.replace(/^#/, '');
	if (!raw) return '';
	let decoded = raw;
	try {
		decoded = decodeURIComponent(raw);
	} catch {
		// 非法百分号序列仍可能与元素原始 id 匹配。
	}
	const candidates = new Set([raw, decoded]);
	try {
		candidates.add(encodeURIComponent(decoded));
	} catch {
		// 编码失败时只比较原始值。
	}
	for (const id of ids) {
		if (candidates.has(id)) return id;
	}
	return '';
};

/**
 * 根据标题相对滚动阈值的位置，选出当前应高亮的大纲条目。
 * @param headings 扁平标题列表。
 * @param options 滚动判定参数。
 * @param options.threshold 滚动容器顶部的判定线，相对视口。
 * @param options.isScrollEnd 是否已经滚到文档末尾。
 * @returns 当前标题 id。
 */
export const findActiveOutlineId = (
	headings: Array<Pick<OutlineHeading, 'id' | 'element'>>,
	options: {
		isScrollEnd?: boolean;
		threshold: number;
	}
) => {
	if (!headings.length) return '';
	if (options.isScrollEnd) return headings[headings.length - 1]!.id;
	let active = headings[0]!.id;
	for (const heading of headings) {
		if (heading.element.getBoundingClientRect().top > options.threshold) break;
		active = heading.id;
	}
	return active;
};

/**
 * 大纲高度不能超过正文实际高度，也不能超出当前 content 可视区域。
 * @param articleHeight 正文列高度。
 * @param viewportHeight 主滚动容器可视高度。
 * @returns 大纲最大高度，单位 px。
 */
export const capOutlineMaxHeight = (articleHeight: number, viewportHeight: number) => {
	const article = Math.max(0, articleHeight);
	const viewport = Math.max(0, viewportHeight);
	if (!article) return viewport;
	if (!viewport) return article;
	return Math.min(article, viewport);
};

/** 大纲上下 padding + 标题行高 + 间距，需从 max-height 中扣除。 */
export const OUTLINE_CHROME = 40 + 96 + 12 + 24;

/**
 * 计算大纲内部 Scroller 高度：内容更短时收缩，绝不超过扣除 chrome 后的可用高度。
 * @param maxHeight 大纲根节点最大高度（含 padding）。
 * @param listSize 大纲列表内容高度。
 * @returns Scroller 高度，单位 px。
 */
export const resolveOutlineScrollerHeight = (maxHeight: number, listSize: number) => {
	const available = Math.max(0, maxHeight - OUTLINE_CHROME);
	if (!available) return 0;
	if (listSize > 0) return Math.min(listSize, available);
	return Math.min(48, available);
};
