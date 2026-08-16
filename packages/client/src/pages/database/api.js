import { Gateway } from '../../modules';
import { ResourcePlan } from '../../modules/resource-plan';
import { getDocsNamespace, resourceIdentityKey } from '../../utils/resolver';
import { getDocsConfig } from '../../utils/runtime';

export const getList = async () => {
	const records = await Gateway.list();
	let order = [];
	try {
		order = await ResourcePlan.collectConfiguredOrder(getDocsConfig(), records);
	} catch {
		// 异常的自定义 resolver 不能阻止 IndexedDB 诊断；无法推导完整路由计划时，
		// 所有记录都使用垃圾数据的回退排序。
	}
	const rank = new Map(order.map((identity, index) => [resourceIdentityKey(identity), index]));
	return records.sort((a, b) => {
		const aRank = rank.get(resourceIdentityKey(a.identity));
		const bRank = rank.get(resourceIdentityKey(b.identity));
		if (typeof aRank === 'number' && typeof bRank === 'number') return aRank - bRank;
		if (typeof aRank === 'number') return -1;
		if (typeof bRank === 'number') return 1;
		// 历史垃圾数据仍显示在计划之后；用户显式执行 prune 前，
		// 使用稳定的最近访问时间作为回退顺序。
		return (b.accessedAt || 0) - (a.accessedAt || 0)
			|| resourceIdentityKey(a.identity).localeCompare(resourceIdentityKey(b.identity));
	});
};

// 手动重试沿用持久化 URL，确保诊断页显示地址与实际请求一致，不重新解析。
export const reload = async (record) => {
	return Gateway.revalidate(record.identity, {
		url: record.url,
		priority: 100
	});
};

export const reloadAll = async (records) => {
	const results = await Promise.allSettled(records.map(record => (
		Gateway.revalidate(record.identity, {
			url: record.url,
			priority: 50
		})
	)));
	const rejected = results.filter(result => result.status === 'rejected').length;
	if (rejected) throw new Error(`${rejected} records failed to reload`);
};

export const remove = async (record) => {
	await Gateway.invalidate(record.identity);
};

export const clear = async () => {
	await Gateway.clear();
};

export const prefetch = async () => {
	const { collector, results } = await ResourcePlan.build();
	const summary = ResourcePlan.summarize(results);
	return {
		total: collector.identities.size,
		...summary
	};
};

/*
 * 仅在 strict 依赖图构建完成后执行 prune。Markdown 是声明式叶子数据，
 * 清理时只保留 identity，无需重新下载文件；sidebar/SFC/import 失败仍会
 * 中止清理，因为此时保留集可能不完整。
 */
export const prune = async () => {
	const { config, collector } = await ResourcePlan.build({
		strict: true,
		downloadMarkdown: false
	});
	const garbage = await Gateway.prune(
		getDocsNamespace(config),
		[...collector.identities.values()]
	);
	return garbage.length;
};
