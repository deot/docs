import type { LocationQuery } from 'vue-router';

/**
 * 复制 query 并去掉指定键，用于比较「内容导航」相关的 query 是否变化。
 * @param query 当前路由 query。
 * @param keys 需要忽略的键，例如 `tab`。
 * @returns 去掉指定键后的普通对象，便于 JSON.stringify。
 */
export const omitRouteQuery = (
	query: LocationQuery,
	keys: string[]
): Record<string, LocationQuery[string]> => {
	const ignored = new Set(keys);
	const next: Record<string, LocationQuery[string]> = {};
	Object.keys(query).forEach((key) => {
		if (ignored.has(key)) return;
		next[key] = query[key];
	});
	return next;
};
