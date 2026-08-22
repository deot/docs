import { createInstance } from '@deot/http';

/**
 * 原始 HTTP 传输层；资源缓存与生命周期状态由 Gateway 负责。
 */
export const Network = createInstance({
	credentials: 'omit',
	responseType: 'text',
	timeout: 60000
});
