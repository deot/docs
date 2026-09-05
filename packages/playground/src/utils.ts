import type { PlaygroundFiles, PlaygroundView } from './types';

/**
 * 比较两组 playground 文件是否完全一致。
 * @param left 左侧文件表。
 * @param right 右侧文件表。
 * @returns 键集合与各文件内容是否都相同。
 */
export const filesEqual = (left: PlaygroundFiles, right: PlaygroundFiles) => {
	const leftKeys = Object.keys(left);
	const rightKeys = Object.keys(right);
	return leftKeys.length === rightKeys.length
		&& leftKeys.every(key => left[key] === right[key]);
};

/**
 * 视图切换条使用的文案键。
 * @param view 当前预览视图。
 * @returns locale 消息键。
 */
export const playgroundViewMessage = (view: PlaygroundView) => (
	view === 'runtime' ? 'playground.runtime.preview' : 'playground.runtime.files'
);

/**
 * 与 markdown-it-anchor 默认 `slugify` 对齐，用于标题锚点 id。
 * @param title 标题文本。
 * @returns 可用作元素 id / hash 的字符串；空标题返回空串。
 */
export const slugifyPlaygroundTitle = (title: string) => {
	const normalized = String(title).trim().toLowerCase().replace(/\s+/g, '-');
	return normalized ? encodeURIComponent(normalized) : '';
};

/**
 * 解析标题锚点 id：显式 id 优先，否则从标题 slugify；必要时避开已占用 id。
 * @param title 标题文本。
 * @param explicitId 可选显式 id。
 * @param isOccupied 返回该 id 是否已被其他元素占用。
 * @returns 锚点 id；无标题时为空串。
 */
export const resolvePlaygroundTitleId = (
	title: string,
	explicitId = '',
	isOccupied?: (id: string) => boolean
) => {
	if (!String(title).trim()) return '';
	const base = String(explicitId).trim() || slugifyPlaygroundTitle(title);
	if (!base) return '';
	if (!isOccupied || !isOccupied(base)) return base;
	let index = 1;
	while (isOccupied(`${base}-${index}`)) index += 1;
	return `${base}-${index}`;
};
