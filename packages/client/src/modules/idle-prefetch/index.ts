import { Gateway } from '../gateway';
import { ResourcePlan } from '../resource-plan';
import { resourceIdentityKey } from '../../utils/resolver';
import type { DocsConfig, DocsPrefetchOptions, ResourceIdentity } from '../../types';
import type { ResourceContentRecord } from '../gateway';

const DEFAULT_BATCH_SIZE = 2;
const DEFAULT_IDLE_TIMEOUT = 1500;
const FALLBACK_DELAY = 16;

type PrefetchResult = PromiseSettledResult<ResourceContentRecord>;
type IdleHandle = { id: number; type: 'idle' | 'timer' };
type IdleWindow = Window & {
	cancelIdleCallback?: (handle: number) => void;
	requestIdleCallback?: (
		callback: (deadline: { didTimeout: boolean; timeRemaining: () => number }) => void,
		options?: { timeout: number }
	) => number;
};

export interface NormalizedDocsPrefetchOptions {
	batchSize: number;
	idleTimeout: number;
}

/**
 * 封装浏览器空闲预加载入口；实例只提供稳定方法，每次 start 的运行状态
 * 均保留在独立闭包中，多个会话之间不会共享完成记录或取消信号。
 */
class IdlePrefetchScheduler {
	/**
	 * 规范化站点预加载配置；对象表示开启，非法数值回退到安全默认值。
	 * @param value 用户声明的预加载配置。
	 * @returns 关闭时返回 null，否则返回完整配置。
	 */
	normalizeOptions(
		value: DocsConfig['prefetch']
	): NormalizedDocsPrefetchOptions | null {
		if (value === false) return null;
		const options: DocsPrefetchOptions = typeof value === 'object' ? value : {};
		const requestedBatchSize = Number(options.batchSize);
		const requestedIdleTimeout = Number(options.idleTimeout);
		return {
			batchSize: Number.isFinite(requestedBatchSize) && requestedBatchSize > 0
				? Math.min(20, Math.max(1, Math.floor(requestedBatchSize)))
				: DEFAULT_BATCH_SIZE,
			idleTimeout: Number.isFinite(requestedIdleTimeout) && requestedIdleTimeout >= 0
				? requestedIdleTimeout
				: DEFAULT_IDLE_TIMEOUT
		};
	}

	/**
	 * 创建不依赖 DOMException 可用性的标准取消异常。
	 * @returns name 为 AbortError 的错误对象。
	 */
	private createAbortError() {
		const error = new Error('Idle prefetch aborted');
		error.name = 'AbortError';
		return error;
	}

	/**
	 * 创建自动空闲预加载会话。首轮立即等待浏览器空闲；失败资源在 online 后继续补齐。
	 * @param config 当前站点配置。
	 * @param target 用于注册 idle、timer 和 online 的窗口，测试时可注入。
	 * @returns 取消空闲回调、联网监听和当前预加载 consumer 的函数。
	 */
	start(
		config: DocsConfig,
		target: IdleWindow = window
	) {
		const options = this.normalizeOptions(config.prefetch);
		if (!options) return () => undefined;

		const completed = new Set<string>();
		const failed = new Set<string>();
		const controller = new AbortController();
		let idleHandle: IdleHandle | null = null;
		let running = false;
		let retryRequested = false;
		let needsRetry = false;
		let stopped = false;

		const cancelIdle = () => {
			if (!idleHandle) return;
			if (idleHandle.type === 'idle') target.cancelIdleCallback?.(idleHandle.id);
			else target.clearTimeout(idleHandle.id);
			idleHandle = null;
		};

		/** 每批网络请求前重新等待空闲，避免一次计划持续占用主线程和网络。 */
		const waitForIdle = () => new Promise<void>((resolve, reject) => {
			if (controller.signal.aborted) {
				reject(this.createAbortError());
				return;
			}
			const cleanup = () => {
				controller.signal.removeEventListener('abort', handleAbort);
				idleHandle = null;
			};
			const handleReady = () => {
				cleanup();
				resolve();
			};
			const handleAbort = () => {
				cancelIdle();
				cleanup();
				reject(this.createAbortError());
			};
			controller.signal.addEventListener('abort', handleAbort, { once: true });
			if (typeof target.requestIdleCallback === 'function') {
				idleHandle = {
					id: target.requestIdleCallback(handleReady, { timeout: options.idleTimeout }),
					type: 'idle'
				};
			} else {
				idleHandle = {
					id: target.setTimeout(handleReady, FALLBACK_DELAY),
					type: 'timer'
				};
			}
		});

		/**
		 * 计划构建器会分阶段调用该函数；已成功资源返回合成结果，避免联网恢复时重复下载。
		 * @param identities 当前阶段需要准备的资源。
		 * @returns 与 identities 顺序一致的 settled 结果。
		 */
		const prefetchResources = async (identities: ResourceIdentity[]) => {
			const results = new Array<PrefetchResult>(identities.length);
			const pending = identities
				.map((identity, index) => ({ identity, index }))
				.filter(({ identity, index }) => {
					if (!completed.has(resourceIdentityKey(identity))) return true;
					results[index] = {
						status: 'fulfilled',
						value: undefined as unknown as ResourceContentRecord
					};
					return false;
				});

			for (let index = 0; index < pending.length; index += options.batchSize) {
				await waitForIdle();
				const batch = pending.slice(index, index + options.batchSize);
				const batchResults = await Gateway.prefetch(
					batch.map(item => item.identity),
					{ priority: 25, signal: controller.signal }
				);
				batch.forEach((item, batchIndex) => {
					const key = resourceIdentityKey(item.identity);
					const result = batchResults[batchIndex];
					results[item.index] = result;
					if (result.status === 'fulfilled') {
						completed.add(key);
						failed.delete(key);
					} else {
						failed.add(key);
					}
				});
			}
			return results;
		};

		/** 串行运行完整计划；online 发生在执行期间时只追加一轮恢复。 */
		const run = async () => {
			if (running || stopped) return;
			running = true;
			retryRequested = false;
			try {
				await ResourcePlan.build({ config, graphFirst: true, prefetchResources });
				needsRetry = failed.size > 0;
			} catch (reason) {
				if ((reason as Error)?.name !== 'AbortError') needsRetry = true;
			} finally {
				running = false;
				if (!stopped && retryRequested && needsRetry) void run();
			}
		};

		const handleOnline = () => {
			if (stopped || (!running && !needsRetry)) return;
			if (running) {
				retryRequested = true;
				return;
			}
			void run();
		};

		target.addEventListener('online', handleOnline);
		void run();

		return () => {
			if (stopped) return;
			stopped = true;
			cancelIdle();
			controller.abort();
			target.removeEventListener('online', handleOnline);
		};
	}
}

/** Client 启动流程共用的无状态空闲预加载实例。 */
export const IdlePrefetch = new IdlePrefetchScheduler();
