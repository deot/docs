import { Gateway } from '../gateway';
import {
	createResourceIdentity,
	getDefaultLanguage,
	resourceIdentityKey
} from '../../utils/resolver';
import {
	collectResourceImports,
	isSupportedDependency,
	resolveDependencyUrl,
	toLogicalResourceSource
} from '../../utils/resource-graph';
import { getDocsConfig } from '../../utils/runtime';
import type { RouteLocationNormalized } from 'vue-router';
import type {
	DocsConfig,
	DocsResourceType,
	DocsRoute,
	DocsRouteConfig,
	ResourceIdentity,
	SidebarItem
} from '../../types';
import type {
	ResourceContentRecord,
	ResourceRecord
} from '../gateway/types';

const SLOT_NAMES = ['content', 'sidebar', 'header', 'footer', 'extra'] as const;

type ResourceResult = PromiseSettledResult<ResourceContentRecord>;
type PrefetchResources = (identities: ResourceIdentity[]) => Promise<ResourceResult[]>;

interface RouteCandidate {
	config: DocsRouteConfig;
	params: Record<string, string | string[]>;
	pattern: string;
	score: number;
}

interface RouteContentMatch {
	config: DocsRoute;
	params: Record<string, string | string[]>;
}

interface RouteMatch extends RouteContentMatch {
	pathname: string;
	pattern?: string;
}

interface ResourceCollector {
	identities: Map<string, ResourceIdentity>;
	add: (lang: string, source: unknown) => ResourceIdentity | null;
}

export interface BuildPrefetchPlanOptions {
	config?: DocsConfig;
	downloadMarkdown?: boolean;
	graphFirst?: boolean;
	strict?: boolean;
	prefetchResources?: PrefetchResources;
}

export interface PrefetchPlan {
	config: DocsConfig;
	collector: ResourceCollector;
	results: ResourceResult[];
}

export interface RouteResource {
	identity: ResourceIdentity;
	/** 已包含语言前缀、可直接交给 Vue Router 的站内路径。 */
	path: string;
}

const getLanguages = (config: DocsConfig) => (
	Object.keys(config.locales).length
		? Object.keys(config.locales)
		: [getDefaultLanguage(config)]
);

