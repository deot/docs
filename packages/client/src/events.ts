import { Gateway } from './modules';
import { createResourceIdentity, getDefaultLanguage } from './utils/resolver';
import { getDocsConfig, getDocsRuntime } from './utils/runtime';
import type { DocsResourceType } from './types';

type DocsResourceEvent = {
	type: 'reload';
	timestamp: number;
} | {
	type: 'add' | 'change' | 'unlink';
	/** 空字符串表示所有已配置语言共用的仓库级资源。 */
	lang: string;
	source: string;
	resourceType: DocsResourceType;
	timestamp: number;
};

const EVENT_TYPES: DocsResourceEvent['type'][] = ['add', 'change', 'unlink', 'reload'];
const RESOURCE_TYPES: DocsResourceType[] = ['markdown', 'sidebar', 'sfc', 'module', 'style'];

const isDocsResourceEvent = (value: unknown): value is DocsResourceEvent => {
	if (!value || typeof value !== 'object') return false;
	const event = value as Partial<{
		type: DocsResourceEvent['type'];
		lang: string;
		source: string;
		resourceType: DocsResourceType;
		timestamp: number;
	}>;
	if (!event.type || !EVENT_TYPES.includes(event.type)
		|| typeof event.timestamp !== 'number') return false;
	if (event.type === 'reload') return true;
	return typeof event.lang === 'string'
		&& typeof event.source === 'string'
		&& Boolean(event.resourceType && RESOURCE_TYPES.includes(event.resourceType));
};

const revalidateSilently = async (identity: Parameters<typeof Gateway.revalidate>[0]) => {
	try {
		await Gateway.revalidate(identity, {
			priority: 75,
			// 文件事件可能在上一请求仍进行时到达；合并为一次尾随校验，
			// 确保最终读取到磁盘上的最新状态。
			trailing: true
		});
	} catch {
		// SSE 重新校验失败时继续保留最近可用内容。
	}
};

export const connectResourceEvents = () => {
	const runtime = getDocsRuntime();
	if (runtime.mode !== 'development' || !runtime.events || typeof EventSource === 'undefined') {
		return () => undefined;
	}
	const config = getDocsConfig();
	const events = new EventSource(runtime.events);
	events.onmessage = (message) => {
		let value: unknown;
		try {
			value = JSON.parse(message.data);
		} catch {
			return;
		}
		if (!isDocsResourceEvent(value)) return;
		const event = value;
		if (event.type === 'reload') {
			location.reload();
			return;
		}
		const configuredLanguages = Object.keys(config.locales);
		const languages = event.lang
			? [event.lang]
			: configuredLanguages.length
				? configuredLanguages
				: [getDefaultLanguage(config)];
		languages.forEach((lang) => {
			const identity = createResourceIdentity(
				config,
				lang,
				event.resourceType,
				event.source
			);
			// 即使尚无组件订阅，预加载资源也属于需要维护的热缓存。
			if (!Gateway.isSubscribed(identity) && !Gateway.isPrefetched(identity)) return;
			// unlink 同样触发校验：缓存内容仍可使用，并将 requestStatus 标记为 error；
			// 原子保存产生的 unlink/add 事件也能被安全合并。
			void revalidateSilently(identity);
		});
	};
	return () => events.close();
};
