/**
 * 空串与经典默认白表示跟随站点主题；其它显式色值按文档原样绘制。
 * @param background 文档 `layout.background`。
 * @returns 可直接赋给 CSS `background` 的值。
 */
export const rendererPageBackgroundCss = (background?: string) => {
	const value = String(background || '').trim().toLowerCase();
	if (!value || value === '#fff' || value === '#ffffff' || value === 'fff' || value === 'ffffff') {
		return 'var(--docs-background-color)';
	}
	return String(background).trim();
};
