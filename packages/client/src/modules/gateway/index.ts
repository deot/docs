import { getDocsConfig } from '../../utils/runtime';
import { resolveResource, resourceIdentityKey } from '../../utils/resolver';
import type { ResourceIdentity } from '../../types';
import { IndexedDBResourceCache } from './cache';
import {
	createAttemptId,
	hasContent,
	hashContent,
	normalizeReason,
	normalizeResourceRecord,
	recordsEqual,
	updateHistoryStatus
} from './record';
import { RequestScheduler, toTask } from './scheduler';
import type { ScheduledResult } from './scheduler';
import { createAbortError, requestText, withAbort } from './transport';
import type {
	ResourceCache,
	ResourceContentRecord,
	ResourceGatewayOptions,
	ResourceLoadOptions,
	ResourceMutationToken,
	ResourcePollOptions,
	ResourcePrefetchOptions,
	ResourceRecord,
	ResourceRecordDraft,
	ResourceRequest,
	ResourceStatus
} from './types';
import { ResourceRequestError } from './types';

interface PendingRequest {
	promise: Promise<ResourceContentRecord>;
	controller: AbortController;
	consumers: Set<symbol>;
	settled: boolean;
	priority: number;
	promote: (priority: number) => void;
}

interface TrailingRequest {
	identity: ResourceIdentity;
	options: ResourceLoadOptions;
	prefetch: boolean;
	promise: Promise<ResourceContentRecord>;
	resolve: (record: ResourceContentRecord) => void;
	reject: (reason: unknown) => void;
}

export type {
	ResourceCache,
	ResourceContentRecord,
	ResourceGatewayOptions,
	ResourceLoadOptions,
	ResourcePollOptions,
	ResourcePrefetchOptions,
	ResourceRecord,
	ResourceRecordInput,
	ResourceStatus,
	ResourceStatusHistory,
	ResourceVersion
} from './types';

export class ResourceGateway {
	private cache: ResourceCache;

	private request: ResourceRequest;

	private scheduler: RequestScheduler;

	private memory = new Map<string, ResourceRecord>();

	private pending = new Map<string, PendingRequest>();

	private controllers = new Map<string, AbortController>();

	private trailing = new Map<string, TrailingRequest>();

	private cacheWrites = new Map<string, Promise<void>>();

	private subscribers = new Map<string, Set<(record: ResourceContentRecord) => void>>();

	private statusSubscribers = new Set<(record: ResourceRecord) => void>();

	private prefetched = new Set<string>();

	private globalRevision = 0;

	private resourceRevisions = new Map<string, number>();

	private polling = new Map<string, ReturnType<typeof setInterval>>();

	/**
	 * 破坏性缓存操作较少发生，因此有意共用一个队列。invalidate/clear 后
	 * 立即创建的请求必须等待该 barrier，避免旧删除操作清除新请求刚写入的结果。
	 */
	private deletionBarrier: Promise<void> = Promise.resolve();

	constructor(options: ResourceGatewayOptions = {}) {
		this.cache = options.cache || new IndexedDBResourceCache();
		this.request = options.request || requestText;
		this.scheduler = new RequestScheduler(options.concurrency || 6);
	}

	setConcurrency(value: number) {
		this.scheduler.setConcurrency(value);
	}

	// 立即返回缓存内容；除非关闭 refresh，否则随后重新校验。
	async load(identity: ResourceIdentity, options: ResourceLoadOptions = {}) {
		return this.loadInternal(identity, options, false);
	}

	// 将网络校验加入队列，并在其生命周期持久化后才返回结果。
	revalidate(identity: ResourceIdentity, options: ResourceLoadOptions = {}) {
		return this.revalidateInternal(identity, options, false, options.trailing === true);
	}

