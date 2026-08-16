/** 与 wya-vm.next `vm-ruler` 一致的标尺厚度 / 画板四周留白（屏幕像素，不随缩放放大）。 */
export const RULER_SIZE = 20;

/**
 * 计算十刻度间隔（缩放后像素）。
 * 目标：缩放后十刻度占屏幕 60–100px，算法对齐 `wya-vm.next` ruler.vue。
 * @param scale 当前画布缩放。
 * @returns 十刻度对应的屏幕像素宽度。
 */
export const computeRulerInterval = (scale: number) => {
	let width = 100;
	if (scale <= 0) return width;
	while (width * scale < 60) {
		width += 50;
	}
	while (width * scale > 100) {
		width = width - 20 >= 0 ? width - 20 : width - 10;
	}
	return width * scale;
};

export const computeRulerCanvasLength = (options: {
	frameSize: number;
	scale: number;
	clientSize: number;
	scroll: number;
	placeholder: number;
}) => Math.ceil(Math.max(
	5000,
	options.frameSize * options.scale + options.placeholder + 40,
	options.clientSize + options.scroll + 40
));

interface RulerPaintOptions {
	length: number;
	size: number;
	placeholder: number;
	interval: number;
	scale: number;
	dark?: boolean;
}

const fillBackground = (
	ctx: CanvasRenderingContext2D,
	width: number,
	height: number,
	dark?: boolean
) => {
	ctx.beginPath();
	ctx.fillStyle = dark ? '#474747' : '#FAFAFA';
	ctx.fillRect(0, 0, width, height);
};

/**
 * 绘制横向标尺，刻度与数字对齐 `vm-ruler` 的 X 轴 canvas。
 * @param canvas 标尺画布，测试环境可能为空。
 * @param options 刻度长度、间隔和缩放。
 */
export const paintRulerX = (
	canvas: HTMLCanvasElement | null,
	options: RulerPaintOptions
) => {
	if (!canvas) return;
	const ctx = canvas.getContext('2d');
	if (!ctx) return;
	const { length, size, placeholder, interval, scale, dark } = options;
	canvas.height = size;
	canvas.width = length;
	fillBackground(ctx, length, size, dark);
	ctx.translate(placeholder, 0);
	ctx.fillStyle = dark ? '#615E5B' : '#000';
	ctx.save();
	const major = Math.max(1, Math.ceil(length / interval));
	for (let i = 0; i < major; i += 1) {
		ctx.fillStyle = dark ? '#615E5B' : '#000';
		ctx.translate(i * interval, 0);
		ctx.fillRect(0, 0, 1, size);
		ctx.restore();
		ctx.save();
		ctx.fillStyle = '#8C8D89';
		ctx.font = '12px sans-serif';
		ctx.fillText(((i * interval) / scale).toFixed(0), i * interval + 4, (size / 5) * 3);
	}
	ctx.restore();
	ctx.translate(0, size - 3);
	ctx.save();
	const minor = major * 10;
	for (let i = 0; i < minor; i += 1) {
		if (i % 10 === 0) continue;
		ctx.translate((i * interval) / 10, 0);
		ctx.fillRect(0, 0, 1, 3);
		ctx.restore();
		ctx.save();
	}
};

/**
 * 绘制纵向标尺（测试/备用）。视觉实现与 `vm-ruler` 一致时走 `paintRulerX` + CSS `rotate(90deg)`。
 * @param canvas 标尺画布，测试环境可能为空。
 * @param options 刻度长度、间隔和缩放。
 */
export const paintRulerY = (
	canvas: HTMLCanvasElement | null,
	options: RulerPaintOptions
) => {
	if (!canvas) return;
	const ctx = canvas.getContext('2d');
	if (!ctx) return;
	const { length, size, placeholder, interval, scale, dark } = options;
	canvas.width = size;
	canvas.height = length;
	fillBackground(ctx, size, length, dark);
	ctx.translate(0, placeholder);
	ctx.fillStyle = dark ? '#615E5B' : '#000';
	ctx.save();
	const major = Math.max(1, Math.ceil(length / interval));
	for (let i = 0; i < major; i += 1) {
		ctx.fillStyle = dark ? '#615E5B' : '#000';
		ctx.translate(0, i * interval);
		ctx.fillRect(0, 0, size, 1);
		ctx.restore();
		ctx.save();
		ctx.fillStyle = '#8C8D89';
		ctx.font = '12px sans-serif';
		ctx.fillText(((i * interval) / scale).toFixed(0), 2, i * interval + 12);
	}
	ctx.restore();
	ctx.translate(size - 3, 0);
	ctx.save();
	const minor = major * 10;
	for (let i = 0; i < minor; i += 1) {
		if (i % 10 === 0) continue;
		ctx.translate(0, (i * interval) / 10);
		ctx.fillRect(0, 0, 3, 1);
		ctx.restore();
		ctx.save();
	}
};
