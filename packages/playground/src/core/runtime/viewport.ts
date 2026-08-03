import type { PlaygroundViewport } from '../../types';

export const DEFAULT_VIEWPORT_OPTIONS: PlaygroundViewport[] = ['auto', 375];

export const isValidViewport = (viewport: unknown): viewport is PlaygroundViewport => {
	if (viewport === 'auto') return true;
	if (typeof viewport === 'number') return Number.isFinite(viewport) && viewport > 0;
	return Array.isArray(viewport)
		&& viewport.length === 2
		&& viewport.every(value => typeof value === 'number' && Number.isFinite(value) && value > 0);
};

export const getViewportKey = (viewport: PlaygroundViewport) => Array.isArray(viewport)
	? `${viewport[0]}x${viewport[1]}`
	: String(viewport);

export const viewportEquals = (left: PlaygroundViewport, right: PlaygroundViewport) =>
	getViewportKey(left) === getViewportKey(right);

export const cloneViewport = (viewport: PlaygroundViewport): PlaygroundViewport =>
	Array.isArray(viewport) ? [viewport[0], viewport[1]] : viewport;

export const normalizeViewportOptions = (options?: PlaygroundViewport[]) => {
	const source = options === undefined ? DEFAULT_VIEWPORT_OPTIONS : options;
	const normalized: PlaygroundViewport[] = [];
	for (const viewport of source) {
		if (!isValidViewport(viewport)) continue;
		if (normalized.some(item => viewportEquals(item, viewport))) continue;
		normalized.push(cloneViewport(viewport));
	}
	return normalized;
};

export const resolveInitialViewport = (
	viewport: unknown,
	options: PlaygroundViewport[]
): PlaygroundViewport => isValidViewport(viewport)
	? cloneViewport(viewport)
	: cloneViewport(options[0] || 'auto');

export const includeActiveViewport = (
	options: PlaygroundViewport[],
	viewport: PlaygroundViewport
) => {
	if (!options.length || options.some(item => viewportEquals(item, viewport))) return options;
	return [...options, cloneViewport(viewport)];
};

export const getViewportWidth = (viewport: PlaygroundViewport) => {
	if (viewport === 'auto') return null;
	return Array.isArray(viewport) ? viewport[0] : viewport;
};

export const getViewportHeight = (viewport: PlaygroundViewport) =>
	Array.isArray(viewport) ? viewport[1] : null;

export const formatViewportLabel = (viewport: PlaygroundViewport) => {
	if (viewport === 'auto') return '自适应';
	return Array.isArray(viewport)
		? `${viewport[0]} × ${viewport[1]}px`
		: `${viewport}px`;
};