	// 入队前标记热资源，使 SSE 能在资源未展示时继续维护它们。
	async prefetch(
		identities: ResourceIdentity[],
		options: ResourcePrefetchOptions = {}
	) {
		identities.forEach(identity => this.prefetched.add(resourceIdentityKey(identity)));
		return Promise.allSettled(identities.map(identity => (
			this.revalidateInternal(identity, {
				priority: options.priority ?? 25,
				signal: options.signal
			}, true, false)
		)));
	}

	/**
	 * 为单个或一批资源显式开启轮询。每个 identity 独立拥有 timer，
	 * 因此 stopPolling() 可以移除其中一个，而不影响其他资源。
	 * @param input 单个逻辑 identity 或 identity 列表。
	 * @param options 轮询间隔简写或完整轮询选项。
	 * @returns 用于停止本次调用所创建全部 timer 的函数。
	 */
	poll(
		input: ResourceIdentity | ResourceIdentity[],
		options: number | ResourcePollOptions = 60000
	) {
		const identities = Array.isArray(input) ? input : [input];
		const requestedInterval = typeof options === 'number' ? options : options.interval ?? 60000;
		const interval = Number.isFinite(requestedInterval) && requestedInterval > 0
			? requestedInterval
			: 60000;
		const priority = typeof options === 'number' ? 0 : options.priority ?? 0;
		const unique = new Map(identities.map(identity => [resourceIdentityKey(identity), identity]));
		const stops = [...unique.values()].map(identity => (
			this.startPolling(identity, interval, priority)
		));
		return () => stops.forEach(stop => stop());
	}

	private startPolling(identity: ResourceIdentity, interval: number, priority: number) {
		const key = resourceIdentityKey(identity);
		this.stopPolling(identity);
		const timer = setInterval(() => {
			void this.revalidateSilently(identity, { priority }, false, true);
		}, interval);
		this.polling.set(key, timer);
		return () => this.stopPolling(identity);
	}

	stopPolling(identity: ResourceIdentity) {
		const key = resourceIdentityKey(identity);
		const timer = this.polling.get(key);
		if (timer) clearInterval(timer);
		this.polling.delete(key);
	}

	// 内容订阅与仅请求状态有意隔离。
	subscribe(identity: ResourceIdentity, listener: (record: ResourceContentRecord) => void) {
		const key = resourceIdentityKey(identity);
		const listeners = this.subscribers.get(key) || new Set();
		listeners.add(listener);
		this.subscribers.set(key, listeners);
		return () => {
			listeners.delete(listener);
			if (!listeners.size) this.subscribers.delete(key);
		};
	}

	// 监听已持久化的生命周期变化，但不触发内容重渲染。
	subscribeStatus(listener: (record: ResourceRecord) => void) {
		this.statusSubscribers.add(listener);
		return () => this.statusSubscribers.delete(listener);
	}

	isSubscribed(identity: ResourceIdentity) {
		return Boolean(this.subscribers.get(resourceIdentityKey(identity))?.size);
	}

	// 将会话预加载与 UI 订阅分开记录，供 SSE 重新校验使用。
	isPrefetched(identity: ResourceIdentity) {
		return this.prefetched.has(resourceIdentityKey(identity));
	}

	async list() {
		const deletionBarrier = this.deletionBarrier;
		await deletionBarrier;
		const records = new Map<string, ResourceRecord>();
		await Promise.all((await this.cache.list()).map(async (record) => {
			const normalized = normalizeResourceRecord(record);
			const key = resourceIdentityKey(normalized.identity);
			const token = this.getMutationToken(key);
			records.set(key, normalized);
			// 诊断页会频繁查询，仅迁移或修复时才需要回写记录。
			if (!recordsEqual(record, normalized)) {
				await this.enqueueCacheWrite(key, async () => {
					// 当前持久化已由更新的请求或破坏性操作接管，禁止过期的诊断页
					// 迁移结果覆盖该记录。
					if (deletionBarrier !== this.deletionBarrier
						|| !this.isMutationTokenCurrent(key, token)
						|| this.memory.has(key)) return;
					await this.cache.set(key, normalized);
				});
			}
		}));
		this.memory.forEach((record, key) => records.set(key, normalizeResourceRecord(record)));
		return [...records.values()];
	}

