export const collectCss = (chunks: Array<string | undefined | null>): string[] => {
	const result: string[] = [];
	chunks.forEach((chunk) => {
		const css = String(chunk || '').trim();
		if (css) result.push(css);
	});
	return result;
};

export const injectStyle = (id: string, cssList: string[]): HTMLStyleElement | null => {
	/* istanbul ignore if -- 仅浏览器注入样式 */
	if (typeof document === 'undefined') return null;
	const existing = document.querySelector(`style[data-playground-id="${id}"]`);
	existing?.remove();

	const css = cssList.filter(Boolean).join('\n');
	if (!css) return null;

	const style = document.createElement('style');
	style.setAttribute('data-playground-id', id);
	style.textContent = css;
	document.head.appendChild(style);
	return style;
};

export const removeStyle = (id: string) => {
	/* istanbul ignore if -- 仅浏览器注入样式 */
	if (typeof document === 'undefined') return;
	document.querySelector(`style[data-playground-id="${id}"]`)?.remove();
};
