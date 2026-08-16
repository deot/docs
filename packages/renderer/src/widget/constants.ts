export const RENDERER_WIDGET_MIME = 'application/x-deot-docs-renderer-widget';

export interface RendererWidgetDragSession {
	type: string;
	presetKey?: string;
	width: number;
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
