import type { ResourceIdentity } from '../../types';

export type ResourceStatus = 'waiting' | 'pending' | 'success' | 'error';

export interface ResourceVersion {
	content: string;
	hash: string;
	updatedAt: number;
}

export interface ResourceStatusHistory {
	/** 单次请求生命周期的稳定标识，状态变化必须复用该 ID。 */
	id: string;
	/** 该请求生命周期的当前或最终状态。 */
	status: ResourceStatus;
	createdAt: number;
	waitingAt?: number;
	pendingAt?: number;
	completedAt?: number;
	/** 仅失败 attempt 保存，最长 1000 个字符。 */
	reason?: string;
}

export interface ResourceRecord {
	identity: ResourceIdentity;
	url: string;
	/**
	 * 内容可用状态由 normalizeResourceRecord 派生，请求流程不得直接赋值：
	 * 字符串 content 表示 success，否则跟随 requestStatus。
	 */
	status: ResourceStatus;
	/** 最近一次请求的实际生命周期状态。 */
	requestStatus: ResourceStatus;
	requestStatusUpdatedAt: number;
	statusHistory: ResourceStatusHistory[];
	/** 产生当前内容的请求所对应的稳定 history ID。 */
	contentHistoryId: string | null;
	/** history 裁剪后由 contentHistoryId 派生的从零开始位置。 */
	contentHistoryIndex: number | null;
	reason?: string;
	/** 最近一次成功内容；空字符串也是有效缓存内容。 */
	content?: string;
	hash?: string;
	/** 成功内容最后一次实际变化的时间。 */
	updatedAt?: number;
	etag?: string;
	lastModified?: string;
	/** 最近一次成功完成服务端校验的时间。 */
	checkedAt: number;
	accessedAt: number;
	previous?: ResourceVersion;
}

export interface ResourceContentRecord extends ResourceRecord {
	status: 'success';
	content: string;
	hash: string;
	updatedAt: number;
}

export type ResourceRecordInput = Omit<ResourceRecord, 'status'> & {
	/** 仅兼容持久化旧记录；规范化后一定会替换该字段。 */
	status?: ResourceStatus;
};

export interface ResourceLoadOptions {
	url?: string;
	priority?: number;
	refresh?: boolean;
	signal?: AbortSignal;
	/**
	 * 将请求进行期间收到的新鲜度通知合并为一次额外校验。普通并发调用保持
	 * 关闭并共享当前 attempt。
	 */
	trailing?: boolean;
}

export interface ResourcePollOptions {
	interval?: number;
	priority?: number;
}

export interface ResourceGatewayOptions {
	concurrency?: number;
	cache?: ResourceCache;
	request?: ResourceRequest;
}

export interface ResourceCache {
	get(key: string): Promise<ResourceRecord | null>;
	set(key: string, value: ResourceRecord): Promise<void>;
	remove(key: string): Promise<void>;
	list(): Promise<ResourceRecord[]>;
	clear(): Promise<void>;
}

export interface TextResponse {
	status: number;
	body: string;
	etag?: string;
	lastModified?: string;
}

export type ResourceRequest = (
	url: string,
	headers: Record<string, string>,
	signal?: AbortSignal
) => Promise<TextResponse>;

export interface ResourceMutationToken {
	global: number;
	resource: number;
}
