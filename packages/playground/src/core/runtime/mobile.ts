import type { PlaygroundMobile, PlaygroundPreviewInset, PlaygroundViewport } from '../../types';
import { getViewportWidth } from './viewport';

/** `mobile: true` 时分栏的最大高度。 */
export const PLAYGROUND_MOBILE_MAX_HEIGHT = 640;

/** 窄于该宽度时改为上预览、下代码。按 playground 自身宽度，不是窗口宽度。 */
export const PLAYGROUND_MOBILE_BREAKPOINT = 720;

/** 未指定视口宽度时，预览列的宽度。 */
export const PLAYGROUND_MOBILE_PREVIEW_WIDTH = 375;

/** 窄容器里预览区的最大高度。 */
export const PLAYGROUND_MOBILE_NARROW_PREVIEW_MAX_HEIGHT = 480;

/** 窄容器里代码区的最大高度。 */
export const PLAYGROUND_MOBILE_NARROW_CODE_MAX_HEIGHT = 320;

/**
 * 预览外框圆角。与 runtime.vue 中 `.docs-playground__preview` 的 `border-radius` 保持一致。
 */
export const PLAYGROUND_PREVIEW_RADIUS = 12;

/** mobile 未写 `previewInset` 时的留白：上下避开圆角，左右铺满。 */
export const PLAYGROUND_MOBILE_PREVIEW_INSET: [vertical: number, horizontal: number] = [PLAYGROUND_PREVIEW_RADIUS, 0];

/**
 * 解析传给运行时的 `previewInset`。显式值原样使用。
 * @param value 用户配置。
 * @param mobile 是否处于移动端分栏。
 * @returns 运行时使用的留白。
 */
export const resolvePlaygroundPreviewInset = (
	value: PlaygroundPreviewInset | undefined,
	mobile: boolean
): PlaygroundPreviewInset => {
	if (value !== undefined) return value;
	return mobile ? [...PLAYGROUND_MOBILE_PREVIEW_INSET] : 0;
};

/**
 * local 移动端预览没有自己的视口，`100vw` 是整页宽度。
 * `auto` 改为按预览列宽度计算，375 宽列得到 0.5px，并保持 480 宽封顶。
 */
export const LOCAL_MOBILE_VC_REM = 'min(calc(100cqw / 750), 0.64px)';

export const isPlaygroundMobile = (value: unknown): value is PlaygroundMobile => (
	value === true || (typeof value === 'number' && Number.isFinite(value) && value > 0)
);

export const resolvePlaygroundMobileMaxHeight = (value: PlaygroundMobile) => (
	value === true ? PLAYGROUND_MOBILE_MAX_HEIGHT : value
);

export const resolvePlaygroundMobilePreviewWidth = (viewport: PlaygroundViewport) => (
	getViewportWidth(viewport) || PLAYGROUND_MOBILE_PREVIEW_WIDTH
);

/**
 * 宽度尚未布局（0）时保持宽屏，避免首帧或测试环境被收成窄布局。
 * @param width playground 自身的内容宽度。
 * @returns 是否改为上下排列。
 */
export const isNarrowPlayground = (width: number) => (
	width > 0 && width < PLAYGROUND_MOBILE_BREAKPOINT
);
