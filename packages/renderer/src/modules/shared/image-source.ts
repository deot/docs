const HTTP_IMAGE = /^https?:\/\//i;
const DATA_IMAGE = /^data:image\//i;
const BLOB_IMAGE = /^blob:/i;
const RAW_IMAGE_PREFIXES: Array<[RegExp, string]> = [
	[/^iVBORw0KGgo/, 'image/png'],
	[/^\/9j\//, 'image/jpeg'],
	[/^R0lGOD/, 'image/gif'],
	[/^UklGR/, 'image/webp']
];

const trimSource = (value: unknown) => String(value || '').trim();

/**
 * 识别未带 data URL 前缀的常见图片 base64。
 * @param value 控件或文档里的原始字符串。
 * @returns 是否为 PNG/JPEG/GIF/WebP 裸 base64。
 */
export const isRawImageBase64 = (value: unknown) => {
	const source = trimSource(value).replace(/\s+/g, '');
	return RAW_IMAGE_PREFIXES.some(([prefix]) => prefix.test(source));
};

/**
 * 可直接作为 `<img src>` 的地址：https、data URL、blob 或裸图片 base64。
 * @param value 控件或文档里的原始字符串。
 * @returns 是否可跳过 workspace 相对路径解析直接渲染。
 */
export const isDirectImageSource = (value: unknown) => {
	const source = trimSource(value);
	return HTTP_IMAGE.test(source)
		|| DATA_IMAGE.test(source)
		|| BLOB_IMAGE.test(source)
		|| isRawImageBase64(source);
};

/**
 * 内联图片不应再走 workspace 资源寻址。
 * @param value 控件或文档里的原始字符串。
 * @returns data URL、blob 或裸 base64 为 true。
 */
export const shouldSkipAssetResolve = (value: unknown) => {
	const source = trimSource(value);
	return DATA_IMAGE.test(source) || BLOB_IMAGE.test(source) || isRawImageBase64(source);
};

/**
 * 只有语言目录内的相对资源才进入预加载计划。
 * @param value 控件或文档里的原始字符串。
 * @returns 相对路径为 true，https / data URL 为 false。
 */
export const isWorkspaceImageSource = (value: unknown) => {
	const source = trimSource(value);
	if (!source || isDirectImageSource(source)) return false;
	return !/^[a-z][a-z\d+.-]*:/i.test(source) && !source.startsWith('//');
};

/**
 * 把裸 base64 补成可渲染的 data URL，其它值原样返回。
 * @param value 控件或文档里的原始字符串。
 * @returns 可交给 `<img src>` 的字符串。
 */
export const toDisplayImageSrc = (value: unknown) => {
	const source = trimSource(value);
	if (!source) return '';
	if (DATA_IMAGE.test(source) || HTTP_IMAGE.test(source) || BLOB_IMAGE.test(source)) return source;
	const compact = source.replace(/\s+/g, '');
	const mime = RAW_IMAGE_PREFIXES.find(([prefix]) => prefix.test(compact))?.[1];
	return mime ? `data:${mime};base64,${compact}` : source;
};

export const collectImageResources = (sources: unknown[]) => sources
	.filter((source): source is string => typeof source === 'string' && isWorkspaceImageSource(source))
	.map(source => ({ type: 'module' as const, source }));

export const resolveImageSource = async (
	value: unknown,
	resolveAsset?: (source: string, importer?: string) => string | Promise<string>,
	importer?: string
) => {
	const input = trimSource(value);
	if (!input) return '';
	if (shouldSkipAssetResolve(input) || !resolveAsset) return toDisplayImageSrc(input);
	return await resolveAsset(input, importer);
};
