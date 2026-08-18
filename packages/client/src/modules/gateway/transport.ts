import { Network } from '../network';
import { ResourceRequestError } from './types';
import type { ResourceRequest, TextResponse } from './types';

interface SharedTransport {
	headersKey: string;
	promise: Promise<TextResponse>;
	consumers: Set<symbol>;
	settled: boolean;
	cancelled: boolean;
	cancel: () => Promise<void>;
}

const sharedTransports = new Map<string, SharedTransport>();

const getHeader = (headers: any, name: string) => (
	headers?.get?.(name) || headers?.get?.(name.toLowerCase())
);

const getHTTPErrorMessage = (error: any) => {
	const status = typeof error?.status === 'number' || typeof error?.status === 'string'
		? String(error.status).trim()
		: '';
	const responseStatusText = typeof error?.body?.statusText === 'string'
		? error.body.statusText.trim()
		: '';
	const errorStatusText = typeof error?.statusText === 'string'
		&& !/^HTTP_[A-Z0-9_]+$/.test(error.statusText)
		? error.statusText.trim()
		: '';
	const detail = responseStatusText || errorStatusText;
	if (status && detail) return `${status} ${detail}`;
	if (status) return `HTTP ${status}`;
	return detail || 'Resource request failed';
};

const normalizeHeadersKey = (headers: Record<string, string>) => JSON.stringify(
	Object.entries(headers)
		.map(([key, value]) => [key.toLowerCase(), value] as const)
		.sort(([left], [right]) => left.localeCompare(right))
);

const normalizeUrlKey = (url: string) => {
	try {
		return new URL(
			url,
			typeof location === 'undefined' ? undefined : location.href
		).href;
	} catch {
		return url;
	}
};

export const createAbortError = () => new DOMException(
	'The operation was aborted',
	'AbortError'
);

// 让任务与调用方取消信号竞争，但不改变任务所有权。
export const withAbort = async <T>(run: () => Promise<T>, signal?: AbortSignal) => {
	if (!signal) return await run();
	if (signal.aborted) throw createAbortError();
	let rejectAbort!: (reason: unknown) => void;
	const aborted = new Promise<never>((_resolve, reject) => {
		rejectAbort = reject;
	});
	const abort = () => rejectAbort(createAbortError());
	signal.addEventListener('abort', abort, { once: true });
	try {
		return await Promise.race([run(), aborted]);
	} finally {
		signal.removeEventListener('abort', abort);
	}
};

const consumeTransport = async (entry: SharedTransport, signal?: AbortSignal) => {
	const consumer = Symbol('transport-consumer');
	entry.consumers.add(consumer);
	let rejectAbort!: (reason: unknown) => void;
	const aborted = new Promise<never>((_resolve, reject) => {
		rejectAbort = reject;
	});
	const abort = () => {
		entry.consumers.delete(consumer);
		rejectAbort(createAbortError());
		if (entry.settled || entry.consumers.size) return;
		entry.cancelled = true;
		void entry.cancel();
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
	}
};

const createTransport = (
	url: string,
	key: string,
	headers: Record<string, string>
) => {
	/**
	 * 遵循应用侧 `shared: currentFunction` 约定，同时让 key 仅属于当前 URL
	 * 生命周期。HTTP 会保留成功的 shared leaf，直到显式移除；Gateway 则必须
	 * 在请求 settled 后结束共享，确保下一次 revalidate 能读取新内容。
	 * @returns 当前资源请求对应的可取消 HTTP leaf。
	 */
	const requestResource = () => Network.http<string>(url, {
		headers: {
			Accept: 'text/plain',
			...headers
		},
		responseType: 'text',
		shared: requestResource
	});
	const leaf = requestResource();
	let cancelPromise: Promise<void> | null = null;
	const cancel = () => {
		if (!cancelPromise) {
			cancelPromise = (async () => {
				try {
					await leaf.cancel();
				} catch {
					// consumer 已收到 AbortError，leaf 的取消清理不能再产生第二个
					// 未处理 rejection。
				}
			})();
		}
		return cancelPromise;
	};
	// promise 的清理逻辑需要回引 entry 自身，先构建其余字段，最后补上 promise。
	const init: Omit<SharedTransport, 'promise'> = {
		headersKey: normalizeHeadersKey(headers),
		consumers: new Set(),
		settled: false,
		cancelled: false,
		cancel
	};
	const target = (async (): Promise<TextResponse> => {
		try {
			const response = await leaf;
			return {
				status: response.status,
				body: typeof response.body === 'string'
					? response.body
					: JSON.stringify(response.body ?? ''),
				etag: getHeader(response.headers, 'etag'),
				lastModified: getHeader(response.headers, 'last-modified')
			};
		} catch (error: any) {
			if (error?.status === 304) return {
				status: 304,
				body: '',
				etag: getHeader(error.headers, 'etag'),
				lastModified: getHeader(error.headers, 'last-modified')
			};
			const message = getHTTPErrorMessage(error);
			const responseStatus = Number(error?.status);
			if (Number.isInteger(responseStatus) && responseStatus >= 100 && responseStatus <= 599) {
				throw new ResourceRequestError(responseStatus, message);
			}
			// 保留有意义的原生/网络错误，同时规范化 HTTP 结构的 Error 实例；
			// 部分 adapter 否则会把 body 显示成 [object Object]。
			if (
				error instanceof Error
				&& message === 'Resource request failed'
				&& error.message.trim()
				&& error.message.trim() !== '[object Object]'
			) throw error;
			throw new Error(message, { cause: error });
		}
	})();
	const entry: SharedTransport = Object.assign(init, {
		promise: (async () => {
			try {
				return await target;
			} finally {
				try {
					await Network.removeShared(requestResource);
				} catch {
					// leaf 可能已在报错或取消后自行移除。
				}
				init.settled = true;
				if (sharedTransports.get(key) === init) sharedTransports.delete(key);
			}
		})()
	});
	sharedTransports.set(key, entry);
	return entry;
};

/**
 * 将 \@deot/http leaf 适配为 Gateway 文本协议。本地 URL map 才是实际共享
 * 边界：\@deot/http 还会比较完整请求，因此仅使用 `shared` 时，条件请求头
 * 不同的相同 URL 仍会被拆成多个请求。
 *
 * 200 响应可安全复用于所有等待方；共享 304 仅适用于 validator 相同的调用方。
 * validator 不一致时，在首个 leaf settled 后发起无条件重试，从而既保证
 * 正确性，又维持每个 URL 同时只有一个活动 leaf。
 * @param url 最终资源 URL。
 * @param headers 条件请求头。
 * @param signal 当前传输 consumer 独立拥有的取消信号。
 * @returns 可在相同 URL 间安全共享的规范化文本响应。
 */
export const requestText: ResourceRequest = async (url, headers, signal) => {
	if (signal?.aborted) throw createAbortError();
	const key = normalizeUrlKey(url);
	let entry = sharedTransports.get(key);
	if (entry?.cancelled) {
		// 最后一个 consumer 取消后，leaf 可能仍需时间退出；等待物理取消完成后
		// 再创建替代请求，以保证每个 URL 只有一个活动 leaf。
		await entry.cancel();
		if (sharedTransports.get(key) === entry) sharedTransports.delete(key);
		entry = undefined;
	}
	if (!entry) entry = createTransport(url, key, headers);
	const response = await consumeTransport(entry, signal);
	if (response.status === 304 && entry.headersKey !== normalizeHeadersKey(headers)) {
		return await requestText(url, {}, signal);
	}
	return response;
};
