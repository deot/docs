import { IndexedDBStore } from '@deot/helper-cache';
import {
	applyPlaygroundImportMapOverride,
	applyPlaygroundStyleOverride,
	clearPlaygroundMaps,
	createBuiltinImports,
	createBuiltinStyles,
	isSafePlaygroundHref,
	setPlaygroundImportMapOverrides,
	setPlaygroundSiteModules,
	setPlaygroundSiteStyles,
	setPlaygroundStyleOverrides
} from '@deot/docs-playground';
import { getDocsNamespace } from '../../utils/resolver';
import type { DocsConfig } from '../../types';

export type PlaygroundResourceKind = 'import' | 'style';
export type PlaygroundResourceRequestStatus = 'waiting' | 'pending' | 'success' | 'error';
export type PlaygroundResourceLastAction = 'save' | 'reset' | 'prefetch' | 'retry';
export type PlaygroundResourceSource = 'default' | 'override';

export interface PlaygroundResourceRecord {
	id: string;
	namespace: string;
	alias: string;
	url: string;
	kind: PlaygroundResourceKind;
	updatedAt: number;
	/**
	 * 落库时的分类快照。`save` / `reset` / `hydrate` / `markStatus` 会写入；
	 * `cache.set` 未传时只对照内置 CDN 推断。列表覆盖态不读此字段。
	 */
	source?: PlaygroundResourceSource;
	requestStatus?: PlaygroundResourceRequestStatus;
	requestStatusUpdatedAt?: number;
	checkedAt?: number;
	reason?: string;
	lastAction?: PlaygroundResourceLastAction;
}

export interface PlaygroundResourceRow {
	kind: PlaygroundResourceKind;
	alias: string;
	defaultUrl: string;
	currentUrl: string;
	/**
	 * 库中 URL 与默认地址规范化后不同才为 true。没有库记录则为 false，不读 `source`。
	 */
	overridden: boolean;
	requestStatus: PlaygroundResourceRequestStatus;
	requestStatusUpdatedAt?: number;
	updatedAt?: number;
	checkedAt?: number;
	reason?: string;
	lastAction?: PlaygroundResourceLastAction;
}

export interface PlaygroundResourceProbeSummary {
	total: number;
	fulfilled: number;
	rejected: number;
}

type StatusListener = () => void;
type ProbeRow = Pick<PlaygroundResourceRow, 'kind' | 'alias' | 'currentUrl' | 'overridden'>;
type StatusPatch = Pick<
	PlaygroundResourceRecord,
	'source' | 'requestStatus' | 'requestStatusUpdatedAt' | 'checkedAt' | 'reason' | 'lastAction'
>;

interface SessionStatus extends StatusPatch {
	requestStatus: PlaygroundResourceRequestStatus;
	requestStatusUpdatedAt: number;
	/**
	 * save 进行中或失败时记下的 URL，供 retry 重放。
	 */
	pendingUrl?: string;
}

const PROBE_CONCURRENCY = 4;
const PROBE_TIMEOUT_MS = 8000;
const STATUS_VALUES = ['waiting', 'pending', 'success', 'error'] as const;
const ACTION_VALUES = ['save', 'reset', 'prefetch', 'retry'] as const;
const SOURCE_VALUES = ['default', 'override'] as const;

const oneOf = <T extends string>(values: readonly T[], value: unknown): T | undefined => (
	values.includes(value as T) ? value as T : undefined
);

const normalizeKind = (value: unknown): PlaygroundResourceKind => (
	value === 'style' ? 'style' : 'import'
);

const normalizeStatus = (value: unknown) => oneOf(STATUS_VALUES, value);
const normalizeAction = (value: unknown) => oneOf(ACTION_VALUES, value);
const normalizeSource = (value: unknown) => oneOf(SOURCE_VALUES, value);

const isRecord = (value: unknown): value is PlaygroundResourceRecord => {
	if (!value || typeof value !== 'object') return false;
	const record = value as Partial<PlaygroundResourceRecord>;
	return typeof record.id === 'string'
		&& typeof record.namespace === 'string'
		&& typeof record.alias === 'string'
		&& typeof record.url === 'string'
		&& typeof record.updatedAt === 'number'
		&& Boolean(record.alias)
		&& Boolean(record.url)
		&& (record.kind === 'import' || record.kind === 'style');
};

