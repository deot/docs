import { createBuiltinStyles, createCdnResolver } from '../cdn';
import { getPlaygroundSiteStyles, getPlaygroundStyleOverrides } from '../import-map';

// iframe 与 local 共用：内置 CSS → 站点 styles → 管理页覆盖。
export const createRuntimeStyleUrls = (cdnURL?: string): string[] => {
	const resolve = createCdnResolver(cdnURL);
	return [...new Set(Object.values({
		...createBuiltinStyles(cdnURL),
		...getPlaygroundSiteStyles(),
		...getPlaygroundStyleOverrides()
	}).map(resolve))];
};

interface SharedStyle {
	link: HTMLLinkElement;
	owned: boolean;
	references: number;
}

const sharedStyles = new Map<string, SharedStyle>();

// 同一 URL 只加载一次；宿主已有的样式表不由 Playground 删除。
export const acquireRuntimeStyles = (urls: string[]): (() => void) => {
	const records = [...new Set(urls.map(url => new URL(url, document.baseURI).href))].map((url) => {
		let record = sharedStyles.get(url);
		if (!record) {
			const existing = [...document.querySelectorAll<HTMLLinkElement>('link[rel~="stylesheet"]')]
				.find(link => link.href === url && !link.disabled);
			const link = existing || document.createElement('link');
			record = { link, owned: !existing, references: 0 };
			sharedStyles.set(url, record);
			if (!existing) {
				link.rel = 'stylesheet';
				link.href = url;
				link.setAttribute('data-playground-style', '');
				document.head.appendChild(link);
			}
		}
		record.references += 1;
		return { url, record };
	});
	let released = false;
	return () => {
		if (released) return;
		released = true;
		records.forEach(({ url, record }) => {
			record.references -= 1;
			if (record.references) return;
			if (record.owned) record.link.remove();
			sharedStyles.delete(url);
		});
	};
};
