import { Gateway } from '../../network';
import {
	createResourceIdentity,
	getDefaultLanguage,
	getDocsNamespace,
	resourceIdentityKey
} from '../../utils/resolver';
import {
	collectResourceImports,
	isSupportedDependency,
	resolveDependencyUrl,
	toLogicalResourceSource
} from '../../utils/resource-graph';
import { getDocsConfig } from '../../utils/runtime';

const SLOT_NAMES = ['content', 'sidebar', 'header', 'footer', 'extra'];

const getLanguages = config => (
	Object.keys(config.locales).length
		? Object.keys(config.locales)
		: [getDefaultLanguage(config)]
);

const classify = (source) => {
	if (/\.json(?:$|[?#])/i.test(source)) return 'sidebar';
	if (/\.vue(?:$|[?#])/i.test(source)) return 'sfc';
	if (/\.css(?:$|[?#])/i.test(source)) return 'style';
	if (/\.[jt]s(?:$|[?#])/i.test(source)) return 'module';
	return 'markdown';
};

const getRouteScore = pattern => pattern.split('/').filter(Boolean).reduce(
	(score, part) => score + (part === '*' ? 0 : part.startsWith(':') ? 1 : 2),
	0
);

const matchRoute = (routes, pathname) => {
	const target = pathname.split('/').filter(Boolean);
	const candidates = [];
	for (const [pattern, config] of Object.entries(routes)) {
		if (!config || pattern === '*') continue;
		const parts = pattern.split('/').filter(Boolean);
		if (parts.length !== target.length && !parts.includes('*')) continue;
		const params = {};
		const matches = parts.every((part, index) => {
			if (part === '*') return true;
			if (part.startsWith(':')) {
				params[part.slice(1)] = target[index];
				return true;
			}
			return part === target[index];
		});
		if (matches) candidates.push({
			config,
			params,
			pattern,
			score: getRouteScore(pattern)
		});
	}
	if (candidates.length) {
		candidates.sort((left, right) => right.score - left.score);
		return candidates[0];
	}
	const fallback = routes['*'];
	return fallback ? { config: fallback, params: {}, pattern: '*' } : null;
};

const createRouteShape = (lang, pathname, params = {}) => {
	const normalizedPath = `/${pathname.split('/').filter(Boolean).join('/')}`;
	const localizedPath = `/${lang}${normalizedPath === '/' ? '' : normalizedPath}`;
	return {
		path: localizedPath,
		fullPath: localizedPath,
		params: { ...params, lang },
		query: {},
		hash: '',
		matched: [],
		meta: {},
		name: undefined,
		redirectedFrom: undefined
	};
};

const getRedirectPath = (config, lang, target) => {
	if (typeof target !== 'string' || !target) return null;
	if (/^[a-z][a-z\d+.-]*:/i.test(target) || target.startsWith('//')) return null;
	const pathname = target.split(/[?#]/u, 1)[0];
	const segments = pathname.split('/').filter(Boolean);
	if (
		segments[0] === lang
		|| Object.prototype.hasOwnProperty.call(config.locales, segments[0])
	) segments.shift();
	return `/${segments.join('/')}`;
};

/*
 * 收集资源前先解析重定向。sidebar 可能有意展示别名而非目标地址；若此时
 * 清理目标资源，就会删除仍可通过路由访问的内容。
 */
const resolveRouteMatch = (config, lang, pathname) => {
	let currentPath = getRedirectPath(config, lang, pathname);
	const visited = new Set();
	while (currentPath !== null) {
		if (visited.has(currentPath)) {
			throw new Error(`Cannot build a complete prefetch plan: redirect cycle (${currentPath})`);
		}
		visited.add(currentPath);
		if (currentPath === '/' && !config.routes['/']) {
			return { config: { content: 'default' }, params: {}, pathname: currentPath };
		}
		const match = matchRoute(config.routes, currentPath);
		if (!match) return null;
		if (typeof match.config === 'object') return { ...match, pathname: currentPath };
		const route = createRouteShape(lang, currentPath, match.params);
		const target = typeof match.config === 'function'
			? match.config(route)
			: match.config;
		currentPath = getRedirectPath(config, lang, target);
	}
	return null;
};

// sidebar value 以先序遍历定义路由优先级：先父节点，再依次访问子树。
// 数据库表格和预加载计划共用该顺序。
const getSidebarValuesDepthFirst = (items, values = []) => {
	if (!Array.isArray(items)) return values;
	items.forEach((item) => {
		if (typeof item?.value === 'string') values.push(item.value);
		getSidebarValuesDepthFirst(item?.children, values);
	});
	return values;
};

const createCollector = (config) => {
	const identities = new Map();
	const add = (lang, source) => {
		if (typeof source !== 'string' || !source || source === 'default') return null;
		const identity = createResourceIdentity(config, lang, classify(source), source);
		const key = resourceIdentityKey(identity);
		if (identities.has(key)) return null;
		identities.set(key, identity);
		return identity;
	};
	return { identities, add };
};

const addRouteContent = async (config, collector, lang, pathname, routeMatch) => {
	if (!routeMatch) return;
	const route = createRouteShape(lang, pathname, routeMatch.params);
	const slot = typeof routeMatch.config.content === 'undefined'
		? 'default'
		: routeMatch.config.content;
	if (slot === null) return;
	if (slot !== 'default') {
		collector.add(lang, slot);
		return;
	}
	const params = Object.values(routeMatch.params).filter(Boolean);
	const value = typeof routeMatch.config.value === 'function'
		? routeMatch.config.value(route)
		: routeMatch.config.value || params.at(-1)
			|| pathname.split('/').filter(Boolean).at(-1) || 'index';
	const source = await config.resolve?.markdown?.({ lang, value, route }) || `./${value}.md`;
	collector.add(lang, source);
};

const collectConfiguredResources = async (config, collector) => {
	for (const lang of getLanguages(config)) {
		if (!config.routes['/']) {
			await addRouteContent(config, collector, lang, '/', {
				config: { content: 'default' },
				params: {}
			});
		}
		for (const [pathname, routeConfig] of Object.entries(config.routes)) {
			if (!routeConfig || pathname === '*') continue;
			if (typeof routeConfig !== 'object') {
				if (typeof routeConfig === 'string' || !pathname.includes(':')) {
					const match = resolveRouteMatch(config, lang, pathname);
					if (match) await addRouteContent(
						config,
						collector,
						lang,
						match.pathname,
						match
					);
				}
				continue;
			}
			SLOT_NAMES.forEach((name) => {
				const source = name === 'sidebar' && routeConfig[name] === 'default'
					? './sidebar.json'
					: routeConfig[name];
				collector.add(lang, source);
			});
			if (
				(!pathname.includes(':') && !pathname.includes('*'))
				|| typeof routeConfig.value === 'string'
			) {
				await addRouteContent(config, collector, lang, pathname, {
					config: routeConfig,
					params: {}
				});
			}
		}
	}
};

const needsSidebarDiscovery = config => Object.entries(config.routes).some(([path, route]) => (
	(path.includes(':') || path.includes('*'))
	&& route
	&& (
		typeof route === 'function'
		|| (
			typeof route === 'object'
			&& (typeof route.content === 'undefined' || route.content === 'default')
			&& typeof route.value !== 'string'
		)
	)
));

const collectSidebarResources = async (config, collector, records, expectedKeys) => {
	const parsedKeys = new Set();
	const recordsByKey = new Map(records.map(record => [
		resourceIdentityKey(record.identity),
		record
	]));
	// 遍历预期 sidebar，而不是 IndexedDB 行；即使缓存访问时间变化，
	// 语言和配置顺序也能保持确定。
	for (const key of expectedKeys) {
		const record = recordsByKey.get(key);
		if (!record || typeof record.content !== 'string') continue;
		let items;
		try {
			items = JSON.parse(record.content);
		} catch {
			continue;
		}
		if (!Array.isArray(items)) continue;
		parsedKeys.add(key);
		for (const pathname of getSidebarValuesDepthFirst(items)) {
			const routeMatch = resolveRouteMatch(config, record.identity.lang, pathname);
			await addRouteContent(
				config,
				collector,
				record.identity.lang,
				routeMatch?.pathname || pathname,
				routeMatch
			);
		}
	}
	return parsedKeys;
};

/*
 * 根据路由配置构建先序资源图。依赖紧跟在 importer 之后，使
 * `entry -> child -> grandchild` 保持连续，而不是被展平成广度优先请求批次。
 */
const collectResourcesDepthFirst = async (config, collector, records) => {
	const recordsByKey = new Map(records.map(record => [
		resourceIdentityKey(record.identity),
		record
	]));
	const ordered = [];
	const visited = new Set();
	const visit = async (identity) => {
		const key = resourceIdentityKey(identity);
		if (visited.has(key)) return;
		visited.add(key);
		ordered.push(identity);

		if (!['sfc', 'module', 'style'].includes(identity.type)) return;
		const record = recordsByKey.get(key);
		if (!record || typeof record.content !== 'string') return;
		let imports;
		try {
			imports = await collectResourceImports(record.content, identity.type);
		} catch {
			return;
		}
		for (const specifier of imports.filter(isSupportedDependency)) {
			let source;
			try {
				const url = resolveDependencyUrl(specifier, record.url);
				source = toLogicalResourceSource(config, identity.lang, url);
			} catch {
				continue;
			}
			const candidate = createResourceIdentity(
				config,
				identity.lang,
				classify(source),
				source
			);
			const dependency = collector.add(identity.lang, source)
				|| collector.identities.get(resourceIdentityKey(candidate));
			if (dependency) await visit(dependency);
		}
	};

	for (const identity of [...collector.identities.values()]) await visit(identity);
	return ordered;
};

const collectConfiguredOrder = async (config, records) => {
	const collector = createCollector(config);
	await collectConfiguredResources(config, collector);
	const sidebarKeys = new Set([...collector.identities.values()]
		.filter(identity => identity.type === 'sidebar')
		.map(resourceIdentityKey));
	await collectSidebarResources(config, collector, records, sidebarKeys);
	return collectResourcesDepthFirst(config, collector, records);
};

const summarize = results => ({
	fulfilled: results.filter(result => result.status === 'fulfilled').length,
	rejected: results.filter(result => result.status === 'rejected').length
});

const getRejectedIdentity = (identities, results) => {
	const index = results.findIndex(result => result.status === 'rejected');
	return index >= 0 ? identities[index] : null;
};

const isGraphResource = identity => identity.type !== 'markdown';

const prefetchResources = async (identities) => {
	if (!identities.length) return [];
	return Gateway.prefetch(identities);
};

/*
 * 将每个已加载的 SFC/module/style 展开为 RemoteSfc 使用的同一依赖图。
 * 预加载计划保留该图，避免 prune() 删除仍可从 SFC 入口访问的 JS/CSS 文件。
 */
const collectDependencyResources = async (config, collector, seeds, strict) => {
	const results = [];
	const processed = new Set();
	let queue = seeds;
	while (queue.length) {
		const records = new Map((await Gateway.list()).map(record => [
			resourceIdentityKey(record.identity),
			record
		]));
		const discovered = [];
		for (const identity of queue) {
			const key = resourceIdentityKey(identity);
			if (processed.has(key)) continue;
			processed.add(key);
			const record = records.get(key);
			if (!record || typeof record.content !== 'string') {
				if (strict) throw new Error(`Cannot inspect dependency resource: ${identity.source}`);
				continue;
			}
			let imports;
			try {
				imports = await collectResourceImports(record.content, identity.type);
			} catch (reason) {
				if (strict) throw reason;
				continue;
			}
			for (const specifier of imports.filter(isSupportedDependency)) {
				let source;
				try {
					const url = resolveDependencyUrl(specifier, record.url);
					source = toLogicalResourceSource(config, identity.lang, url);
				} catch (reason) {
					// prune 必须得到可证明完整的依赖图；prefetch 可以跳过异常依赖，
					// 并继续报告其余已准备资源。
					if (strict) throw reason;
					continue;
				}
				const dependency = collector.add(identity.lang, source);
				if (dependency) discovered.push(dependency);
			}
		}
		if (!discovered.length) break;
		const batch = await prefetchResources(discovered);
		results.push(...batch);
		const rejected = getRejectedIdentity(discovered, batch);
		if (strict && rejected) {
			throw new Error(
				`Cannot build a complete prefetch plan: dependency unavailable (${rejected.source})`
			);
		}
		queue = discovered;
	}
	return results;
};

/*
 * 通过以下两种模式之一构建完整静态资源计划：
 *
 * - prefetch 下载包括 Markdown 内容在内的所有资源；
 * - prune 只下载用于描述依赖图的资源。Markdown identity 仍会保留，
 *   但不要求在线文件存在即可证明它属于当前配置。
 *
 * strict 模式仍强制要求 sidebar、可执行资源和样式资源可用，因为其内容可能
 * 暴露更多路由或 import。若任一依赖图来源不可用仍执行清理，可能误删可达缓存依赖。
 */
const buildPrefetchPlan = async ({ strict = false, downloadMarkdown = true } = {}) => {
	const config = getDocsConfig();
	const collector = createCollector(config);
	await collectConfiguredResources(config, collector);
	const initial = [...collector.identities.values()];
	const initialKeys = new Set(collector.identities.keys());
	const sidebarKeys = new Set(initial
		.filter(identity => identity.type === 'sidebar')
		.map(resourceIdentityKey));
	if (strict && needsSidebarDiscovery(config) && !sidebarKeys.size) {
		throw new Error(
			'Cannot build a complete prefetch plan: dynamic routes require a sidebar resource'
		);
	}
	const initialDownloads = downloadMarkdown ? initial : initial.filter(isGraphResource);
	const initialResults = await prefetchResources(initialDownloads);
	const successfulSidebarKeys = new Set(initialDownloads
		.filter((identity, index) => (
			identity.type === 'sidebar' && initialResults[index]?.status === 'fulfilled'
		))
		.map(resourceIdentityKey));
	const parsedSidebarKeys = await collectSidebarResources(
		config,
		collector,
		await Gateway.list(),
		sidebarKeys
	);
	if (strict && [...sidebarKeys].some(key => (
		!successfulSidebarKeys.has(key) || !parsedSidebarKeys.has(key)
	))) {
		throw new Error('Cannot build a complete prefetch plan: sidebar unavailable or invalid');
	}
	const rejectedInitial = getRejectedIdentity(initialDownloads, initialResults);
	if (strict && rejectedInitial) {
		throw new Error(
			`Cannot build a complete prefetch plan: configured resource unavailable (${rejectedInitial.source})`
		);
	}
	const discovered = [...collector.identities]
		.filter(([key]) => !initialKeys.has(key))
		.map(([, identity]) => identity);
	const discoveredDownloads = downloadMarkdown
		? discovered
		: discovered.filter(isGraphResource);
	const discoveredResults = await prefetchResources(discoveredDownloads);
	const rejectedDiscovered = getRejectedIdentity(discoveredDownloads, discoveredResults);
	if (strict && rejectedDiscovered) {
		throw new Error(
			`Cannot build a complete prefetch plan: route resource unavailable (${rejectedDiscovered.source})`
		);
	}
	const dependencySeeds = [...collector.identities.values()].filter(identity => (
		identity.type === 'sfc' || identity.type === 'module' || identity.type === 'style'
	));
	const dependencyResults = await collectDependencyResources(
		config,
		collector,
		dependencySeeds,
		strict
	);
	// 将公开计划规范为 /db 使用的同一深度优先顺序；实际下载仍可保留批处理，
	// 避免牺牲网络并发能力。
	const ordered = await collectResourcesDepthFirst(
		config,
		collector,
		await Gateway.list()
	);
	collector.identities.clear();
	ordered.forEach(identity => collector.identities.set(resourceIdentityKey(identity), identity));
	return {
		config,
		collector,
		results: [...initialResults, ...discoveredResults, ...dependencyResults]
	};
};

export const getList = async () => {
	const records = await Gateway.list();
	let order = [];
	try {
		order = await collectConfiguredOrder(getDocsConfig(), records);
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

// 手动重试沿用持久化 URL，确保 /db 显示地址与实际请求一致，不重新解析。
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
	const { collector, results } = await buildPrefetchPlan();
	const summary = summarize(results);
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
	const { config, collector } = await buildPrefetchPlan({
		strict: true,
		downloadMarkdown: false
	});
	const garbage = await Gateway.prune(
		getDocsNamespace(config),
		[...collector.identities.values()]
	);
	return garbage.length;
};
