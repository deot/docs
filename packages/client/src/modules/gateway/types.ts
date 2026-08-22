import type { ResourceIdentity } from '../../types';

export type ResourceStatus = 'waiting' | 'pending' | 'success' | 'error';

/**
 * HTTP 响应已到达但状态不可用，保留状态码供业务区分 404 与传输故障。
 */
export class ResourceRequestError extends Error {
	constructor(public readonly status: number, message = `HTTP ${status}`) {
		super(message);
		this.name = 'ResourceRequestError';
	}
}

export interface ResourceVersion {
	content: string;
	/**
	 * 内容指纹，由 `hashContent` 计算，不是 HTTP ETag。
	 */
	hash: string;
	/**
	 * 该份内容最后一次实际变化的 Unix 毫秒时间。
	 */
	updatedAt: number;
}

export interface ResourceStatusHistory {
	/**
	 * 单次请求生命周期的稳定标识，状态变化必须复用该 ID。
	 */
	id: string;
	/**
	 * 该请求生命周期的当前或最终状态。
	 */
	status: ResourceStatus;
	/**
	 * 该 attempt 创建时间。
	 */
	createdAt: number;
	/**
	 * 进入排队等待的时间。未排队则缺省。
	 */
	waitingAt?: number;
	/**
	 * 真正发出网络请求的时间。
	 */
	pendingAt?: number;
	/**
	 * 成功或失败结束的时间。
	 */
	completedAt?: number;
	/**
	 * 仅失败 attempt 保存，最长 1000 个字符。
	 */
	reason?: string;
}

export interface ResourceRecord {
	identity: ResourceIdentity;
	/**
	 * 解析后的 HTTP URL，不是逻辑 `source`。
	 */
	url: string;
	/**
	 * 内容可用状态由 normalizeResourceRecord 派生，请求流程不得直接赋值：
	 * 字符串 content 表示 success，否则跟随 requestStatus。
	 */
	status: ResourceStatus;
	/**
	 * 最近一次请求的实际生命周期状态。
	 */
	requestStatus: ResourceStatus;
	/**
	 * `requestStatus` 最近一次变化的时间。
	 */
	requestStatusUpdatedAt: number;
	statusHistory: ResourceStatusHistory[];
	/**
	 * 产生当前内容的请求所对应的稳定 history ID。
	 */
	contentHistoryId: string | null;
	/**
	 * history 裁剪后由 contentHistoryId 派生的从零开始位置。
	 */
	contentHistoryIndex: number | null;
	reason?: string;
	/**
	 * 最近一次成功内容；空字符串也是有效缓存内容。
	 */
	content?: string;
	/**
	 * 当前成功内容的指纹，与 `ResourceVersion.hash` 同算法。
	 */
	hash?: string;
	/**
	 * 成功内容最后一次实际变化的时间。
	 */
	updatedAt?: number;
	/**
	 * 条件请求用的 HTTP ETag，不是内容指纹 `hash`。
	 */
	etag?: string;
	/**
	 * 条件请求用的 HTTP Last-Modified。
	 */
	lastModified?: string;
	/**
	 * 最近一次成功完成服务端校验的时间。
	 */
	checkedAt: number;
	/**
	 * 最近一次被读取或消费的时间，用于缓存清理，不代表内容变更。
	 */
	accessedAt: number;
	/**
	 * 被当前成功内容替换掉的上一份正文，供回滚与对比。
	 */
	previous?: ResourceVersion;
}

export interface ResourceContentRecord extends ResourceRecord {
	status: 'success';
	content: string;
	hash: string;
	updatedAt: number;
}

/**
 * Gateway 内部构建中的记录；status 始终由 normalizeResourceRecord 派生。
 */
export type ResourceRecordDraft = Omit<ResourceRecord, 'status'> & {
	status?: ResourceStatus;
};

/**
 * normalizeResourceRecord 会重新派生的字段；持久化旧记录里这些字段不可信。
 */
type LegacyResourceField = Exclude<keyof ResourceRecord, 'identity' | 'url' | 'etag' | 'lastModified' | 'previous'>;

/**
 * 缓存边界的记录输入：既接受内部草稿，也接受字段不可信的旧持久化记录，
 * 因此所有待重新派生的字段都是 unknown，由规范化流程逐个窄化。
 */
export type ResourceRecordInput = Omit<ResourceRecord, LegacyResourceField> & {
	[K in LegacyResourceField]?: unknown;
} & {
	/**
	 * 旧单状态 schema 的遗留字段，规范化时删除。
	 */
	statusUpdatedAt?: unknown;
};

export interface ResourceLoadOptions {
	/**
	 * 覆盖 identity 解析出的 URL。仅调试或自定义传输时使用。
	 */
	url?: string;
	/**
	 * Scheduler 优先级，数值越大越先发。
	 */
	priority?: number;
	/**
	 * 忽略新鲜度，强制再向服务器校验。
	 */
	refresh?: boolean;
	signal?: AbortSignal;
	/**
	 * 将请求进行期间收到的新鲜度通知合并为一次额外校验。普通并发调用保持
	 * 关闭并共享当前 attempt。
	 */
	trailing?: boolean;
}

export interface ResourcePollOptions {
	/**
	 * 轮询间隔毫秒。
	 */
	interval?: number;
	priority?: number;
}

export interface ResourcePrefetchOptions {
	/**
	 * 预加载进入共享 Scheduler 时使用的优先级，默认 25。
	 */
	priority?: number;
	/**
	 * 取消当前调用方；没有其他 consumer 时同时取消底层请求。
	 */
	signal?: AbortSignal;
}

/**
 * 预取批次中单个资源的 settled 结果。消费方只依赖 status 做统计与重试判断，
 * 因此 fulfilled 分支的 value 可省略（如离线恢复时的合成结果）。
 */
export type ResourcePrefetchOutcome
	= | { status: 'fulfilled'; value?: ResourceContentRecord }
		| { status: 'rejected'; reason: unknown };

export interface ResourceGatewayOptions {
	/**
	 * 同时进行的网络请求上限。
	 */
	concurrency?: number;
	cache?: ResourceCache;
	request?: ResourceRequest;
}

export interface ResourceCache {
	get(key: string): Promise<ResourceRecordInput | null>;
	set(key: string, value: ResourceRecord): Promise<void>;
	remove(key: string): Promise<void>;
	list(): Promise<ResourceRecordInput[]>;
	clear(): Promise<void>;
}

export interface TextResponse {
	status: number;
	/**
	 * 响应正文文本。Gateway 不在传输层解析 JSON。
	 */
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
	/**
	 * Gateway 全局修订号。任意资源写入成功后递增。
	 */
	global: number;
	/**
	 * 当前资源键的修订号。用来发现并发写入是否已让本次操作过期。
	 */
	resource: number;
}