	async invalidate(identity: ResourceIdentity) {
		const key = resourceIdentityKey(identity);
		const active = this.pending.get(key);
		this.resourceRevisions.set(key, (this.resourceRevisions.get(key) || 0) + 1);
		this.stopPolling(identity);
		this.cancelTrailing(key);
		this.controllers.get(key)?.abort();
		this.controllers.delete(key);
		this.pending.delete(key);
		this.memory.delete(key);
		this.prefetched.delete(key);
		await this.enqueueDeletion(async () => {
			await this.settlePending(active);
			await this.enqueueCacheWrite(key, async () => this.cache.remove(key));
		});
	}

	async clear() {
		const active = [...this.pending.values()];
		this.globalRevision += 1;
		this.resourceRevisions.clear();
		this.trailing.forEach((_request, key) => this.cancelTrailing(key));
		this.controllers.forEach(controller => controller.abort());
		this.controllers.clear();
		this.pending.clear();
		this.memory.clear();
		this.prefetched.clear();
		this.polling.forEach(timer => clearInterval(timer));
		this.polling.clear();
		await this.enqueueDeletion(async () => {
			await Promise.all(active.map(entry => this.settlePending(entry)));
			await Promise.all([...this.cacheWrites.values()]);
			await this.cache.clear();
		});
	}

	/*
	 * 删除完整预加载计划中已不可达的记录。显式指定 namespace，确保空保留集
	 * 不会影响共用同一个 deot-docs 数据库的其他站点。
	 */
	async prune(namespace: string, retainedIdentities: ResourceIdentity[]) {
		const retainedKeys = new Set(retainedIdentities
			.filter(identity => identity.namespace === namespace)
			.map(resourceIdentityKey));
		const garbage = (await this.list()).filter(record => (
			record.identity.namespace === namespace
			&& !retainedKeys.has(resourceIdentityKey(record.identity))
		));
		await Promise.all(garbage.map(record => this.invalidate(record.identity)));
		return garbage;
	}

	private async loadInternal(
		identity: ResourceIdentity,
		options: ResourceLoadOptions,
		prefetch: boolean
	): Promise<ResourceContentRecord> {
		const key = resourceIdentityKey(identity);
		await this.deletionBarrier;
		const token = this.getMutationToken(key);
		const cached = await this.readRecord(key, token);
		if (cached && hasContent(cached)) {
			const accessed = await this.writeRecord(
				{ ...cached, accessedAt: Date.now() },
				false,
				token
			);
			if (options.refresh !== false) {
				void this.revalidateSilently(identity, options, prefetch, false);
			}
			return accessed as ResourceContentRecord;
		}
		return this.revalidateInternal(identity, options, prefetch, false);
	}

