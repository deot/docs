import { MIN_RUNTIME_HEIGHT } from './auto-height';
import type { PlaygroundExpandable } from '../../types';

/** 展开后预留底部空隙，避免贴死视口边缘。 */
export const PLAYGROUND_EXPAND_VIEWPORT_GAP = 16;

const CLIPPING_OVERFLOW = new Set(['auto', 'scroll', 'hidden', 'overlay']);
const SCROLLABLE_OVERFLOW = new Set(['auto', 'scroll', 'overlay']);

export const getWindowInnerHeight = () => (typeof window === 'undefined' ? 0 : window.innerHeight);

const getPlaygroundHost = (el: Element | null) => (
	el?.closest('.docs-playground') ?? el
);

// `true` 或正数才开启展开控件；`false` / `undefined` / 非法值关闭。
export const isPlaygroundExpandable = (value: unknown): value is PlaygroundExpandable => {
	if (value === true) return true;
	return typeof value === 'number' && Number.isFinite(value) && value > 0;
};

export const resolveRemainingPreviewHeight = ({
	viewportHeight,
	chromeHeight,
	gap = PLAYGROUND_EXPAND_VIEWPORT_GAP
}: {
	viewportHeight: number;
	chromeHeight: number;
	gap?: number;
}) => Math.max(
	0,
	Math.round(
		(Number.isFinite(viewportHeight) ? viewportHeight : 0)
		- (Number.isFinite(chromeHeight) ? Math.max(0, chromeHeight) : 0)
		- (Number.isFinite(gap) ? gap : PLAYGROUND_EXPAND_VIEWPORT_GAP)
	)
);

// `true`：封顶到可见滚动区域（扣工具栏 / 空隙），不超出视口。正数按给定像素。
export const resolveExpandedPreviewHeight = (
	expandable: PlaygroundExpandable,
	availableHeight: number
) => {
	if (expandable === true) {
		return Math.max(
			MIN_RUNTIME_HEIGHT,
			Math.round(Number.isFinite(availableHeight) ? availableHeight : 0)
		);
	}
	return Math.max(MIN_RUNTIME_HEIGHT, Math.round(expandable));
};

// 文档站正文在内部 scroller 里，不能用 window.innerHeight。
export const getVisibleViewportRect = (el: Element | null) => {
	const viewportHeight = getWindowInnerHeight();
	let top = 0;
	let bottom = viewportHeight;
	if (typeof window === 'undefined' || !el) {
		return { top, bottom, height: Math.max(0, Math.round(bottom - top)) };
	}
	const host = getPlaygroundHost(el);
	let node = host?.parentElement ?? null;
	while (node && node !== document.documentElement) {
		const overflowY = getComputedStyle(node).overflowY;
		if (CLIPPING_OVERFLOW.has(overflowY)) {
			const rect = node.getBoundingClientRect();
			if (Number.isFinite(rect.top)) top = Math.max(top, rect.top);
			if (Number.isFinite(rect.bottom)) bottom = Math.min(bottom, rect.bottom);
		}
		node = node.parentElement;
	}
	return {
		top,
		bottom,
		height: Math.max(0, Math.round(bottom - top))
	};
};

export const findScrollableAncestor = (el: Element | null) => {
	if (!el || typeof window === 'undefined') return null;
	const host = getPlaygroundHost(el);
	let node = host?.parentElement ?? null;
	while (node && node !== document.documentElement) {
		const overflowY = getComputedStyle(node).overflowY;
		if (SCROLLABLE_OVERFLOW.has(overflowY) && node.scrollHeight > node.clientHeight + 1) {
			return node;
		}
		node = node.parentElement;
	}
	return null;
};

export const scrollPlaygroundToViewportStart = (el: HTMLElement | null) => {
	if (!el) return;
	const host = (getPlaygroundHost(el) as HTMLElement | null) ?? el;
	const scroller = findScrollableAncestor(host);
	if (scroller) {
		const delta = host.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
		scroller.scrollTop = Math.max(0, scroller.scrollTop + delta);
		return;
	}
	if (typeof host.scrollIntoView === 'function') {
		host.scrollIntoView({ block: 'start', behavior: 'auto' });
	}
};