const toRecord = (value: PlaygroundResourceRecord): PlaygroundResourceRecord => ({
	...value,
	kind: normalizeKind(value.kind),
	source: normalizeSource(value.source),
	requestStatus: normalizeStatus(value.requestStatus),
	lastAction: normalizeAction(value.lastAction),
	requestStatusUpdatedAt: typeof value.requestStatusUpdatedAt === 'number'
		? value.requestStatusUpdatedAt
		: undefined,
	checkedAt: typeof value.checkedAt === 'number' ? value.checkedAt : undefined,
	reason: typeof value.reason === 'string' ? value.reason : undefined
});

const compareByKindAlias = (
	left: { kind: string; alias: string },
	right: { kind: string; alias: string }
) => (
	left.kind !== right.kind
		? (left.kind === 'style' ? -1 : 1)
		: left.alias.localeCompare(right.alias)
);

const recordsByKind = (records: PlaygroundResourceRecord[], kind: PlaygroundResourceKind) => (
	Object.fromEntries(
		records.filter(record => record.kind === kind).map(record => [record.alias, record.url])
	)
);

const rowKey = (kind: PlaygroundResourceKind, alias: string) => `${kind}:${alias}`;

const defaultMaps = (config?: Pick<DocsConfig, 'modules' | 'styles'>) => ({
	style: { ...createBuiltinStyles(), ...(config?.styles || {}) },
	import: { ...createBuiltinImports(), ...(config?.modules || {}) }
});

const defaultUrlFor = (
	kind: PlaygroundResourceKind,
	alias: string,
	config?: Pick<DocsConfig, 'modules' | 'styles'>
) => defaultMaps(config)[kind][alias] || '';

// 当前地址规范化后非空，且与默认地址不同。
const isOverrideUrl = (url: string, defaultUrl: string) => {
	const next = normalizePlaygroundResourceUrl(url);
	return Boolean(next) && next !== normalizePlaygroundResourceUrl(defaultUrl);
};

const collectDefaultEntries = (config: DocsConfig) => {
	const maps = defaultMaps(config);
	return (['style', 'import'] as const).flatMap(kind => (
		Object.entries(maps[kind]).map(([alias, defaultUrl]) => ({
			kind,
			alias,
			defaultUrl
		}))
	));
};

// 优先读 `data`（JSON 字符串或对象）；否则退回摊开字段。
const readStoredRecord = (row: unknown): unknown => {
	if (!row || typeof row !== 'object') return null;
	const data = (row as { data?: unknown }).data;
	if (data && typeof data === 'object') return data;
	if (typeof data !== 'string') return row;
	try {
		return JSON.parse(data) as unknown;
	} catch {
		return null;
	}
};

// 只把覆盖写入预览内存。非覆盖、空地址、不安全地址都会从覆盖层删掉。
const syncOverrideMemory = (
	kind: PlaygroundResourceKind,
	alias: string,
	url: string,
	overridden: boolean
) => {
	const apply = kind === 'style' ? applyPlaygroundStyleOverride : applyPlaygroundImportMapOverride;
	apply(alias, overridden ? url : '');
};

const errorMessage = (reason: unknown, fallback: string) => (
	reason instanceof Error ? reason.message : fallback
);

const textEncoder = new TextEncoder();

// 按库内记录 JSON 字节计，不是列表视图模型。
export const measurePlaygroundResourceBytes = (records: PlaygroundResourceRecord[]) => (
	records.reduce((total, record) => (
		total + textEncoder.encode(JSON.stringify(record)).length
	), 0)
);

// 多行粘贴压成单行 URL。
export const normalizePlaygroundResourceUrl = (url: string) => url
	.split(/\r?\n/u)
	.map(part => part.trim())
	.filter(Boolean)
	.join('');

/**
 * Playground import / CSS 与 Gateway 资源分库。清文档缓存不会删这些行。
 */
export class PlaygroundResourceCache {
	private store = new IndexedDBStore({
		name: 'deot-docs-playground-resource',
		storeName: 'resources',
		keyPath: '__id',
		version: 1
	});

	private createId(namespace: string, kind: PlaygroundResourceKind, alias: string) {
		return [namespace, kind, alias].map(encodeURIComponent).join('|');
	}

	private async putRecord(record: PlaygroundResourceRecord) {
		await this.store.update(record.id, {
			...record,
			data: JSON.stringify(record)
		});
	}

