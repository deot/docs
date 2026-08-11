import { parseMarkdownSearchSections } from '@deot/docs-markdown';
import { buildTranslator, resolveLocale } from '@deot/docs-locale';
import { Gateway } from '../gateway';
import { ResourcePlan } from '../resource-plan';
import { IndexedDBSearchHistory, createSearchHistoryId } from './history';
import { getDocsNamespace, resourceIdentityKey } from '../../utils/resolver';
import { getDocsConfig } from '../../utils/runtime';
import type { SearchHistoryRecord, SearchPreparedDocument, SearchResult } from './types';

export type { SearchHistoryRecord, SearchResult } from './types';

const RESULT_LIMIT = 50;
const normalize = (value: string) => value.normalize('NFKC').toLocaleLowerCase();
const tokenize = (value: string) => normalize(value).split(/\s+/u).filter(Boolean);
const matchesTokens = (value: string, tokens: string[]) => {
	const normalized = normalize(value);
	return tokens.every(token => normalized.includes(token));
};
const getFieldScore = (value: string, keyword: string, tokens: string[], base: number) => {
	const normalized = normalize(value);
	if (!matchesTokens(value, tokens)) return 0;
	if (normalized === keyword) return base + 300;
	if (normalized.startsWith(keyword)) return base + 200;
	if (normalized.includes(keyword)) return base + 100;
	return base;
};
const createExcerpt = (value: string, tokens: string[]) => {
	if (!value) return '';
	const normalized = normalize(value);
	const positions = tokens
		.map(token => normalized.indexOf(token))
		.filter(position => position >= 0);
	const position = positions.length ? Math.min(...positions) : 0;
	const start = Math.max(0, position - 45);
	const end = Math.min(value.length, start + 140);
	return `${start ? '…' : ''}${value.slice(start, end).trim()}${end < value.length ? '…' : ''}`;
};

class SearchManager {
	private history = new IndexedDBSearchHistory();

	private parsed = new Map<string, SearchPreparedDocument>();

	private documents = new Map<string, SearchPreparedDocument[]>();

	/**
	 * 从 Gateway 当前快照准备指定语言索引。identity 与 hash 未变化时复用
	 * Markdown 解析结果，仅重新绑定可能变化的站内路由。
	 * @param lang 当前文档语言。
	 * @returns 可搜索的文档数量。
	 */
	async prepare(lang: string) {
		const config = getDocsConfig();
		const namespace = getDocsNamespace(config);
		const t = buildTranslator(resolveLocale(lang, config.locales));
		const records = await Gateway.list();
		const routes = await ResourcePlan.collectRouteResources(config, records);
		const routeMap = new Map(routes.map(item => [resourceIdentityKey(item.identity), item.path]));
		const documents: SearchPreparedDocument[] = [];

		for (const record of records) {
			if (record.identity.namespace !== namespace
				|| record.identity.lang !== lang
				|| record.identity.type !== 'markdown'
				|| typeof record.content !== 'string') continue;
			const key = resourceIdentityKey(record.identity);
			const path = routeMap.get(key);
			if (!path) continue;
			const cached = this.parsed.get(key);
			if (cached && cached.hash === record.hash) {
				documents.push({ ...cached, path });
				continue;
			}
			const parsed = parseMarkdownSearchSections(record.content);
			const fallbackTitle = record.identity.source
				.split('/').at(-1)?.replace(/\.(?:md|markdown)$/iu, '')
				|| t('client.search.untitled');
			const document: SearchPreparedDocument = {
				key,
				hash: record.hash || '',
				namespace,
				lang,
				path,
				source: record.identity.source,
				title: parsed.title || fallbackTitle,
				text: parsed.text,
				sections: parsed.sections
					.filter((section, index) => !(
						index === 0
						&& section.level === 1
						&& section.title === parsed.title
					))
					.map(section => ({
						title: section.title,
						anchor: section.anchor,
						text: section.text
					}))
			};
			this.parsed.set(key, document);
			documents.push(document);
		}

		this.documents.set(`${namespace}|${lang}`, documents);
		return documents.length;
	}

	/**
	 * 返回最近一次 prepare 为当前 namespace 和语言建立的文档数量。
	 * 查询内部会先刷新索引，因此调用方可用它同步空状态，而无需再次读取 IndexedDB。
	 * @param lang 当前文档语言。
	 * @returns 当前内存索引中的文档数量。
	 */
	getPreparedCount(lang: string) {
		const namespace = getDocsNamespace(getDocsConfig());
		return this.documents.get(`${namespace}|${lang}`)?.length || 0;
	}

	async query(lang: string, value: string) {
		const tokens = tokenize(value);
		if (!tokens.length) return [];
		const keyword = tokens.join(' ');
		await this.prepare(lang);
		const namespace = getDocsNamespace(getDocsConfig());
		const documents = this.documents.get(`${namespace}|${lang}`) || [];
		const results: SearchResult[] = [];

		for (const document of documents) {
			const titleScore = getFieldScore(document.title, keyword, tokens, 1000);
			const bodyScore = matchesTokens(`${document.title} ${document.text}`, tokens) ? 200 : 0;
			if (titleScore || bodyScore) {
				results.push({
					id: createSearchHistoryId({ ...document, hash: '' }),
					kind: 'document',
					namespace: document.namespace,
					lang: document.lang,
					path: document.path,
					hash: '',
					title: document.title,
					source: document.source,
					excerpt: createExcerpt(document.text, tokens),
					score: titleScore || bodyScore
				});
			}
			for (const section of document.sections) {
				const headingScore = getFieldScore(section.title, keyword, tokens, 600);
				const textScore = matchesTokens(`${section.title} ${section.text}`, tokens) ? 100 : 0;
				if (!headingScore && !textScore) continue;
				const hash = section.anchor ? `#${section.anchor}` : '';
				results.push({
					id: createSearchHistoryId({ ...document, hash }),
					kind: 'section',
					namespace: document.namespace,
					lang: document.lang,
					path: document.path,
					hash,
					title: document.title,
					sectionTitle: section.title,
					source: document.source,
					excerpt: createExcerpt(section.text, tokens),
					score: headingScore || textScore
				});
			}
		}

		return results.sort((left, right) => (
			right.score - left.score
			|| left.title.localeCompare(right.title)
			|| (left.sectionTitle || '').localeCompare(right.sectionTitle || '')
		)).slice(0, RESULT_LIMIT);
	}

	listHistory(lang: string): Promise<SearchHistoryRecord[]> {
		return this.history.list(getDocsNamespace(getDocsConfig()), lang);
	}

	record(result: SearchResult | SearchHistoryRecord) {
		return this.history.record(result);
	}

	togglePinned(id: string) {
		return this.history.togglePinned(id);
	}

	removeHistory(id: string) {
		return this.history.remove(id);
	}
}

/** Client 搜索入口只保存可复用解析缓存，不保存弹层会话状态。 */
export const Search = new SearchManager();
