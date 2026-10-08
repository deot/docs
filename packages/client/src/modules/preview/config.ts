import { encode, decode } from '@deot/helper-unicode';
import type { ComputedRef, InjectionKey } from 'vue';
import type { LocationQuery } from 'vue-router';
import type { DocsPlaygroundComponentOptions } from '../../types';

export type PreviewPlayground = Pick<DocsPlaygroundComponentOptions,
	'local' | 'styleless' | 'views' | 'viewport' | 'previewInset' | 'expandable' | 'previewScroller'
> & { title?: string };

export interface PreviewConfig {
	url: string;
	styles: string[];
	modules: Record<string, string>;
	lang?: string;
	playground?: PreviewPlayground;
}

export const previewConfigKey: InjectionKey<ComputedRef<PreviewConfig | undefined>> = Symbol('preview-config');

const isPlainObject = (value: unknown): value is Record<string, unknown> => (
	value !== null && typeof value === 'object' && !Array.isArray(value)
);

const playgroundFields = ['local', 'styleless', 'views', 'viewport', 'previewInset', 'expandable', 'previewScroller', 'title'] as const;
const normalizePlayground = (value: unknown): PreviewPlayground => {
	if (!isPlainObject(value)) throw new TypeError('playground must be an object');
	// 只接收展示参数，files / entry 等实例数据仍由远程源码管理。
	return Object.fromEntries(playgroundFields.filter(key => key in value).map(key => [key, value[key]]));
};

/**
 * 校验链接中可序列化的预览配置，不混入站点配置。
 * @param value JSON 解码后的配置。
 * @returns 规范化的预览配置。
 */
export const normalizePreviewConfig = (value: unknown): PreviewConfig => {
	if (!isPlainObject(value)) throw new TypeError('raw must contain a configuration object');
	const input = value;
	if (typeof input.url !== 'string' || !input.url.trim()) throw new TypeError('url must be a non-empty string');
	if (input.styles !== undefined && (!Array.isArray(input.styles) || input.styles.some(item => typeof item !== 'string'))) {
		throw new TypeError('styles must be an array of URL strings');
	}
	if (input.modules !== undefined && (!isPlainObject(input.modules) || Object.entries(input.modules)
		.some(([key, url]) => !key.trim() || typeof url !== 'string' || !url.trim()))) {
		throw new TypeError('modules must map module names to URL strings');
	}
	if (input.lang !== undefined && typeof input.lang !== 'string') throw new TypeError('lang must be a string');
	return {
		url: input.url.trim(),
		styles: (input.styles as string[] | undefined) || [],
		modules: (input.modules as Record<string, string> | undefined) || {},
		...(input.lang ? { lang: input.lang as string } : {}),
		...(input.playground !== undefined ? { playground: normalizePlayground(input.playground) } : {})
	};
};

/**
 * raw 是完整配置；未指定时兼容现有 url/styles/lang 查询参数。
 * @param query Vue Router 已解码的查询参数。
 * @returns 当前链接的预览配置。
 */
export const readPreviewConfig = (query: LocationQuery): PreviewConfig => {
	if (query.raw !== undefined) {
		if (typeof query.raw !== 'string' || !query.raw) throw new TypeError('raw must be a single encoded configuration');
		return normalizePreviewConfig(JSON.parse(decode(query.raw)));
	}
	const styles = Array.isArray(query.styles) ? query.styles : typeof query.styles === 'string' ? query.styles.split(',') : [];
	return {
		url: typeof query.url === 'string' ? query.url.trim() : '',
		styles: styles.filter((item): item is string => typeof item === 'string'),
		modules: {},
		...(typeof query.lang === 'string' ? { lang: query.lang } : {})
	};
};

/**
 * 使用 Unicode helper 编码并正确转义 Base64 的 +、/、=。
 * @param config 预览配置。
 * @param base 站点部署根地址。
 * @returns 可直接分享的预览链接。
 */
export const createPreviewUrl = (config: PreviewConfig, base: string): string => {
	const url = new URL('__docs/preview', base);
	url.searchParams.set('raw', encode(JSON.stringify(config)));
	return url.href;
};

/**
 * 根据资源 URL 的 pathname 选择预览组件。
 * @param source 资源地址。
 * @param base 解析相对地址的页面地址。
 * @returns 支持的资源类型；其他资源返回 undefined。
 */
export const resolvePreviewType = (source: string, base: string): 'sfc' | 'page' | undefined => {
	const url = new URL(source, base);
	if (!/^https?:$/.test(url.protocol)) return undefined;
	if (/\.vue$/i.test(url.pathname)) return 'sfc';
	if (/(?:^|\/|\.)page\.json$/i.test(url.pathname)) return 'page';
};
