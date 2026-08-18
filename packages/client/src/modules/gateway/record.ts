import type {
	ResourceContentRecord,
	ResourceRecord,
	ResourceRecordInput,
	ResourceStatus,
	ResourceStatusHistory
} from './types';

const HISTORY_LIMIT = 20;
const REASON_LIMIT = 1000;
const RESOURCE_STATUSES: ResourceStatus[] = ['waiting', 'pending', 'success', 'error'];
let attemptSequence = 0;

export const hashContent = (content: string) => {
	let hash = 2166136261;
	for (let index = 0; index < content.length; index++) {
		hash ^= content.charCodeAt(index);
		hash = Math.imul(hash, 16777619);
	}
	return (hash >>> 0).toString(16);
};

const isResourceStatus = (value: unknown): value is ResourceStatus => (
	typeof value === 'string' && RESOURCE_STATUSES.includes(value as ResourceStatus)
);

const isInteger = (value: unknown): value is number => Number.isInteger(value);

export const hasContent = (record: ResourceRecord): record is ResourceContentRecord => (
	typeof record.content === 'string'
	&& typeof record.hash === 'string'
	&& typeof record.updatedAt === 'number'
);

export const normalizeReason = (reason: unknown, fallback = 'Resource request failed') => {
	let value = '';
	if (reason instanceof Error) value = reason.message;
	else if (reason && typeof reason === 'object'
		&& typeof (reason as { message?: unknown }).message === 'string') {
		value = (reason as { message: string }).message;
	} else if (typeof reason === 'string') value = reason;
	return (value.trim() || fallback).slice(0, REASON_LIMIT);
};

export const createAttemptId = (timestamp = Date.now()) => {
	const randomId = globalThis.crypto?.randomUUID?.();
	return randomId || `${timestamp}-${++attemptSequence}`;
};

const createSyntheticSuccess = (timestamp: number): ResourceStatusHistory => ({
	id: createAttemptId(timestamp),
	status: 'success',
	createdAt: timestamp,
	completedAt: timestamp
});

const normalizeHistoryEntry = (value: any, index: number): ResourceStatusHistory => {
	const createdAt = typeof value?.createdAt === 'number' ? value.createdAt : Date.now();
	const status = isResourceStatus(value?.status) ? value.status : 'error';
	return {
		id: typeof value?.id === 'string' && value.id
			? value.id
			: `${createAttemptId(createdAt)}-${index}`,
		status,
		createdAt,
		waitingAt: typeof value?.waitingAt === 'number' ? value.waitingAt : undefined,
		pendingAt: typeof value?.pendingAt === 'number' ? value.pendingAt : undefined,
		completedAt: typeof value?.completedAt === 'number' ? value.completedAt : undefined,
		reason: status === 'error' ? normalizeReason(value?.reason) : undefined
	};
};

const compactStatusHistory = (
	history: ResourceStatusHistory[],
	contentHistoryId: string | null
) => {
	const protectedEntry = contentHistoryId
		? history.find(entry => entry.id === contentHistoryId && entry.status === 'success')
		: undefined;
	if (!protectedEntry) {
		const nextHistory = history.slice(-HISTORY_LIMIT);
		return { history: nextHistory, contentHistoryId: null, contentHistoryIndex: null };
	}

	/*
	 * 保护产生当前内容的请求，而不是最近一次成功请求。旧 attempt 被移除后，
	 * 数组下标会变化，因此稳定 ID 是唯一事实，每次裁剪后都要重新计算 index。
	 */
	const recentIds = new Set(
		history
			.filter(entry => entry.id !== protectedEntry.id)
			.slice(-(HISTORY_LIMIT - 1))
			.map(entry => entry.id)
	);
	const nextHistory = history.filter(entry => (
		entry.id === protectedEntry.id || recentIds.has(entry.id)
	));
	return {
		history: nextHistory,
		contentHistoryId: protectedEntry.id,
		contentHistoryIndex: nextHistory.findIndex(entry => entry.id === protectedEntry.id)
	};
};

