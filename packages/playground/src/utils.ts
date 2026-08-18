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
