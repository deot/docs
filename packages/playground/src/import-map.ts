/**
 * 站点级同步内存：`$docs.modules` / `$docs.styles` 与管理页 import、CSS 覆盖。
 */

const normalize = (value: string) => value.trim();

// 只接受 `http://` / `https://` 或单斜杠根路径。`javascript:` / `data:` / `//…` 都不安全。
export const isSafePlaygroundHref = (href: string) => {
	const next = href.trim();
	if (!next) return false;
	if (/^https?:\/\//iu.test(next)) return true;
	return next.startsWith('/') && !next.startsWith('//');
};

export const filterSafeHrefs = (value: Record<string, string | undefined> = {}) => (
	Object.fromEntries(
		Object.entries(value).filter((entry): entry is [string, string] => (
			typeof entry[1] === 'string' && isSafePlaygroundHref(entry[1])
		))
	)
);

const sanitizeMap = (value: Record<string, string> = {}) => (
	filterSafeHrefs(Object.fromEntries(
		Object.entries(value)
			.map(([alias, url]) => [normalize(alias), normalize(url)])
			.filter(([alias]) => Boolean(alias))
	))
);

// 四份 map 共用的读写。apply 写入空或不安全地址等于删除该 key。
const createMapStore = () => {
	let data: Record<string, string> = {};
	const snapshot = () => ({ ...data });
	const drop = (alias: string) => {
		if (data[alias] === undefined) return snapshot();
		const next = { ...data };
		delete next[alias];
		data = next;
		return snapshot();
	};
	return {
		get: snapshot,
		set: (value: Record<string, string> = {}) => {
			data = sanitizeMap(value);
		},
		apply: (alias: string, url: string) => {
			const nextAlias = normalize(alias);
			const nextUrl = normalize(url);
			if (!nextAlias) return snapshot();
			if (!isSafePlaygroundHref(nextUrl)) return drop(nextAlias);
			data = { ...data, [nextAlias]: nextUrl };
			return snapshot();
		},
		remove: (alias: string) => {
			const nextAlias = normalize(alias);
			return nextAlias ? drop(nextAlias) : snapshot();
		}
	};
};

const siteModules = createMapStore();
const siteStyles = createMapStore();
const importOverrides = createMapStore();
const styleOverrides = createMapStore();

/**
 * 站点默认 import。合并时夹在内置 CDN 与实例 `builtinImportMap` 之间。
 */
export const getPlaygroundSiteModules = siteModules.get;
export const setPlaygroundSiteModules = siteModules.set;

/**
 * 站点默认预览 CSS。合并时夹在内置样式表与管理页覆盖之间。
 */
export const getPlaygroundSiteStyles = siteStyles.get;
export const setPlaygroundSiteStyles = siteStyles.set;

export const getPlaygroundImportMapOverrides = importOverrides.get;
export const setPlaygroundImportMapOverrides = importOverrides.set;
export const applyPlaygroundImportMapOverride = importOverrides.apply;
export const removePlaygroundImportMapOverride = importOverrides.remove;

export const getPlaygroundStyleOverrides = styleOverrides.get;
export const setPlaygroundStyleOverrides = styleOverrides.set;
export const applyPlaygroundStyleOverride = styleOverrides.apply;
export const removePlaygroundStyleOverride = styleOverrides.remove;

export const clearPlaygroundMaps = () => {
	[siteModules, siteStyles, importOverrides, styleOverrides].forEach(store => store.set());
};
