/**
 * 判断 Resolver 结果是否应继续使用浏览器原生外链行为。
 * @param value Resolver 返回的链接目标。
 * @returns 是否为带协议或协议相对的外链。
 */
export const isExternalLink = (value: string) => (
	/^[a-z][a-z\d+.-]*:/i.test(value) || value.startsWith('//')
);

/**
 * 仅接管普通主键点击；新标签、下载和组合键导航必须保留浏览器原生语义。
 * @param event Markdown 链接的点击事件。
 * @param anchor 当前点击所属的链接元素。
 * @returns 是否应由 Vue Router 接管本次点击。
 */
export const isPlainNavigationClick = (event: MouseEvent, anchor: HTMLAnchorElement) => (
	!event.defaultPrevented
	&& event.button === 0
	&& !event.metaKey
	&& !event.ctrlKey
	&& !event.shiftKey
	&& !event.altKey
	&& !anchor.hasAttribute('download')
	&& (!anchor.target || anchor.target.toLowerCase() === '_self')
);
