import type { DocsConfig, DocsRuntime } from '../types';

const PRODUCTION_RUNTIME: Readonly<DocsRuntime> = Object.freeze({ mode: 'production' });

/*
 * 将仅供服务端注入的全局变量规范化为公开的 `$docs.runtime` 协议。
 * 编程式启动必须显式传入 config，确保所有组件通过 getDocsConfig 读取
 * 同一个对象，而不是读取过期的全局配置。
 */
export const initializeDocsRuntime = (
	target: Window = window,
	config: DocsConfig = target.$docs || { locales: {}, routes: {} }
) => {
	const runtime = Object.freeze(target.__DOCS_RUNTIME__ || PRODUCTION_RUNTIME);
	config.runtime = runtime;
	target.$docs = config;
	return runtime;
};

export const getDocsConfig = (): DocsConfig => window.$docs;

export const getDocsRuntime = (): Readonly<DocsRuntime> => (
	getDocsConfig().runtime || PRODUCTION_RUNTIME
);