	async list(namespace: string) {
		const rows = await this.store.search();
		return rows.flatMap((row) => {
			const record = readStoredRecord(row);
			if (!isRecord(record) || record.namespace !== namespace) return [];
			return [toRecord(record)];
		}).sort(compareByKindAlias);
	}

	// 写入一行。未传 `source` 时只对照内置 CDN 写入 `source`，不读 `$docs.modules` / `$docs.styles`。
	async set(
		namespace: string,
		alias: string,
		url: string,
		kind: PlaygroundResourceKind,
		patch: StatusPatch = {}
	) {
		const nextAlias = alias.trim();
		const nextUrl = normalizePlaygroundResourceUrl(url);
		const nextKind = normalizeKind(kind);
		if (!nextAlias || !nextUrl) return null;
		const record: PlaygroundResourceRecord = {
			id: this.createId(namespace, nextKind, nextAlias),
			namespace,
			alias: nextAlias,
			url: nextUrl,
			kind: nextKind,
			updatedAt: Date.now(),
			...patch,
			source: normalizeSource(patch.source) ?? (
				isOverrideUrl(nextUrl, defaultUrlFor(nextKind, nextAlias))
					? 'override'
					: 'default'
			)
		};
		await this.putRecord(record);
		return record;
	}

	async patch(
		namespace: string,
		alias: string,
		kind: PlaygroundResourceKind,
		patch: Partial<PlaygroundResourceRecord>
	) {
		const id = this.createId(namespace, kind, alias.trim());
		const current = readStoredRecord(await this.store.read(id));
		if (!isRecord(current)) return null;
		const next = toRecord({
			...current,
			...patch,
			id,
			namespace,
			alias: current.alias,
			kind: normalizeKind(kind)
		});
		await this.putRecord(next);
		return next;
	}

	async remove(
		namespace: string,
		alias: string,
		kind: PlaygroundResourceKind
	) {
		const nextAlias = alias.trim();
		const nextKind = normalizeKind(kind);
		await this.store.remove(this.createId(namespace, nextKind, nextAlias));
	}

	async clear(namespace: string) {
		const records = await this.list(namespace);
		await Promise.all(records.map(record => this.remove(namespace, record.alias, record.kind)));
	}
}

export class PlaygroundResourceRuntime {
	private cache = new PlaygroundResourceCache();
	/**
	 * start、其返回的 stop，以及 clear 共用的世代。过期的 start 结果和 hydrate 不得再写内存或库。
	 */
	private generation = 0;
	/**
	 * start() 挂上的默认行补齐任务。clear() 先作废世代再等待它结束，然后清库。
	 */
	private seedTask: Promise<void> = Promise.resolve();
	private statusSubscribers = new Set<StatusListener>();
	/**
	 * 进行中的保存/探测状态。列表里的 requestStatus 等优先用这里的值，不参与覆盖判定。
	 */
	private sessionStatus = new Map<string, SessionStatus>();

	async waitForIdle() {
		await this.seedTask;
	}

	subscribeStatus(listener: StatusListener) {
		this.statusSubscribers.add(listener);
		return () => this.statusSubscribers.delete(listener);
	}

	private notifyStatus() {
		this.statusSubscribers.forEach((listener) => {
			try {
				listener();
			} catch {
				// 订阅方异常不能阻断其它监听者。
			}
		});
	}

	private sessionKey(namespace: string, kind: PlaygroundResourceKind, alias: string) {
		return `${namespace}|${rowKey(kind, alias)}`;
	}

	private setSessionStatus(
		namespace: string,
		kind: PlaygroundResourceKind,
		alias: string,
		patch: SessionStatus
	) {
		this.sessionStatus.set(this.sessionKey(namespace, kind, alias), patch);
		this.notifyStatus();
	}

	private clearSessionStatus(
		namespace: string,
		kind?: PlaygroundResourceKind,
		alias?: string
	) {
		if (kind && alias) {
			this.sessionStatus.delete(this.sessionKey(namespace, kind, alias));
			this.notifyStatus();
			return;
		}
		const prefix = `${namespace}|`;
		for (const key of [...this.sessionStatus.keys()]) {
			if (key.startsWith(prefix)) this.sessionStatus.delete(key);
		}
		this.notifyStatus();
	}