const classify = (source: string): DocsResourceType => {
	if (/\.json(?:$|[?#])/i.test(source)) return 'sidebar';
	if (/\.vue(?:$|[?#])/i.test(source)) return 'sfc';
	if (/\.css(?:$|[?#])/i.test(source)) return 'style';
	if (/\.[jt]s(?:$|[?#])/i.test(source)) return 'module';
	return 'markdown';
};

const getRouteScore = (pattern: string) => pattern.split('/').filter(Boolean).reduce(
	(score, part) => score + (part === '*' ? 0 : part.startsWith(':') ? 1 : 2),
	0
);

const matchRoute = (
	routes: DocsConfig['routes'],
	pathname: string
): RouteCandidate | null => {
	const target = pathname.split('/').filter(Boolean);
	const candidates: RouteCandidate[] = [];
	for (const [pattern, config] of Object.entries(routes)) {
		if (!config || pattern === '*') continue;
		const parts = pattern.split('/').filter(Boolean);
		if (parts.length !== target.length && !parts.includes('*')) continue;
		const params: Record<string, string | string[]> = {};
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
	return fallback
		? {
				config: fallback,
				// Vue Router 的 catch-all 会把剩余路径作为 pathMatch 数组交给
				// redirect/value 函数；资源计划必须提供同样的 route shape。
				params: { pathMatch: target },
				pattern: '*',
				score: -1
			}
		: null;
};

const createRouteShape = (
	lang: string,
	pathname: string,
	params: Record<string, string | string[]> = {}
): RouteLocationNormalized => {
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
	} as unknown as RouteLocationNormalized;
};

const getRedirectPath = (config: DocsConfig, lang: string, target: unknown) => {
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
const resolveRouteMatch = (
	config: DocsConfig,
	lang: string,
	pathname: string
): RouteMatch | null => {
	let currentPath = getRedirectPath(config, lang, pathname);
	const visited = new Set<string>();
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
		if (typeof match.config === 'object') return {
			config: match.config,
			params: match.params,
			pathname: currentPath,
			pattern: match.pattern
		};
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
const getSidebarValuesDepthFirst = (items: unknown, values: string[] = []) => {
	if (!Array.isArray(items)) return values;
	items.forEach((item) => {
		if (!item || typeof item !== 'object') return;
		const sidebarItem = item as Partial<SidebarItem>;
		if (typeof sidebarItem.value === 'string') values.push(sidebarItem.value);
		getSidebarValuesDepthFirst(sidebarItem.children, values);
	});
	return values;
};

const createCollector = (config: DocsConfig): ResourceCollector => {
	const identities = new Map<string, ResourceIdentity>();
	const add = (lang: string, source: unknown) => {
		if (typeof source !== 'string' || !source || source === 'default') return null;
		const identity = createResourceIdentity(config, lang, classify(source), source);
		const key = resourceIdentityKey(identity);
		if (identities.has(key)) return null;
		identities.set(key, identity);
		return identity;
	};
	return { identities, add };
};

const resolveRouteContentIdentity = async (
	config: DocsConfig,
	lang: string,
	pathname: string,
	routeMatch: RouteContentMatch | null
) => {
	if (!routeMatch) return null;
	const route = createRouteShape(lang, pathname, routeMatch.params);
	const slot = typeof routeMatch.config.content === 'undefined'
		? 'default'
		: routeMatch.config.content;
	if (slot === null) return null;
	if (slot !== 'default') {
		return createResourceIdentity(config, lang, classify(slot), slot);
	}
	const params = Object.values(routeMatch.params).flatMap(value => value).filter(Boolean);
	const value = typeof routeMatch.config.value === 'function'
		? routeMatch.config.value(route)
		: routeMatch.config.value || params.at(-1)
			|| pathname.split('/').filter(Boolean).at(-1) || 'index';
	const source = await config.resolve?.markdown?.({ lang, value, route }) || `./${value}.md`;
	return createResourceIdentity(config, lang, 'markdown', source);
};

const addRouteContent = async (
	config: DocsConfig,
	collector: ResourceCollector,
	lang: string,
	pathname: string,
	routeMatch: RouteContentMatch | null
) => {
	const identity = await resolveRouteContentIdentity(config, lang, pathname, routeMatch);
	if (identity) collector.add(lang, identity.source);
};

const collectConfiguredResources = async (
	config: DocsConfig,
	collector: ResourceCollector
) => {
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

const needsSidebarDiscovery = (config: DocsConfig) => (
	Object.entries(config.routes).some(([path, route]) => (
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
	))
);

const collectSidebarResources = async (
	config: DocsConfig,
	collector: ResourceCollector,
	records: ResourceRecord[],
	expectedKeys: ReadonlySet<string>
) => {
	const parsedKeys = new Set<string>();
	const recordsByKey = new Map<string, ResourceRecord>(records.map(record => [
		resourceIdentityKey(record.identity),
		record
	]));
	// 遍历预期 sidebar，而不是 IndexedDB 行；即使缓存访问时间变化，
	// 语言和配置顺序也能保持确定。
	for (const key of expectedKeys) {
		const record = recordsByKey.get(key);
		if (!record || typeof record.content !== 'string') continue;
		let items: unknown;
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
const collectResourcesDepthFirst = async (
	config: DocsConfig,
	collector: ResourceCollector,
	records: ResourceRecord[]
) => {
	const recordsByKey = new Map<string, ResourceRecord>(records.map(record => [
		resourceIdentityKey(record.identity),
		record
	]));
	const ordered: ResourceIdentity[] = [];
	const visited = new Set<string>();
	const visit = async (identity: ResourceIdentity): Promise<void> => {
		const key = resourceIdentityKey(identity);
		if (visited.has(key)) return;
		visited.add(key);
		ordered.push(identity);

		if (!['sfc', 'module', 'style'].includes(identity.type)) return;
		const record = recordsByKey.get(key);
		if (!record || typeof record.content !== 'string') return;
		let imports: string[];
		try {
			imports = await collectResourceImports(record.content, identity.type);
		} catch {
			return;
		}
		for (const specifier of imports.filter(isSupportedDependency)) {
			let source: string;
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

/**
 * 从当前配置和已缓存的描述资源中生成稳定的深度优先顺序。
 * @param config 当前文档配置。
 * @param records Gateway 已知资源，用于展开 sidebar 和代码依赖。
 * @returns 去重后的逻辑资源顺序。
 */
const collectConfiguredOrder = async (
	config: DocsConfig,
	records: ResourceRecord[]
) => {
	const collector = createCollector(config);
	await collectConfiguredResources(config, collector);
	const sidebarKeys = new Set([...collector.identities.values()]
		.filter(identity => identity.type === 'sidebar')
		.map(resourceIdentityKey));
	await collectSidebarResources(config, collector, records, sidebarKeys);
	return collectResourcesDepthFirst(config, collector, records);
};

const toLocalizedRoutePath = (lang: string, pathname: string) => {
	const normalized = `/${pathname.split('/').filter(Boolean).join('/')}`;
	return `/${lang}${normalized === '/' ? '' : normalized}`;
};

/**
 * 建立可搜索 Markdown identity 与规范站内路由的对应关系。静态路由先于
 * sidebar 动态路由写入，因此同一内容存在别名时会稳定使用配置中的主路径。
 * @param config 当前文档配置。
 * @param records Gateway 已知资源，用于读取 sidebar 的动态路由值。
 * @returns 按语言和配置顺序去重后的 Markdown 路由资源。
 */
const collectRouteResources = async (
	config: DocsConfig,
	records: ResourceRecord[]
) => {
	const resources = new Map<string, RouteResource>();
	const add = async (lang: string, pathname: string) => {
		const match = resolveRouteMatch(config, lang, pathname);
		if (!match) return;
		const identity = await resolveRouteContentIdentity(
			config,
			lang,
			match.pathname,
			match
		);
		if (!identity || identity.type !== 'markdown') return;
		const key = resourceIdentityKey(identity);
		if (!resources.has(key)) resources.set(key, {
			identity,
			path: toLocalizedRoutePath(lang, match.pathname)
		});
	};

	const configured = createCollector(config);
	await collectConfiguredResources(config, configured);
	const sidebarKeys = new Set([...configured.identities.values()]
		.filter(identity => identity.type === 'sidebar')
		.map(resourceIdentityKey));

	for (const lang of getLanguages(config)) {
		await add(lang, '/');
		for (const [pathname, routeConfig] of Object.entries(config.routes)) {
			if (!routeConfig || pathname === '*') continue;
			if (typeof routeConfig === 'object') {
				if (
					(!pathname.includes(':') && !pathname.includes('*'))
					|| typeof routeConfig.value === 'string'
				) await add(lang, pathname);
			} else if (typeof routeConfig === 'string' || !pathname.includes(':')) {
				await add(lang, pathname);
			}
		}
	}

	for (const record of records) {
		if (record.identity.type !== 'sidebar'
			|| !sidebarKeys.has(resourceIdentityKey(record.identity))
			|| typeof record.content !== 'string') continue;
		let items: unknown;
		try {
			items = JSON.parse(record.content);
		} catch {
			continue;
		}
		for (const pathname of getSidebarValuesDepthFirst(items)) {
			await add(record.identity.lang, pathname);
		}
	}

	return [...resources.values()];
};

/**
 * 汇总预加载成功和失败数量，供数据库页面生成操作反馈。
 * @param results Gateway 返回的逐资源 settled 结果。
 * @returns 成功与失败资源的数量。
 */
const summarizePrefetchResults = (results: ResourceResult[]) => ({
	fulfilled: results.filter(result => result.status === 'fulfilled').length,
	rejected: results.filter(result => result.status === 'rejected').length
});

const getRejectedIdentity = (
	identities: ResourceIdentity[],
	results: ResourceResult[]
) => {
	const index = results.findIndex(result => result.status === 'rejected');
	return index >= 0 ? identities[index] : null;
};

const isGraphResource = (identity: ResourceIdentity) => identity.type !== 'markdown';

const prefetchResources = async (
	identities: ResourceIdentity[]
) => {
	if (!identities.length) return [];
	return Gateway.prefetch(identities);
};

/*
 * 将每个已加载的 SFC/module/style 展开为 RemoteSfc 使用的同一依赖图。
 * 预加载计划保留该图，避免 prune() 删除仍可从 SFC 入口访问的 JS/CSS 文件。
 */
const collectDependencyResources = async ({
	config,
	collector,
	seeds,
	strict,
	loadResources
}: {
	config: DocsConfig;
	collector: ResourceCollector;
	seeds: ResourceIdentity[];
	strict: boolean;
	loadResources: PrefetchResources;
}) => {
	const results: ResourceResult[] = [];
	const processed = new Set<string>();
	let queue = seeds;
	while (queue.length) {
		const records = new Map<string, ResourceRecord>((await Gateway.list()).map(record => [
			resourceIdentityKey(record.identity),
			record
		]));
		const discovered: ResourceIdentity[] = [];
		for (const identity of queue) {
			const key = resourceIdentityKey(identity);
			if (processed.has(key)) continue;
			processed.add(key);
			const record = records.get(key);
			if (!record || typeof record.content !== 'string') {
				if (strict) throw new Error(`Cannot inspect dependency resource: ${identity.source}`);
				continue;
			}
			let imports: string[];
			try {
				imports = await collectResourceImports(record.content, identity.type);
			} catch (reason) {
				if (strict) throw reason;
				continue;
			}
			for (const specifier of imports.filter(isSupportedDependency)) {
				let source: string;
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
		const batch = await loadResources(discovered);
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

/**
 * 通过以下两种模式之一构建完整静态资源计划：
 *
 * - prefetch 下载包括 Markdown 内容在内的所有资源；
 * - prune 只下载用于描述依赖图的资源。Markdown identity 仍会保留，
 *   但不要求在线文件存在即可证明它属于当前配置。
 *
 * strict 模式仍强制要求 sidebar、可执行资源和样式资源可用，因为其内容可能
 * 暴露更多路由或 import。若任一依赖图来源不可用仍执行清理，可能误删可达缓存依赖。
 * @param options 计划配置、Gateway 和可选的资源加载策略。
 * @returns 当前配置的资源收集器和每次加载的 settled 结果。
 */
const buildPrefetchPlan = async (
	options: BuildPrefetchPlanOptions = {}
): Promise<PrefetchPlan> => {
	const {
		config = getDocsConfig(),
		downloadMarkdown = true,
		graphFirst = false,
		strict = false
	} = options;
	const loadResources = options.prefetchResources
		|| ((identities: ResourceIdentity[]) => prefetchResources(identities));
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
	const initialDownloads = downloadMarkdown && !graphFirst
		? initial
		: initial.filter(isGraphResource);
	const initialResults = await loadResources(initialDownloads);
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
	const discoveredDownloads = downloadMarkdown && !graphFirst
		? discovered
		: discovered.filter(isGraphResource);
	const discoveredResults = await loadResources(discoveredDownloads);
	const rejectedDiscovered = getRejectedIdentity(discoveredDownloads, discoveredResults);
	if (strict && rejectedDiscovered) {
		throw new Error(
			`Cannot build a complete prefetch plan: route resource unavailable (${rejectedDiscovered.source})`
		);
	}
	const dependencySeeds = [...collector.identities.values()].filter(identity => (
		identity.type === 'sfc' || identity.type === 'module' || identity.type === 'style'
	));
	const dependencyResults = await collectDependencyResources({
		config,
		collector,
		seeds: dependencySeeds,
		strict,
		loadResources
	});
	// 自动空闲预加载先准备描述资源图的 sidebar/SFC/import，再下载 Markdown 叶子。
	// /db 手动预加载仍保持原有批次顺序，避免改变现有交互和统计语义。
	const deferredMarkdown = downloadMarkdown && graphFirst
		? [...collector.identities.values()].filter(identity => identity.type === 'markdown')
		: [];
	const deferredResults = await loadResources(deferredMarkdown);
	const rejectedDeferred = getRejectedIdentity(deferredMarkdown, deferredResults);
	if (strict && rejectedDeferred) {
		throw new Error(
			`Cannot build a complete prefetch plan: route resource unavailable (${rejectedDeferred.source})`
		);
	}
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
		results: [
			...initialResults,
			...discoveredResults,
			...dependencyResults,
			...deferredResults
		]
	};
};

/**
 * 统一封装资源计划能力；实例本身不保存配置或请求状态。
 */
class ResourcePlanner {
	/**
	 * 收集已配置 Markdown 资源及其可导航路由，供本地搜索索引复用。
	 * @param config 当前文档配置。
	 * @param records Gateway 已知资源。
	 * @returns Markdown identity 与本地化路径的稳定映射。
	 */
	collectRouteResources(config: DocsConfig, records: ResourceRecord[]) {
		return collectRouteResources(config, records);
	}

	/**
	 * 根据配置与现有缓存生成稳定的深度优先资源顺序。
	 * @param config 当前文档配置。
	 * @param records Gateway 已知资源。
	 * @returns 去重后的逻辑资源顺序。
	 */
	collectConfiguredOrder(config: DocsConfig, records: ResourceRecord[]) {
		return collectConfiguredOrder(config, records);
	}

	/**
	 * 汇总逐资源加载结果，供诊断页面生成操作反馈。
	 * @param results Gateway 返回的逐资源 settled 结果。
	 * @returns 成功和失败的资源数量。
	 */
	summarize(results: ResourceResult[]) {
		return summarizePrefetchResults(results);
	}

	/**
	 * 构建预加载或清理所需的完整资源计划。
	 * @param options 配置与可选资源加载策略。
	 * @returns 当前配置的资源收集器及加载结果。
	 */
	build(options: BuildPrefetchPlanOptions = {}) {
		return buildPrefetchPlan(options);
	}
}

/** Client 内所有调用方共用的无状态资源计划实例。 */
export const ResourcePlan = new ResourcePlanner();