	/**
	 * 同步占用 identity，然后推动同一个物理 attempt 依次经过
	 * waiting/pending/final。每个调用方都是独立 consumer：取消一个 consumer
	 * 只会结束自身等待；仅当所有 consumer 都离开后才取消物理请求。
	 * @param identity 逻辑资源 identity。
	 * @param options 当前调用方的传输与调度选项。
	 * @param prefetch 是否需要先持久化 waiting 状态。
	 * @param trailing 命中 pending 时是否代表更新的新鲜度事件。
	 * @returns 当前调用方对应的共享或尾随请求结果。
	 */
	private revalidateInternal(
		identity: ResourceIdentity,
		options: ResourceLoadOptions,
		prefetch: boolean,
		trailing: boolean
	) {
		const key = resourceIdentityKey(identity);
		const shared = this.pending.get(key);
		if (shared) {
			if (trailing) return this.queueTrailing(identity, options, prefetch);
			shared.promote(options.priority ?? (prefetch ? 25 : 100));
			return shared.controller.signal.aborted
				? this.queueTrailing(identity, options, prefetch)
				: this.consumePending(shared, options.signal);
		}
		const controller = new AbortController();
		const requestOptions = {
			url: options.url,
			priority: options.priority,
			refresh: options.refresh,
			signal: controller.signal
		};
		// 占用 identity 时固定 barrier。后续 clear/invalidate 会等待该活动 entry；
		// 若在 target 内读取可变 barrier，会形成死锁。
		const deletionBarrier = this.deletionBarrier;
		let scheduled: ScheduledResult<ResourceContentRecord> | null = null;
		// promise 与 promote 都需要回引 entry 自身，先构建其余字段，最后补上 promise。
		const init: Omit<PendingRequest, 'promise'> = {
			controller,
			consumers: new Set(),
			settled: false,
			priority: options.priority ?? (prefetch ? 25 : 100),
			promote: (priority) => {
				if (priority <= init.priority) return;
				init.priority = priority;
				scheduled?.setPriority(priority);
			}
		};

		let release!: () => void;
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		const target = (async () => {
			await gate;
			await deletionBarrier;
			const token = this.getMutationToken(key);
			const attemptId = createAttemptId();
			if (prefetch) {
				await this.transition(identity, requestOptions, attemptId, 'waiting', undefined, token);
			}
			scheduled = this.scheduler.schedule(async () => {
				await this.transition(identity, requestOptions, attemptId, 'pending', undefined, token);
				try {
					const task = toTask(async () => {
						try {
							return await this.update(identity, requestOptions, attemptId, token);
						} catch (reason) {
							// Task 会把部分 falsy rejection payload 视为空结果，因此将传输失败
							// 转为 Error，确保每个失败生命周期都进入 error。
							throw reason && typeof reason === 'object'
								? reason
								: new Error(normalizeReason(reason));
						}
					});
					return await task.value as ResourceContentRecord;
				} catch (reason) {
					await this.transition(
						identity,
						requestOptions,
						attemptId,
						'error',
						reason,
						token
					);
					throw reason;
				}
			}, init.priority);
			return scheduled;
		})();

		const entry: PendingRequest = Object.assign(init, {
			promise: (async () => {
				try {
					return await target;
				} finally {
					init.settled = true;
					const ownsPendingSlot = this.pending.get(key) === init;
					if (ownsPendingSlot) this.pending.delete(key);
					if (this.controllers.get(key) === controller) this.controllers.delete(key);
					// 已失效 attempt 可能在替代请求接管 key 后才结束；只有替代请求
					// 可以处理它自己的尾随通知。
					if (ownsPendingSlot) this.flushTrailing(key);
				}
			})()
		});

		/**
		 * 在 waiting 写入或 scheduler 执行前先占用 identity，避免并发调用方
		 * 创建重复请求和重复 history。
		 */
		this.pending.set(key, entry);
		this.controllers.set(key, controller);
		release();
		return this.consumePending(entry, options.signal);
	}

	private async revalidateSilently(
		identity: ResourceIdentity,
		options: ResourceLoadOptions,
		prefetch: boolean,
		trailing: boolean
	) {
		try {
			await this.revalidateInternal(identity, options, prefetch, trailing);
		} catch {
			// 后台刷新和轮询失败时保留最近可用缓存内容。
		}
	}

	/**
	 * consumer signal 属于对应调用方，不属于共享传输层。只有最后一个活动
	 * consumer 离开时才中止物理 controller。
	 * @param entry 所有逻辑调用方共享的物理请求。
	 * @param signal 仅由当前调用方拥有的取消信号。
	 * @returns 共享结果或当前调用方的 AbortError。
	 */
	private async consumePending(entry: PendingRequest, signal?: AbortSignal) {
		const consumer = Symbol('resource-consumer');
		entry.consumers.add(consumer);
		let rejectAbort!: (reason: unknown) => void;
		const aborted = new Promise<never>((_resolve, reject) => {
			rejectAbort = reject;
		});
		const abort = () => {
			entry.consumers.delete(consumer);
			rejectAbort(createAbortError());
			if (!entry.settled && !entry.consumers.size) entry.controller.abort();
		};
		if (signal?.aborted) abort();
		else signal?.addEventListener('abort', abort, { once: true });
		try {
			return await (signal
				? Promise.race([entry.promise, aborted])
				: entry.promise);
		} finally {
			signal?.removeEventListener('abort', abort);
			entry.consumers.delete(consumer);
			if (!entry.settled && !entry.consumers.size) entry.controller.abort();
		}
	}