// 每次经过缓存边界前修复旧记录，并派生内容状态。
export const normalizeResourceRecord = (legacy: ResourceRecordInput): ResourceRecord => {
	const now = Date.now();
	const content = typeof legacy.content === 'string' ? legacy.content : undefined;
	const contentAvailable = content !== undefined;
	const checkedAt = typeof legacy.checkedAt === 'number' ? legacy.checkedAt : 0;
	const accessedAt = typeof legacy.accessedAt === 'number' ? legacy.accessedAt : 0;
	// 内容时间戳始终可计算，仅在没有内容时才不写入记录。
	const contentUpdatedAt = typeof legacy.updatedAt === 'number'
		? legacy.updatedAt
		: checkedAt || accessedAt || now;
	const updatedAt = contentAvailable ? contentUpdatedAt : undefined;
	const requestStatus = isResourceStatus(legacy.requestStatus)
		? legacy.requestStatus
		: contentAvailable ? 'success' : 'error';
	const requestStatusUpdatedAt = typeof legacy.requestStatusUpdatedAt === 'number'
		? legacy.requestStatusUpdatedAt
		: checkedAt || updatedAt || accessedAt || now;

	const history = Array.isArray(legacy.statusHistory)
		? legacy.statusHistory.map(normalizeHistoryEntry)
		: [];

	let contentHistoryId = typeof legacy.contentHistoryId === 'string'
		? legacy.contentHistoryId
		: null;
	let source = contentHistoryId
		? history.find(entry => entry.id === contentHistoryId && entry.status === 'success')
		: undefined;
	if (!source && isInteger(legacy.contentHistoryIndex)) {
		const indexed = history[legacy.contentHistoryIndex];
		if (indexed?.status === 'success') {
			source = indexed;
			contentHistoryId = indexed.id;
		}
	}
	if (contentAvailable && !source) {
		source = createSyntheticSuccess(contentUpdatedAt);
		history.push(source);
		contentHistoryId = source.id;
	}
	if (!contentAvailable) contentHistoryId = null;

	const compacted = compactStatusHistory(history, contentHistoryId);
	const fallbackReason = contentAvailable
		? 'Resource request failed'
		: 'Legacy resource has no content';
	const reason = requestStatus === 'error'
		? normalizeReason(legacy.reason, fallbackReason)
		: undefined;
	const normalized = {
		...legacy,
		status: contentAvailable ? 'success' : requestStatus,
		requestStatus,
		requestStatusUpdatedAt,
		statusHistory: compacted.history,
		contentHistoryId: compacted.contentHistoryId,
		contentHistoryIndex: compacted.contentHistoryIndex,
		reason,
		content,
		hash: contentAvailable
			? (typeof legacy.hash === 'string' ? legacy.hash : hashContent(content))
			: undefined,
		updatedAt,
		checkedAt,
		accessedAt
	};
	// statusUpdatedAt 属于旧的单状态 schema；懒迁移后若继续持久化，
	// 会导致请求时间和内容时间含义不清。
	delete normalized.statusUpdatedAt;
	return normalized;
};

export const recordsEqual = (left: unknown, right: unknown) => (
	JSON.stringify(left) === JSON.stringify(right)
);

export const updateHistoryStatus = (
	history: ResourceStatusHistory[],
	attemptId: string,
	status: ResourceStatus,
	timestamp: number,
	reason?: string
) => {
	const index = history.findIndex(entry => entry.id === attemptId);
	const current = index >= 0
		? history[index]
		: { id: attemptId, status, createdAt: timestamp };
	const next: ResourceStatusHistory = {
		...current,
		status,
		waitingAt: status === 'waiting' ? current.waitingAt || timestamp : current.waitingAt,
		pendingAt: status === 'pending' ? current.pendingAt || timestamp : current.pendingAt,
		completedAt: status === 'success' || status === 'error' ? timestamp : current.completedAt,
		reason: status === 'error' ? normalizeReason(reason) : undefined
	};
	if (index < 0) return [...history, next];
	return history.map((entry, entryIndex) => entryIndex === index ? next : entry);
};
