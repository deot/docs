import { cloneRendererValue, validateRendererDocument } from '@deot/docs-renderer';
import type { RendererDocument } from '@deot/docs-renderer';

const STORAGE_KEY = 'docs-renderer-inline-document';

interface InlineRendererPayload {
	from: string;
	document: RendererDocument;
}

const readPayload = (): InlineRendererPayload | undefined => {
	try {
		const raw = sessionStorage.getItem(STORAGE_KEY);
		if (!raw) return undefined;
		const value: unknown = JSON.parse(raw);
		if (!value || typeof value !== 'object') return undefined;
		const record = value as { from?: unknown; document?: unknown };
		if (typeof record.from !== 'string') return undefined;
		const result = validateRendererDocument(record.document);
		if (!result.document) return undefined;
		return { from: record.from, document: result.document };
	} catch {
		return undefined;
	}
};

/**
 * 把当前路由上的内联 Renderer 文档暂存到 sessionStorage，
 * 供 `/__docs/renderer-editor?type=inline` 读取。
 * @param from 来源路由，读取时必须一致。
 * @param value 待校验的 Renderer 文档。
 */
export const stashInlineRendererDocument = (from: string, value: unknown) => {
	const result = validateRendererDocument(value);
	if (!result.document) return;
	try {
		sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
			from,
			document: cloneRendererValue(result.document)
		} satisfies InlineRendererPayload));
	} catch {
		// 配额不足时仍可编辑空画布，不阻断跳转。
	}
};

export const takeInlineRendererDocument = (from: string) => {
	const payload = readPayload();
	if (!payload || payload.from !== from) return undefined;
	return cloneRendererValue(payload.document);
};
