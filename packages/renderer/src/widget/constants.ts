export const RENDERER_WIDGET_MIME = 'application/x-deot-docs-renderer-widget';

/** create 事件与拖拽数据的公共载荷：指向要创建的模块与预设。 */
export interface RendererCreateTarget {
	/**
	 * 模块 `identity.type`。
	 */
	type: string;
	/**
	 * 组件库预设 key。未选预设时缺省。
	 */
	presetKey?: string;
}

export interface RendererWidgetDragSession extends RendererCreateTarget {
	/**
	 * 拖拽幽灵与落点使用的初始宽，来自 `initialPlacement`。
	 */
	width: number;
	/**
	 * 拖拽幽灵与落点使用的初始高。
	 */
	height: number;
}

let widgetDragSession: RendererWidgetDragSession | null = null;

export const beginWidgetDrag = (session: RendererWidgetDragSession) => {
	widgetDragSession = session;
};

export const endWidgetDrag = () => {
	widgetDragSession = null;
};

export const getWidgetDragSession = () => widgetDragSession;
