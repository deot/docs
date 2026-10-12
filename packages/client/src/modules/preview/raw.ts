import { encode, decode } from '@deot/helper-unicode';
import type { LocationQuery } from 'vue-router';

/**
 * raw 只负责 JSON 编解码；具体页面独立校验自己的配置。
 * @param value Router 已解码的单个 raw 参数。
 * @returns 解码后的 JSON 值。
 */
export const readRaw = (value: LocationQuery[string]): unknown => {
	if (typeof value !== 'string' || !value) throw new TypeError('raw must be a single encoded JSON value');
	return JSON.parse(decode(value));
};

export const createRawUrl = (value: unknown, target: string, base: string): string => {
	const url = new URL(target.trim(), base);
	if (!target.trim() || !/^https?:$/.test(url.protocol)) throw new TypeError('target must be an HTTP(S) or relative URL');
	url.searchParams.set('raw', encode(JSON.stringify(value)));
	return url.href;
};