	/**
	 * 显式重新校验表示“在本次通知后再校验”。若已有 pending 请求，则将所有
	 * 更新通知合并为一次尾随校验，避免请求期间到达的 SSE change 被静默丢失。
	 * @param identity 逻辑资源 identity。
	 * @param options 最新新鲜度通知携带的选项。
	 * @param prefetch 尾随 attempt 是否需要 waiting 状态。
	 * @returns 当前调用方对应的合并尾随校验。
	 */
	private queueTrailing(
		identity: ResourceIdentity,
		options: ResourceLoadOptions,
		prefetch: boolean
	) {
		const key = resourceIdentityKey(identity);
		const current = this.trailing.get(key);
		if (current) {
			current.options = this.mergeTrailingOptions(current.options, options);
			current.prefetch ||= prefetch;
			return withAbort(async () => current.promise, options.signal);
		}
		let resolve!: (record: ResourceContentRecord) => void;
		let reject!: (reason: unknown) => void;
		const promise = new Promise<ResourceContentRecord>((resolvePromise, rejectPromise) => {
			resolve = resolvePromise;
			reject = rejectPromise;
		});
		const request: TrailingRequest = {
			identity,
			options: this.mergeTrailingOptions({}, options),
			prefetch,
			promise,
			resolve,
			reject
		};
		this.trailing.set(key, request);
		return withAbort(async () => promise, options.signal);
	}

	private mergeTrailingOptions(
		current: ResourceLoadOptions,
		next: ResourceLoadOptions
	): ResourceLoadOptions {
		return {
			url: next.url ?? current.url,
			priority: current.priority === undefined && next.priority === undefined
				? undefined
				: Math.max(current.priority ?? 0, next.priority ?? 0),
			refresh: next.refresh ?? current.refresh
		};
	}

	private flushTrailing(key: string) {
		const request = this.trailing.get(key);
		if (!request) return;
		this.trailing.delete(key);
		const run = async () => {
			try {
				request.resolve(await this.revalidateInternal(
					request.identity,
					request.options,
					request.prefetch,
					false
				));
			} catch (reason) {
				request.reject(reason);
			}
		};
		void run();
	}

	private cancelTrailing(key: string) {
		const request = this.trailing.get(key);
		if (!request) return;
		this.trailing.delete(key);
		request.reject(createAbortError());
	}

	private enqueueDeletion(run: () => Promise<void>) {
		const previous = this.deletionBarrier;
		const operation = (async () => {
			try {
				await previous;
			} catch {
				// 较早的删除失败不能永久污染 mutation 队列。
			}
			await run();
		})();
		this.deletionBarrier = (async () => {
			try {
				await operation;
			} catch {
				// 发起 invalidate/clear 的调用方仍会收到原始 rejection。
			}
		})();
		return operation;
	}

	/**
	 * 按 identity 串行执行持久化，避免迁移、生命周期和删除写入乱序完成。
	 * 对外 operation 仍会 reject，而内部 barrier 始终 settled，确保后续仍可写入。
	 * @param key 稳定的逻辑 identity key。
	 * @param run 需要串行执行的缓存变更。
	 * @returns 保留原始 rejection 的 mutation promise。
	 */
	private enqueueCacheWrite(key: string, run: () => Promise<void>) {
		const previous = this.cacheWrites.get(key) || Promise.resolve();
		const operation = (async () => {
			try {
				await previous;
			} catch {
				// 较早的持久化失败不能污染当前资源队列。
			}
			await run();
		})();
		const barrier = (async () => {
			try {
				await operation;
			} catch {
				// 等待 operation 的调用方仍会收到原始 rejection。
			}
		})();
		this.cacheWrites.set(key, barrier);
		const cleanup = async () => {
			await barrier;
			if (this.cacheWrites.get(key) === barrier) this.cacheWrites.delete(key);
		};
		void cleanup();
		return operation;
	}

