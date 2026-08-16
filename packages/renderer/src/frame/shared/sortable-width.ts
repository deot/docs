import type { CSSProperties } from 'vue';
import type {
	RendererSortableAppearance,
	RendererSortableCapability
} from '../../types';

type SortableWidthSource = Pick<RendererSortableCapability, 'fullWidth' | 'maxWidth'>;
type SortableWidthAppearance = Pick<RendererSortableAppearance, 'fullWidth' | 'maxWidth'>;

/**
 * 实例 `appearance.fullWidth` 优先，否则用模块默认。
 * @param capability 模块的 sortable 能力。
 * @param appearance 节点 appearance。
 * @returns 是否按实际容器铺满。
 */
export const rendererSortableFillsCanvas = (
	capability?: SortableWidthSource,
	appearance?: SortableWidthAppearance
) => {
	if (typeof appearance?.fullWidth === 'boolean') return appearance.fullWidth;
	return Boolean(capability?.fullWidth);
};

/**
 * 实例已写入的内容最大宽度。`0` 与未填写等价，都不算已设定。
 * @param appearance 节点 appearance。
 * @returns 像素宽度；未设定或为 `0` 时为 `undefined`。
 */
export const rendererSortableAssignedWidth = (appearance?: SortableWidthAppearance) => {
	if (typeof appearance?.maxWidth === 'number' && appearance.maxWidth > 0) return appearance.maxWidth;
	return undefined;
};

/**
 * 模块内容最大宽度。实例未设定或为 `0` 时不限制，铺满与否都跟着容器铺开。
 * 模块 `capability.maxWidth` 只用于新建节点，不参与渲染回退。
 * @param _capability 模块的 sortable 能力。
 * @param appearance 节点 appearance。
 * @returns 像素宽度；未设定时为 `undefined`。
 */
export const rendererSortableContentWidth = (
	_capability?: SortableWidthSource,
	appearance?: SortableWidthAppearance
) => rendererSortableAssignedWidth(appearance);

/**
 * 内容栏 CSS 变量。未限制时为 `100%`，让正文跟着容器铺开。
 * @param capability 模块的 sortable 能力。
 * @param appearance 节点 appearance。
 * @returns CSS 长度。
 */
export const rendererSortableContentCssWidth = (
	capability?: SortableWidthSource,
	appearance?: SortableWidthAppearance
) => {
	const width = rendererSortableContentWidth(capability, appearance);
	return typeof width === 'number' ? `${width}px` : '100%';
};

/**
 * 非通栏模块的盒子最大宽度。通栏或未设定宽度时不限制。
 * @param capability 模块的 sortable 能力。
 * @param appearance 节点 appearance。
 * @returns 像素宽度；通栏或未设定时为 `undefined`。
 */
export const rendererSortableMaxWidth = (
	capability?: SortableWidthSource,
	appearance?: SortableWidthAppearance
) => {
	if (rendererSortableFillsCanvas(capability, appearance)) return undefined;
	return rendererSortableContentWidth(capability, appearance);
};

/**
 * Combo 列表项的宽度、垂直外边距和内容栏 CSS 变量。
 * @param capability 模块的 sortable 能力。
 * @param appearance 节点 appearance。
 * @returns 列表项 style。
 */
export const rendererSortableItemStyle = (
	capability?: SortableWidthSource,
	appearance?: RendererSortableAppearance
): CSSProperties => {
	const fill = rendererSortableFillsCanvas(capability, appearance);
	const contentWidth = rendererSortableContentWidth(capability, appearance);
	const style: CSSProperties = {
		'marginTop': `${appearance?.marginTop || 0}px`,
		'marginBottom': `${appearance?.marginBottom || 0}px`,
		'marginLeft': fill ? '0px' : 'auto',
		'marginRight': fill ? '0px' : 'auto',
		'--docs-renderer-content-width': rendererSortableContentCssWidth(capability, appearance)
	};
	if (fill || typeof contentWidth !== 'number') {
		style.width = '100%';
		style.maxWidth = 'none';
		return style;
	}
	style.maxWidth = `${contentWidth}px`;
	return style;
};

/**
 * 落地模块正文：有最大宽度时居中收栏，未设定则跟着容器铺开。
 * @param accent 模块强调色，可空。
 * @returns 模块根节点 style。
 */
export const rendererSortableSectionStyle = (accent?: string): CSSProperties => ({
	width: '100%',
	maxWidth: 'var(--docs-renderer-content-width, 100%)',
	marginInline: 'auto',
	...(accent ? { '--docs-renderer-accent': accent } : {})
}) as CSSProperties;
