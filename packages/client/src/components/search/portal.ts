import { Portal } from '@deot/vc';
import SearchWrapper from './search.vue';

/**
 * 搜索弹层与 Playground Editor 使用相同的 Portal 生命周期。
 * 单例会先销毁旧弹层，确保 Header 中始终只有一个搜索会话。
 */
export const DocsSearch = new Portal(SearchWrapper, {
	name: 'docs-search',
	leaveDelay: 0,
	multiple: false
});