	private async markStatus(
		namespace: string,
		row: ProbeRow,
		patch: SessionStatus
	) {
		this.setSessionStatus(namespace, row.kind, row.alias, patch);
		const status: StatusPatch = {
			requestStatus: patch.requestStatus,
			requestStatusUpdatedAt: patch.requestStatusUpdatedAt,
			checkedAt: patch.checkedAt,
			reason: patch.reason,
			lastAction: patch.lastAction,
			source: row.overridden ? 'override' : 'default'
		};
		const patched = await this.cache.patch(namespace, row.alias, row.kind, status);
		const url = normalizePlaygroundResourceUrl(row.currentUrl);
		if (patched || !url) return;
		await this.cache.set(namespace, row.alias, url, row.kind, status);
	}

	// 补齐尚未落库的默认行，并把 URL 已过期的 `source: default` 记录同步到当前默认。
	private async hydrateDefaults(
		namespace: string,
		config: DocsConfig,
		listed: PlaygroundResourceRecord[],
		isCurrent: () => boolean = () => true
	) {
		const map = new Map(listed.map(item => [rowKey(item.kind, item.alias), item]));
		await Promise.all(collectDefaultEntries(config).map(async (item) => {
			if (!isCurrent() || !item.defaultUrl) return;
			const key = rowKey(item.kind, item.alias);
			const stored = map.get(key);
			const staleDefault = Boolean(
				stored?.source === 'default' && isOverrideUrl(stored.url, item.defaultUrl)
			);
			if (stored && !staleDefault) return;
			const record = await this.cache.set(namespace, item.alias, item.defaultUrl, item.kind, {
				requestStatus: 'waiting',
				requestStatusUpdatedAt: Date.now(),
				source: 'default',
				lastAction: stored?.lastAction
			});
			if (record) map.set(key, record);
		}));
		return [...map.values()];
	}

	// 用库中 URL 与默认地址比较得到覆盖态：无库记录则不是覆盖，不读 `source`。
	// 覆盖行的 currentUrl 取库中地址，否则取默认。
	private toRows(
		namespace: string,
		config: DocsConfig,
		storedRows: PlaygroundResourceRecord[]
	): PlaygroundResourceRow[] {
		const storedMap = new Map(
			storedRows.map(item => [rowKey(item.kind, item.alias), item])
		);
		const defaults = collectDefaultEntries(config);
		const known = new Set(defaults.map(item => rowKey(item.kind, item.alias)));
		const entries = [
			...defaults,
			...storedRows
				.filter(item => !known.has(rowKey(item.kind, item.alias)))
				.map(item => ({ kind: item.kind, alias: item.alias, defaultUrl: '' }))
		];

		return entries.map((item) => {
			const stored = storedMap.get(rowKey(item.kind, item.alias));
			const session = this.sessionStatus.get(this.sessionKey(namespace, item.kind, item.alias));
			const overridden = Boolean(stored && isOverrideUrl(stored.url, item.defaultUrl));
			return {
				kind: item.kind,
				alias: item.alias,
				defaultUrl: item.defaultUrl,
				currentUrl: overridden && stored ? stored.url : item.defaultUrl,
				overridden,
				requestStatus: session?.requestStatus || stored?.requestStatus || 'waiting',
				requestStatusUpdatedAt: session?.requestStatusUpdatedAt
					?? stored?.requestStatusUpdatedAt,
				updatedAt: stored?.updatedAt,
				checkedAt: session?.checkedAt ?? stored?.checkedAt,
				reason: session?.reason ?? stored?.reason,
				lastAction: session?.lastAction ?? stored?.lastAction
			};
		}).sort(compareByKindAlias);
	}

	async list(namespace: string) {
		return this.cache.list(namespace);
	}

	async listPage(config: DocsConfig) {
		const namespace = getDocsNamespace(config);
		const storedRows = await this.hydrateDefaults(
			namespace,
			config,
			await this.cache.list(namespace)
		);
		return {
			rows: this.toRows(namespace, config, storedRows),
			bytes: measurePlaygroundResourceBytes(storedRows)
		};
	}

	// 按 `cache.set` 写入（未传 source 只比内置 CDN），再用记录上的 `source === 'override'` 同步覆盖内存。
	async set(
		namespace: string,
		alias: string,
		url: string,
		kind: PlaygroundResourceKind
	) {
		const record = await this.cache.set(namespace, alias, url, kind);
		if (!record) return null;
		syncOverrideMemory(record.kind, record.alias, record.url, record.source === 'override');
		return record;
	}

