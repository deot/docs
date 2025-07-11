const isTouch = typeof document !== 'undefined' && 'ontouchstart' in document;
let events = {
	start: 'mousedown',
	move: 'mousemove',
	end: 'mouseup'
};
isTouch && (events = {
	start: 'touchstart',
	move: 'touchmove',
	end: 'touchend'
});

/**
 * 目前只针对right / bottom 做处理
 */
export class Drag {
	el: any;
	wrapper: any;
	container: any;
	onEnd: any;
	bottom: any;
	right: any;
	maxRight: any;
	maxBottom: any;
	currentX: any;
	currentY: any;
	flag: any;
	constructor(options = {}) {
		const { el, wrapper, container, onEnd } = options as any;

		if (!el) {
			throw new Error('必传');
		}

		this.el = el;
		this.wrapper = wrapper || el;
		this.container = container || window;
		this.onEnd = onEnd;

		// 内部变量
		this.bottom = 0;
		this.right = 0;

		this.maxRight = ((container.innerWidth || container.clientWidth) - wrapper.offsetWidth);
		this.maxBottom = ((container.innerHeight || container.clientHeight) - wrapper.offsetHeight);

		this.currentX = 0;
		this.currentY = 0;
		this.flag = false;

		const right = this.wrapper.style.right || 10;
		const bottom = this.wrapper.style.bottom || 10;

		right !== 'auto' && (this.right = right);
		bottom !== 'auto' && (this.bottom = bottom);

		this.handleStart = this.handleStart.bind(this);
		this.handleMove = this.handleMove.bind(this);
		this.handleEnd = this.handleEnd.bind(this);
		el.addEventListener(events.start, this.handleStart, false);
	}

	off() {
		const { el } = this;
		el.removeEventListener(events.start, this.handleStart, false);
	}

	operateDOMEvents(type) {
		const key = type === 'remove'
			? 'removeEventListener'
			: 'addEventListener';
		document[key](events.move, this.handleMove, false);
		document[key](events.end, this.handleEnd, false);
	}

	handleStart(e: any) {
		this.flag = true;
		e.preventDefault();
		e = isTouch ? e.touches[0] : e;
		this.currentX = e.clientX;
		this.currentY = e.clientY;

		this.operateDOMEvents('add');
	}

	handleMove(e: any) {
		e.preventDefault();
		e = isTouch ? e.touches[0] : e;
		if (!this.flag) return;

		const disX = e.clientX - this.currentX;
		const disY = e.clientY - this.currentY;
		let nowRight = parseInt(this.right, 10) - disX;
		let nowBottom = parseInt(this.bottom, 10) - disY;

		nowRight < 0 && (nowRight = 0);
		nowBottom < 0 && (nowBottom = 0);
		nowRight > this.maxRight && (nowRight = this.maxRight);
		nowBottom > this.maxBottom && (nowBottom = this.maxBottom);

		this.wrapper.style.right = nowRight + 'px';
		this.wrapper.style.bottom = nowBottom + 'px';
	}

	handleEnd() {
		this.flag = false;

		const right = this.wrapper.style.right || 0;
		const bottom = this.wrapper.style.bottom || 0;

		right !== 'auto' && (this.right = right);
		bottom !== 'auto' && (this.bottom = bottom);

		this.operateDOMEvents('remove');
	}
};