	private async settlePending(entry?: PendingRequest) {
		if (!entry) return;
		try {
			await entry.promise;
		} catch {
			// invalidate/clear 会有意中止活动请求生命周期。
		}
	}

	private async readRecord(key: string, token?: ResourceMutationToken) {
		if (token) this.assertMutationToken(key, token);
		const memory = this.memory.get(key);
		if (memory) return normalizeResourceRecord(memory);
		const cached = await this.cache.get(key);
		if (token) this.assertMutationToken(key, token);
		if (!cached) return null;
		const normalized = normalizeResourceRecord(cached);
		this.memory.set(key, normalized);
		if (!recordsEqual(cached, normalized)) {
			await this.enqueueCacheWrite(key, async () => this.cache.set(key, normalized));
			if (token) await this.repairStaleWrite(key, normalized, token);
		}
		return normalized;
	}

	private async writeRecord(
		record: ResourceRecordDraft,
		notifyStatus = false,
		token?: ResourceMutationToken
	) {
		const normalized = normalizeResourceRecord(record);
		const key = resourceIdentityKey(normalized.identity);
		if (token) this.assertMutationToken(key, token);
		this.memory.set(key, normalized);
		await this.enqueueCacheWrite(key, async () => this.cache.set(key, normalized));
		if (token) await this.repairStaleWrite(key, normalized, token);
		if (notifyStatus) {
			this.statusSubscribers.forEach((listener) => {
				try {
					listener(normalized);
				} catch {
					// observer 不得改变资源请求结果。
				}
			});
		}
		return normalized;
	}

	private getMutationToken(key: string): ResourceMutationToken {
		return {
			global: this.globalRevision,
			resource: this.resourceRevisions.get(key) || 0
		};
	}

	private isMutationTokenCurrent(key: string, token: ResourceMutationToken) {
		return token.global === this.globalRevision
			&& token.resource === (this.resourceRevisions.get(key) || 0);
	}

	private assertMutationToken(key: string, token: ResourceMutationToken) {
		if (!this.isMutationTokenCurrent(key, token)) throw createAbortError();
	}

	/*
	 * 缓存写入可能在 invalidate/clear 后才完成。若没有替代记录则删除过期行；
	 * 若重试已成功，则重新写入更新的内存记录。
	 */
	private async repairStaleWrite(
		key: string,
		written: ResourceRecord,
		token: ResourceMutationToken
	) {
		if (this.isMutationTokenCurrent(key, token)) return;
		const current = this.memory.get(key);
		if (!current || current === written) {
			this.memory.delete(key);
			await this.enqueueCacheWrite(key, async () => this.cache.remove(key));
		} else {
			await this.enqueueCacheWrite(key, async () => this.cache.set(key, current));
		}
		throw createAbortError();
	}

	// 持久化请求状态，但不直接修改派生的内容状态。
	private async transition(
		identity: ResourceIdentity,
		options: ResourceLoadOptions,
		attemptId: string,
		status: ResourceStatus,
		reason: unknown,
		token: ResourceMutationToken
	) {
		const key = resourceIdentityKey(identity);
		const current = await this.readRecord(key, token);
		const timestamp = Date.now();
		const base: ResourceRecordDraft = current || {
			identity,
			url: options.url || identity.source,
			requestStatus: status,
			requestStatusUpdatedAt: timestamp,
			statusHistory: [],
			contentHistoryId: null,
			contentHistoryIndex: null,
			checkedAt: 0,
			accessedAt: timestamp
		};
		return this.writeRecord({
			...base,
			url: options.url || current?.url || identity.source,
			requestStatus: status,
			requestStatusUpdatedAt: timestamp,
			statusHistory: updateHistoryStatus(
				base.statusHistory,
				attemptId,
				status,
				timestamp,
				reason === undefined ? undefined : normalizeReason(reason)
			),
			reason: status === 'error' ? normalizeReason(reason) : undefined
		}, true, token);
	}