	async remove(
		namespace: string,
		alias: string,
		kind: PlaygroundResourceKind
	) {
		const nextKind = normalizeKind(kind);
		await this.cache.remove(namespace, alias, nextKind);
		syncOverrideMemory(nextKind, alias, '', false);
		this.clearSessionStatus(namespace, nextKind, alias);
	}

	private async probeUrl(
		namespace: string,
		row: ProbeRow,
		lastAction: PlaygroundResourceLastAction
	) {
		const url = normalizePlaygroundResourceUrl(row.currentUrl);
		const now = Date.now();
		await this.markStatus(namespace, row, {
			requestStatus: 'pending',
			requestStatusUpdatedAt: now,
			lastAction,
			reason: undefined
		});
		const finish = (ok: boolean, reason?: string) => {
			const at = Date.now();
			return this.markStatus(namespace, row, {
				requestStatus: ok ? 'success' : 'error',
				requestStatusUpdatedAt: at,
				checkedAt: at,
				reason,
				lastAction
			});
		};
		if (!isSafePlaygroundHref(url)) {
			await finish(false, 'Unsafe URL');
			return false;
		}

		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
		try {
			const response = await fetch(url, {
				method: 'GET',
				signal: controller.signal,
				cache: 'no-store'
			});
			await finish(response.ok, response.ok ? undefined : `HTTP ${response.status}`);
			return response.ok;
		} catch (reason) {
			await finish(false, errorMessage(reason, 'Probe failed'));
			return false;
		} finally {
			clearTimeout(timer);
		}
	}

	private async runPool(
		items: PlaygroundResourceRow[],
		worker: (item: PlaygroundResourceRow) => Promise<boolean>
	): Promise<PlaygroundResourceProbeSummary> {
		let index = 0;
		let fulfilled = 0;
		let rejected = 0;
		const runners = Array.from(
			{ length: Math.min(PROBE_CONCURRENCY, items.length) },
			async () => {
				while (index < items.length) {
					const current = items[index++]!;
					if (await worker(current)) fulfilled += 1;
					else rejected += 1;
				}
			}
		);
		await Promise.all(runners);
		return { total: items.length, fulfilled, rejected };
	}

	private async withPending<T>(
		namespace: string,
		kind: PlaygroundResourceKind,
		alias: string,
		lastAction: PlaygroundResourceLastAction,
		fallback: string,
		work: (now: number) => Promise<T>,
		extra: Partial<SessionStatus> = {}
	) {
		const now = Date.now();
		this.setSessionStatus(namespace, kind, alias, {
			...extra,
			requestStatus: 'pending',
			requestStatusUpdatedAt: now,
			lastAction
		});
		try {
			return await work(now);
		} catch (reason) {
			this.setSessionStatus(namespace, kind, alias, {
				...extra,
				requestStatus: 'error',
				requestStatusUpdatedAt: Date.now(),
				lastAction,
				reason: errorMessage(reason, fallback)
			});
			throw reason;
		}
	}

	async save(
		namespace: string,
		alias: string,
		url: string,
		kind: PlaygroundResourceKind,
		defaultUrl?: string
	) {
		const nextUrl = normalizePlaygroundResourceUrl(url);
		const nextDefault = normalizePlaygroundResourceUrl(
			defaultUrl ?? defaultUrlFor(kind, alias)
		);
		return this.withPending(
			namespace,
			kind,
			alias,
			'save',
			'Save failed',
			async (now) => {
				if (!nextUrl) throw new Error('Invalid alias or url');
				const overridden = isOverrideUrl(nextUrl, nextDefault);
				const record = await this.cache.set(namespace, alias, nextUrl, kind, {
					requestStatus: 'pending',
					requestStatusUpdatedAt: now,
					lastAction: 'save',
					source: overridden ? 'override' : 'default',
					reason: undefined
				});
				if (!record) throw new Error('Invalid alias or url');
				syncOverrideMemory(record.kind, record.alias, record.url, overridden);
				this.clearSessionStatus(namespace, kind, alias);
				await this.probeUrl(namespace, {
					kind: record.kind,
					alias: record.alias,
					currentUrl: record.url,
					overridden
				}, 'save');
				return record;
			},
			{ pendingUrl: nextUrl }
		);
	}

