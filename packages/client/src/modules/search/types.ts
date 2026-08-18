import type { MarkdownSearchSection } from '@deot/docs-markdown';

export type SearchSection = Pick<MarkdownSearchSection, 'title' | 'anchor' | 'text'>;

export interface SearchNavigationTarget {
	namespace: string;
	lang: string;
	/**
	 * 已包含语言前缀的站内路径，可直接交给 Vue Router。
	 */
	path: string;
	/**
	 * 标题锚点或 URL fragment，不含 `#`。空字符串表示整篇文档。
	 * 与 `SearchPreparedDocument.hash`（内容指纹）不是同一含义。
	 */
	hash: string;
	title: string;
	sectionTitle?: string;
}

export interface SearchResult extends SearchNavigationTarget {
	id: string;
	/**
	 * 命中整篇文档标题/正文，还是某个标题区块。
	 */
	kind: 'document' | 'section';
	/**
	 * 逻辑资源地址，如 `./guide.md`。
	 */
	source: string;
	/**
	 * 围绕第一个命中词截取的可见摘要。
	 */
	excerpt: string;
	/**
	 * 排序分。标题精确匹配高于正文包含。
	 */
	score: number;
}

export interface SearchHistoryRecord extends SearchNavigationTarget {
	id: string;
	/**
	 * 用户是否收藏。收藏项不会被历史上限淘汰。
	 */
	pinned: boolean;
	/**
	 * 最近一次收藏的时间。未收藏时缺省。
	 */
	pinnedAt?: number;
	/**
	 * 最近一次从搜索结果进入该目标的时间。
	 */
	visitedAt: number;
}

export interface SearchPreparedDocument {
	/**
	 * Gateway identity 键，用作解析缓存索引。
	 */
	key: string;
	/**
	 * 资源内容指纹，与 Gateway `record.hash` 对齐；内容未变时可跳过再解析。
	 */
	hash: string;
	namespace: string;
	lang: string;
	path: string;
	source: string;
	title: string;
	/**
	 * 去掉标题后的可搜索正文。
	 */
	text: string;
	sections: SearchSection[];
}
