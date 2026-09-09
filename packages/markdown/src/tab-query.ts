import type { InjectionKey } from 'vue';

/**
 * Markdown `:::tabs` 与 URL `?tab=` 的读写适配器。
 * 独立 `createApp` 挂载的 TabsNav 拿不到文档壳 Router，因此通过适配器注入。
 */
export interface MarkdownTabQueryAdapter {
	get: () => string;
	set: (tab: string) => void;
	/**
	 * 可选：监听 URL 变化（如浏览器前进后退）。返回取消订阅函数。
	 */
	subscribe?: (listener: () => void) => () => void;
}

export const markdownTabQueryKey: InjectionKey<MarkdownTabQueryAdapter> = Symbol('docs-markdown-tab-query');

const TAB_QUERY = 'tab';

/**
 * 不依赖 Vue Router 的默认适配器：读写 `location.search` 的 `tab`，
 * 并用 `history.replaceState` 更新（供 examples / 单测使用）。
 * @returns 可注入 TabsNav 的 get/set/subscribe 适配器。
 */
export const createHistoryTabQueryAdapter = (): MarkdownTabQueryAdapter => {
	const read = () => {
		try {
			return new URLSearchParams(window.location.search).get(TAB_QUERY) || '';
		} catch {
			return '';
		}
	};
	const write = (tab: string) => {
		try {
			const url = new URL(window.location.href);
			if (tab) url.searchParams.set(TAB_QUERY, tab);
			else url.searchParams.delete(TAB_QUERY);
			window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
		} catch {
			// 非浏览器或受限环境忽略。
		}
	};
	return {
		get: read,
		set: write,
		subscribe: (listener) => {
			const onPopState = () => listener();
			window.addEventListener('popstate', onPopState);
			return () => window.removeEventListener('popstate', onPopState);
		}
	};
};