	// 写回传入的默认地址。默认地址为空（表里多出来的自定义行）则删行，不再探测。
	async reset(
		namespace: string,
		alias: string,
		kind: PlaygroundResourceKind,
		defaultUrl: string
	) {
		return this.withPending(
			namespace,
			kind,
			alias,
			'reset',
			'Rollback failed',
			async (now) => {
				const nextDefault = normalizePlaygroundResourceUrl(defaultUrl);
				if (nextDefault) {
					const record = await this.cache.set(namespace, alias, nextDefault, kind, {
						requestStatus: 'pending',
						requestStatusUpdatedAt: now,
						lastAction: 'reset',
						source: 'default',
						reason: undefined
					});
					if (!record) throw new Error('Invalid alias or url');
				} else {
					await this.cache.remove(namespace, alias, kind);
				}
				syncOverrideMemory(kind, alias, '', false);
				this.clearSessionStatus(namespace, kind, alias);
				if (!nextDefault) return;
				await this.probeUrl(namespace, {
					kind,
					alias,
					currentUrl: nextDefault,
					overridden: false
				}, 'reset');
			}
		);
	}

	async prefetch(
		namespace: string,
		rows: PlaygroundResourceRow[]
	): Promise<PlaygroundResourceProbeSummary> {
		return this.runPool(rows, row => this.probeUrl(namespace, row, 'prefetch'));
	}

	// 上次 save 失败且会话里有 pendingUrl 则重放保存；上次 reset 失败且行仍是覆盖则重放回滚；其余只重探测。
	async retry(namespace: string, row: PlaygroundResourceRow) {
		const session = this.sessionStatus.get(this.sessionKey(namespace, row.kind, row.alias));
		const lastAction = row.lastAction || session?.lastAction;
		if (lastAction === 'save' && row.requestStatus === 'error' && session?.pendingUrl) {
			return this.save(namespace, row.alias, session.pendingUrl, row.kind, row.defaultUrl);
		}
		if (lastAction === 'reset' && row.requestStatus === 'error' && row.overridden) {
			await this.reset(namespace, row.alias, row.kind, row.defaultUrl);
			return null;
		}
		await this.probeUrl(namespace, row, 'retry');
		return null;
	}

	// 清掉本 namespace 的库记录和覆盖内存，并作废尚未完成的 hydrate。
	// 不动 `$docs` 配置，也不清站点默认内存。
	async clear(namespace: string) {
		this.generation += 1;
		await this.seedTask.catch(() => undefined);
		await this.cache.clear(namespace);
		this.clearSessionStatus(namespace);
		setPlaygroundImportMapOverrides({});
		setPlaygroundStyleOverrides({});
	}

	// 写入站点默认内存。覆盖层只灌入 `source` 不是 `default`、且 URL 与当前默认不同的行，
	// 以免过期的默认行在 hydrate 前被当成覆盖。不安全地址在写入内存时丢掉。默认行后台补齐。
	// 读库失败则清空全部 playground 内存映射，不阻断启动。返回的 stop 会作废世代并清空这些内存。
	async start(config: DocsConfig) {
		const token = ++this.generation;
		const stop = () => {
			if (token !== this.generation) return;
			this.generation++;
			clearPlaygroundMaps();
			this.sessionStatus.clear();
		};
		try {
			const namespace = getDocsNamespace(config);
			const listed = await this.cache.list(namespace);
			if (token !== this.generation) return stop;
			const maps = defaultMaps(config);
			const overrides = listed.filter(record => (
				record.source !== 'default'
				&& isOverrideUrl(record.url, maps[record.kind][record.alias] || '')
			));
			setPlaygroundSiteModules(config.modules || {});
			setPlaygroundSiteStyles(config.styles || {});
			setPlaygroundImportMapOverrides(recordsByKind(overrides, 'import'));
			setPlaygroundStyleOverrides(recordsByKind(overrides, 'style'));
			this.seedTask = this.hydrateDefaults(
				namespace,
				config,
				listed,
				() => token === this.generation
			).then(() => undefined, () => undefined);
		} catch {
			if (token === this.generation) clearPlaygroundMaps();
		}
		return stop;
	}
}

/**
 * Client 内 Playground import / CSS 的默认、覆盖、探测与持久化入口。
 */
