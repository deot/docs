import type { LocationQuery } from 'vue-router';

/**
 * 单个 styles 参数按逗号分隔；重复参数各自是一条完整 URL。
 * @param value Router 已解码的 styles 参数。
 * @param base 用于解析站点根路径的页面地址。
 * @returns 按声明顺序去重的样式 URL。
 */
export const parsePreviewStyleUrls = (value: LocationQuery[string] | undefined, base: string): string[] => {
	const items = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [];
	return [...new Set(items.flatMap((item) => {
		const href = item?.trim();
		if (!href) return [];
		if (href.includes('\\') || (!/^https?:\/\//i.test(href) && !(href.startsWith('/') && !href.startsWith('//')))) {
			throw new TypeError(`Invalid stylesheet URL: ${href}`);
		}
		const url = new URL(href, base);
		if (!/^https?:$/.test(url.protocol)) throw new TypeError(`Invalid stylesheet URL: ${href}`);
		return [url.href];
	}))];
};

interface SharedStyle {
	link: HTMLLinkElement;
	owned: boolean;
	listeners: Set<(url: string) => void>;
	failed: boolean;
	handleError: () => void;
}

const sharedStyles = new Map<string, SharedStyle>();

/**
 * 复用同一 URL 的 stylesheet，只清理本工具创建且已无引用的节点。
 * @param urls 已归一化的样式 URL，按加载顺序排列。
 * @param onError 当前预览的样式加载错误回调。
 * @returns 释放当前预览引用的函数。
 */
export const acquirePreviewStyles = (urls: string[], onError: (url: string) => void): (() => void) => {
	// 每次 acquire 使用独立引用，即使调用者复用了同一个回调函数。
	const listener = (url: string) => onError(url);
	const records = [...new Set(urls)].map((url) => {
		let record = sharedStyles.get(url);
		if (!record) {
			const existing = [...document.querySelectorAll<HTMLLinkElement>('link[rel~="stylesheet"]')]
				.find(link => link.href === url && !link.disabled);
			const link = existing || document.createElement('link');
			record = {
				link,
				owned: !existing,
				listeners: new Set(),
				failed: false,
				handleError: () => {
					record!.failed = true;
					record!.listeners.forEach(callback => callback(url));
				}
			};
			sharedStyles.set(url, record);
			link.addEventListener('error', record.handleError);
			if (!existing) {
				link.rel = 'stylesheet';
				link.href = url;
				link.setAttribute('data-docs-preview-style', '');
				document.head.appendChild(link);
			}
		}
		record.listeners.add(listener);
		if (record.failed) listener(url);
		return { url, record };
	});
	return () => records.forEach(({ url, record }) => {
		record.listeners.delete(listener);
		if (record.listeners.size || sharedStyles.get(url) !== record) return;
		record.link.removeEventListener('error', record.handleError);
		if (record.owned) record.link.remove();
		sharedStyles.delete(url);
	});
};
