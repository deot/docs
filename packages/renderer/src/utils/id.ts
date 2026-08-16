let sequence = 0;

/**
 * 生成 Renderer 文档与节点 ID。优先使用浏览器原生 UUID；旧版 WebView
 * 不支持 randomUUID 时仍保证同一会话内生成的 ID 不重复。
 * @returns 可直接写入 Renderer 文档的稳定字符串 ID。
 */
export const createRendererId = () => {
	const randomUUID = globalThis.crypto?.randomUUID;
	const nativeId = typeof randomUUID === 'function'
		? randomUUID.call(globalThis.crypto)
		: '';
	if (nativeId) return nativeId;
	sequence = (sequence + 1) % Number.MAX_SAFE_INTEGER;
	const random = new Uint32Array(2);
	if (globalThis.crypto?.getRandomValues) {
		globalThis.crypto.getRandomValues(random);
	} else {
		random[0] = Math.floor(Math.random() * 0xffffffff);
		random[1] = Math.floor(Math.random() * 0xffffffff);
	}
	return `renderer-${Date.now().toString(36)}-${sequence.toString(36)}-${[...random]
		.map(value => value.toString(36))
		.join('')}`;
};
