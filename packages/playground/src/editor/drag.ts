const isTouch = typeof document !== 'undefined' && 'ontouchstart' in document;
const events = isTouch
	? { start: 'touchstart', move: 'touchmove', end: 'touchend' }
	: { start: 'mousedown', move: 'mousemove', end: 'mouseup' };

const DEFAULT_OFFSET = 10;
const END_OFFSET = 0;

interface DragPoint {
	clientX: number;
	clientY: number;
}

/**
 * mousedown 与 touchstart 的公共读取面：拖拽只需要坐标和阻止默认行为。
 * 由于所有成员都可选，MouseEvent、TouchEvent 与 Event 均满足该结构，
 * 处理器因此可以直接注册为事件监听器。
 */
interface DragEventLike extends Partial<DragPoint> {
	preventDefault: () => void;
	touches?: ArrayLike<DragPoint>;
}

/** window 暴露 inner*，元素暴露 client*，两者提供其中一组即可。 */
type DragContainer
	= | { innerWidth: number; innerHeight: number }
		| { clientWidth: number; clientHeight: number };

interface DragOptions {
	/**
	 * 被拖动的面板元素。
	 */
	el: HTMLElement;
	/**
	 * 用来读取已有 `right` / `bottom` 偏移的定位父级。
	 */
	wrapper: HTMLElement;
	/**
	 * 限制拖拽范围的视口，window 或滚动容器。
	 */
	container: DragContainer;
}

const readPoint = (e: DragEventLike): DragPoint => {
	const touch = e.touches?.[0];
	if (touch) return touch;
	return { clientX: Number(e.clientX), clientY: Number(e.clientY) };
};

/**
 * 读取样式上已有的偏移量。
 * @param value 样式声明的 right / bottom 值。
 * @param fallback 样式缺省时使用的偏移量。
 * @returns 像素偏移量；auto 表示该方向由样式表接管，返回 null 以保留当前偏移。
 */
const readOffset = (value: string, fallback: number) => {
	if (value === 'auto') return null;
	const parsed = parseInt(value, 10);
	return Number.isNaN(parsed) ? fallback : parsed;
};

/**
 * 目前只针对right / bottom 做处理
 */
export class Drag {
	el: HTMLElement;

	wrapper: HTMLElement;

	container: DragContainer;

	right = 0;

	bottom = 0;

	maxRight: number;

	maxBottom: number;

	currentX = 0;

	currentY = 0;

	flag = false;

	constructor(options: Partial<DragOptions> = {}) {
		const { el, wrapper, container } = options;

		if (!el) {
			throw new Error('必传');
		}

		this.el = el;
		this.wrapper = wrapper || el;
		this.container = container || window;

		const width = 'innerWidth' in this.container
			? this.container.innerWidth
			: this.container.clientWidth;
		const height = 'innerHeight' in this.container
			? this.container.innerHeight
			: this.container.clientHeight;
		this.maxRight = width - this.wrapper.offsetWidth;
		this.maxBottom = height - this.wrapper.offsetHeight;

		this.readOffsets(DEFAULT_OFFSET);

		this.handleStart = this.handleStart.bind(this);
		this.handleMove = this.handleMove.bind(this);
		this.handleEnd = this.handleEnd.bind(this);
		el.addEventListener(events.start, this.handleStart, false);
	}

	off() {
		const { el } = this;
		el.removeEventListener(events.start, this.handleStart, false);
	}

	private readOffsets(fallback: number) {
		const right = readOffset(this.wrapper.style.right, fallback);
		const bottom = readOffset(this.wrapper.style.bottom, fallback);

		if (right !== null) this.right = right;
		if (bottom !== null) this.bottom = bottom;
	}

	private operateDOMEvents(type: 'add' | 'remove') {
		if (type === 'remove') {
			document.removeEventListener(events.move, this.handleMove, false);
			document.removeEventListener(events.end, this.handleEnd, false);
			return;
		}
		document.addEventListener(events.move, this.handleMove, false);
		document.addEventListener(events.end, this.handleEnd, false);
	}

	handleStart(e: DragEventLike) {
		this.flag = true;
		e.preventDefault();
		const point = readPoint(e);
		this.currentX = point.clientX;
		this.currentY = point.clientY;

		this.operateDOMEvents('add');
	}

	handleMove(e: DragEventLike) {
		e.preventDefault();
		const point = readPoint(e);
		if (!this.flag) return;

		const disX = point.clientX - this.currentX;
		const disY = point.clientY - this.currentY;
		let nowRight = this.right - disX;
		let nowBottom = this.bottom - disY;

		nowRight < 0 && (nowRight = 0);
		nowBottom < 0 && (nowBottom = 0);
		nowRight > this.maxRight && (nowRight = this.maxRight);
		nowBottom > this.maxBottom && (nowBottom = this.maxBottom);

		this.wrapper.style.right = nowRight + 'px';
		this.wrapper.style.bottom = nowBottom + 'px';
	}

	handleEnd() {
		this.flag = false;

		this.readOffsets(END_OFFSET);

		this.operateDOMEvents('remove');
	}
}
