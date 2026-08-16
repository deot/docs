<template>
	<div class="docs-renderer-ruler" :class="{ 'is-hide': hidden }">
		<template v-if="!hidden">
			<div
				class="docs-renderer-ruler__origin"
				:title="originTitle"
				@click="emit('toggle-guides')"
			/>
			<div
				class="docs-renderer-ruler__x docs-renderer-ruler--top"
				:style="{ transform: `translateX(${-scrollLeft}px)` }"
				@pointerdown.stop="event => emit('axis-pointerdown', event, 'x')"
				@mousemove="event => emit('axis-move', event, 'x')"
				@mouseleave="emit('axis-leave')"
			>
				<canvas ref="canvasX" class="docs-renderer-ruler__canvas" />
				<div
					v-if="preview?.axis === 'x'"
					class="docs-renderer-guide docs-renderer-guide--vertical is-preview"
					:style="guideStyle(preview.value)"
				>
					<span>{{ preview.value }}</span>
				</div>
				<template v-if="showGuides">
					<div
						v-for="(value, index) in guideX"
						:key="`user-x-${index}`"
						class="docs-renderer-guide docs-renderer-guide--vertical is-user"
						:style="guideStyle(value)"
						:title="deleteTitle"
						@pointerdown.stop="event => emit('guide-pointerdown', event, 'x', index)"
						@dblclick.stop="emit('guide-dblclick', 'x', index)"
					>
						<span>{{ Math.round(value) }}</span>
					</div>
				</template>
			</div>
		</template>
		<div class="docs-renderer-ruler__wrapper">
			<div
				v-if="!hidden"
				class="docs-renderer-ruler__y docs-renderer-ruler--left"
				@pointerdown.stop="event => emit('axis-pointerdown', event, 'y')"
				@mousemove="event => emit('axis-move', event, 'y')"
				@mouseleave="emit('axis-leave')"
			>
				<div
					class="docs-renderer-ruler__y-rotate"
					:style="{ transform: `rotate(90deg) translateX(${-scrollTop}px)` }"
				>
					<canvas ref="canvasY" class="docs-renderer-ruler__canvas" />
					<div
						v-if="preview?.axis === 'y'"
						class="docs-renderer-guide docs-renderer-guide--horizontal is-preview"
						:style="guideStyle(preview.value)"
					>
						<span>{{ preview.value }}</span>
					</div>
					<template v-if="showGuides">
						<div
							v-for="(value, index) in guideY"
							:key="`user-y-${index}`"
							class="docs-renderer-guide docs-renderer-guide--horizontal is-user"
							:style="guideStyle(value)"
							:title="deleteTitle"
							@pointerdown.stop="event => emit('guide-pointerdown', event, 'y', index)"
							@dblclick.stop="emit('guide-dblclick', 'y', index)"
						>
							<span>{{ Math.round(value) }}</span>
						</div>
					</template>
				</div>
			</div>
			<div class="docs-renderer-ruler__slot">
				<slot />
			</div>
		</div>
	</div>
</template>
<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import type { CSSProperties } from 'vue';
import {
	RULER_SIZE,
	computeRulerCanvasLength,
	computeRulerInterval,
	paintRulerX
} from './ruler-paint';

const props = withDefaults(defineProps<{
	hidden?: boolean;
	scrollLeft: number;
	scrollTop: number;
	frameW: number;
	frameH: number;
	clientW: number;
	clientH: number;
	scale: number;
	placeholder?: number;
	dark?: boolean;
	originTitle?: string;
	deleteTitle?: string;
	showGuides?: boolean;
	guideX?: readonly number[];
	guideY?: readonly number[];
	preview?: { axis: 'x' | 'y'; value: number };
}>(), {
	hidden: false,
	placeholder: RULER_SIZE,
	dark: false,
	originTitle: '',
	deleteTitle: '',
	showGuides: true,
	guideX: () => [],
	guideY: () => []
});
const emit = defineEmits<{
	'toggle-guides': [];
	'axis-pointerdown': [event: PointerEvent, axis: 'x' | 'y'];
	'axis-move': [event: MouseEvent, axis: 'x' | 'y'];
	'axis-leave': [];
	'guide-pointerdown': [event: PointerEvent, axis: 'x' | 'y', index: number];
	'guide-dblclick': [axis: 'x' | 'y', index: number];
}>();

const canvasX = ref<HTMLCanvasElement>();
const canvasY = ref<HTMLCanvasElement>();
const interval = computed(() => computeRulerInterval(props.scale));
const canvasW = computed(() => computeRulerCanvasLength({
	frameSize: Math.max(props.frameW, props.frameH),
	scale: props.scale,
	clientSize: Math.max(props.clientW, props.clientH),
	scroll: Math.max(props.scrollLeft, props.scrollTop),
	placeholder: props.placeholder
}));
/**
 * 辅助线定位：X 轴用 left；Y 轴在 `rotate(90deg)` 后同一 left 对应屏幕纵向。
 * @param value 画板坐标。
 * @returns 沿标尺 canvas 的 left 样式。
 */
const guideStyle = (value: number): CSSProperties => ({
	left: `${value * props.scale + props.placeholder}px`
});

const refreshCanvas = () => {
	if (props.hidden) return;
	const options = {
		length: canvasW.value,
		size: RULER_SIZE,
		placeholder: props.placeholder,
		interval: interval.value,
		scale: props.scale,
		dark: props.dark
	};
	// 两轴共用横向刻度；Y 轴靠 CSS 旋转成纵向，与 vm-ruler 一致。
	paintRulerX(canvasX.value || null, options);
	paintRulerX(canvasY.value || null, options);
};

watch(
	() => [canvasW.value, interval.value, props.scale, props.placeholder, props.hidden, props.dark] as const,
	() => nextTick(refreshCanvas)
);
onMounted(() => nextTick(refreshCanvas));
</script>