	// 应用 validator，仅在响应 body hash 变化时移动 contentHistoryId。
	private async update(
		identity: ResourceIdentity,
		options: ResourceLoadOptions,
		attemptId: string,
		token: ResourceMutationToken
	): Promise<ResourceContentRecord> {
		const key = resourceIdentityKey(identity);
		const current = await this.readRecord(key, token);
		const url = options.url || await withAbort(
			async () => resolveResource(getDocsConfig(), identity),
			options.signal
		);
		const headers: Record<string, string> = {};
		if (current?.etag) headers['If-None-Match'] = current.etag;
		if (current?.lastModified) headers['If-Modified-Since'] = current.lastModified;

		let response = await withAbort(
			async () => this.request(url, headers, options.signal),
			options.signal
		);
		if (response.status === 304 && current && hasContent(current) && identity.type === 'sidebar') {
			try {
				JSON.parse(current.content);
			} catch {
				response = await withAbort(
					async () => this.request(url, {}, options.signal),
					options.signal
				);
			}
		}
		if (response.status === 304 && (!current || !hasContent(current))) {
			throw new Error('Resource returned 304 without cached content');
		}
		const now = Date.now();
		if (response.status === 304 && current && hasContent(current)) {
			return await this.completeSuccess({
				...current,
				checkedAt: now,
				accessedAt: now,
				url
			}, attemptId, false, token);
		}
		if (response.status < 200 || response.status >= 300) {
			throw new ResourceRequestError(response.status);
		}

		const hash = hashContent(response.body);
		if (current && hasContent(current) && current.hash === hash) {
			return await this.completeSuccess({
				...current,
				url,
				checkedAt: now,
				accessedAt: now,
				etag: response.etag || current.etag,
				lastModified: response.lastModified || current.lastModified
			}, attemptId, false, token);
		}

		const record: ResourceRecordDraft = {
			...(current || {}),
			identity,
			url,
			content: response.body,
			hash,
			etag: response.etag,
			lastModified: response.lastModified,
			updatedAt: now,
			checkedAt: now,
			accessedAt: now,
			requestStatus: 'success',
			requestStatusUpdatedAt: now,
			statusHistory: current?.statusHistory || [],
			contentHistoryId: attemptId,
			contentHistoryIndex: null,
			previous: current && hasContent(current)
				? {
						content: current.content,
						hash: current.hash,
						updatedAt: current.updatedAt
					}
				: undefined
		};
		return await this.completeSuccess(record, attemptId, true, token);
	}

	private async completeSuccess(
		record: ResourceRecordDraft,
		attemptId: string,
		contentChanged: boolean,
		token: ResourceMutationToken
	) {
		const timestamp = Date.now();
		const next = await this.writeRecord({
			...record,
			requestStatus: 'success',
			requestStatusUpdatedAt: timestamp,
			statusHistory: updateHistoryStatus(
				record.statusHistory,
				attemptId,
				'success',
				timestamp
			),
			contentHistoryId: contentChanged ? attemptId : record.contentHistoryId,
			reason: undefined
		}, true, token);
		if (!hasContent(next)) throw new TypeError('Successful resource has no content');
		if (contentChanged) {
			this.subscribers.get(resourceIdentityKey(next.identity))?.forEach((listener) => {
				try {
					listener(next);
				} catch {
					// 内容 observer 不得改变资源请求结果。
				}
			});
		}
		return next;
	}
}

export const Gateway = new ResourceGateway();
