/**
 * 记录 local 预览最近一次被用户操作的时间，用来判断页面上新出现的节点属于哪个预览。
 * 多个预览共用一个页面，只能按「刚刚操作过谁」来归属。
 */

/** 操作之后多长时间内，新出现的节点仍算作该预览产生的。 */
export const PREVIEW_ACTIVITY_WINDOW = 1000;

const activity = new Map<string, number>();

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/**
 * @param scope 预览的样式作用域 id。
 */
export const markPreviewActive = (scope: string) => {
	activity.set(scope, now());
};

/**
 * @param scope 预览的样式作用域 id。
 */
export const forgetPreviewActivity = (scope: string) => {
	activity.delete(scope);
};

/**
 * @param windowMs 有效时间窗口。
 * @returns 窗口内最近活跃的预览；没有时返回 undefined。
 */
export const getActivePreview = (windowMs = PREVIEW_ACTIVITY_WINDOW) => {
	const current = now();
	let scope: string | undefined;
	let latest = -Infinity;
	for (const [key, time] of activity) {
		if (current - time <= windowMs && time >= latest) {
			scope = key;
			latest = time;
		}
	}
	return scope;
};

const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'focusin'] as const;

/**
 * 监听预览根上的操作。
 * @param scope 预览的样式作用域 id。
 * @param root 预览根。
 * @returns 取消监听。
 */
export const trackPreviewActivity = (scope: string, root: HTMLElement) => {
	const handler = () => markPreviewActive(scope);
	for (const type of ACTIVITY_EVENTS) root.addEventListener(type, handler, true);
	return () => {
		for (const type of ACTIVITY_EVENTS) root.removeEventListener(type, handler, true);
		forgetPreviewActivity(scope);
	};
};
