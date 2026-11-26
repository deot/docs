/**
 * 空 reject（例如弹层取消）不要渲染成红条。
 * @param error 运行时抛出的值。
 * @returns 可展示的错误文本；空取消返回空字符串。
 */
export const formatPlaygroundRuntimeError = (error: unknown): string => {
	if (error == null) return '';
	const raw = typeof error === 'object' && 'message' in error
		? (error as { message?: unknown }).message
		: error;
	if (raw == null || raw === '') return '';
	const text = String(raw);
	if (text === 'undefined' || text === 'null') return '';
	return text;
};

/**
 * 把 console.error 的单个参数转成文本：字符串原样，错误取 message，其余对象序列化。
 * @param value console.error 的参数。
 * @returns 可展示的文本。
 */
export const formatPlaygroundErrorArgument = (value: unknown): string => {
	if (typeof value === 'string') return value;
	const text = formatPlaygroundRuntimeError(value);
	if (text && text !== '[object Object]') return text;
	try {
		return JSON.stringify(value) ?? String(value);
	} catch {
		return String(value);
	}
};
