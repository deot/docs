export type SidebarIconKind = 'url' | 'type' | 'none';

const HTTP_IMAGE = /^https?:\/\//i;
const DATA_IMAGE = /^data:image\//i;
const BLOB_IMAGE = /^blob:/i;
const PATH_IMAGE = /^(?:\/|\.\/|\.\.\/)/;
const RAW_IMAGE_PREFIXES: Array<[RegExp, string]> = [
	[/^iVBORw0KGgo/, 'image/png'],
	[/^\/9j\//, 'image/jpeg'],
	[/^R0lGOD/, 'image/gif'],
	[/^UklGR/, 'image/webp']
];

const trimSource = (value: unknown) => String(value || '').trim();

const isRawImageBase64 = (value: unknown) => {
	const source = trimSource(value).replace(/\s+/g, '');
	return RAW_IMAGE_PREFIXES.some(([prefix]) => prefix.test(source));
};

/**
 * 把裸 base64 补成 data URL，其它值原样返回。
 * @param value 原始图标字符串。
 * @returns 可交给 `<img src>` 的地址。
 */
export const toSidebarIconSrc = (value: unknown) => {
	const source = trimSource(value);
	if (!source) return '';
	if (DATA_IMAGE.test(source) || HTTP_IMAGE.test(source) || BLOB_IMAGE.test(source) || PATH_IMAGE.test(source)) {
		return source;
	}
	const compact = source.replace(/\s+/g, '');
	const mime = RAW_IMAGE_PREFIXES.find(([prefix]) => prefix.test(compact))?.[1];
	return mime ? `data:${mime};base64,${compact}` : source;
};

/**
 * 识别侧栏图标来源：url/base64 走 img，其余当作 `@deot/vc` Icon type。
 * @param value 原始图标字符串。
 * @returns 图标种类。
 */
export const resolveSidebarIconKind = (value: unknown): SidebarIconKind => {
	const icon = trimSource(value);
	if (!icon) return 'none';
	if (
		HTTP_IMAGE.test(icon)
		|| DATA_IMAGE.test(icon)
		|| BLOB_IMAGE.test(icon)
		|| PATH_IMAGE.test(icon)
		|| isRawImageBase64(icon)
	) {
		return 'url';
	}
	return 'type';
};

/**
 * 从 `icon` 或 `[normal, selected]` 取出当前应展示的字符串。
 * @param icon 侧栏配置中的图标字段。
 * @param selected 当前路由是否激活。
 * @returns 当前应渲染的图标字符串。
 */
export const pickSidebarIconValue = (
	icon: string | [string, string] | undefined,
	selected: boolean
): string => {
	if (!icon) return '';
	if (Array.isArray(icon)) {
		const [normal, selectedIcon] = icon;
		return trimSource(selected ? (selectedIcon || normal) : normal);
	}
	return trimSource(icon);
};
