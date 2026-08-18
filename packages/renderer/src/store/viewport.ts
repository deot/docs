import { reactive, readonly } from 'vue';

export interface RendererViewportState {
	scale: number;
	scrollLeft: number;
	scrollTop: number;
	showGrid: boolean;
	showRuler: boolean;
	showGuides: boolean;
	showThumbnail: boolean;
	/**
	 * 网格间距，画布像素。
	 */
	gridSize: number;
	/**
	 * 用户放置的垂直辅助线，画布 X 坐标。不是对齐吸附时的临时线。
	 */
	guideX: number[];
	/**
	 * 用户放置的水平辅助线，画布 Y 坐标。
	 */
	guideY: number[];
}

export const createViewportState = (): RendererViewportState => ({
	scale: 1,
	scrollLeft: 0,
	scrollTop: 0,
	showGrid: false,
	showRuler: true,
	showGuides: true,
	showThumbnail: true,
	gridSize: 10,
	guideX: [],
	guideY: []
});

/**
 * Combo 会话级视口状态。zoom、pan、辅助线显隐不写入文档。
 */
export class ViewportSession {
	readonly state: RendererViewportState;

	constructor(initial = createViewportState()) {
		this.state = reactive(initial);
	}

	get snapshot() {
		return readonly(this.state);
	}

	update(value: Partial<RendererViewportState>) {
		Object.assign(this.state, value);
	}

	resetSession() {
		this.state.scale = 1;
		this.state.scrollLeft = 0;
		this.state.scrollTop = 0;
		this.state.guideX = [];
		this.state.guideY = [];
	}
}
