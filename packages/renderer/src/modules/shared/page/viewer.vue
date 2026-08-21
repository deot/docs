<template>
	<div
		v-if="showHandles"
		class="docs-renderer-page"
		:data-renderer-page="'canvas'"
	>
		<button
			type="button"
			class="docs-renderer-page__handle docs-renderer-page__handle--e"
			:aria-label="t('renderer.editor.canvasWidth')"
			@pointerdown.stop="event => handlePointerDown(event, 'e')"
		/>
		<button
			type="button"
			class="docs-renderer-page__handle docs-renderer-page__handle--s"
			:aria-label="t('renderer.editor.canvasHeight')"
			@pointerdown.stop="event => handlePointerDown(event, 's')"
		/>
		<button
			type="button"
			class="docs-renderer-page__handle docs-renderer-page__handle--se"
			:aria-label="t('renderer.canvas.resize', { handle: 'se' })"
			@pointerdown.stop="event => handlePointerDown(event, 'se')"
		/>
	</div>
</template>
<script setup lang="ts">
import { computed, onBeforeUnmount } from 'vue';
import { useLocale } from '@deot/docs-locale';
import type { RendererModuleViewerProps } from '../../../types';
import { toLength } from '../../shared/utils';

const MIN_SIZE = 320;
const MAX_SIZE = 3840;

const props = defineProps<RendererModuleViewerProps>();
const emit = defineEmits<{
	resize: [payload: { width: number; height: number; done?: boolean }];
}>();
const { t } = useLocale(computed(() => props.context.locale));
const showHandles = computed(() => (
	props.context.scene === 'combo' && props.context.frameMode === 'draggable'
));

type PageHandle = 'e' | 's' | 'se';
let session: {
	handle: PageHandle;
	startX: number;
	startY: number;
	width: number;
	height: number;
} | undefined;

const clampSize = (value: number) => Math.min(MAX_SIZE, Math.max(MIN_SIZE, Math.round(value)));

const handlePointerDown = (event: PointerEvent, handle: PageHandle) => {
	if (event.button !== 0) return;
	session = {
		handle,
		startX: event.clientX,
		startY: event.clientY,
		width: toLength(props.node.module.props.width, toLength(props.node.placement?.width, 1200)),
		height: toLength(props.node.module.props.height, toLength(props.node.placement?.height, 800))
	};
	window.addEventListener('pointermove', handlePointerMove);
	window.addEventListener('pointerup', handlePointerUp);
	window.addEventListener('pointercancel', handlePointerUp);
	event.preventDefault();
};

const emitSize = (done = false) => {
	if (!session) return;
	emit('resize', { width: session.width, height: session.height, done });
};

const handlePointerMove = (event: PointerEvent) => {
	if (!session) return;
	const scale = Math.max(0.1, Number(props.context.extra?.scale) || 1);
	const dx = (event.clientX - session.startX) / scale;
	const dy = (event.clientY - session.startY) / scale;
	if (session.handle === 'e' || session.handle === 'se') {
		session.width = clampSize(session.width + dx);
	}
	if (session.handle === 's' || session.handle === 'se') {
		session.height = clampSize(session.height + dy);
	}
	session.startX = event.clientX;
	session.startY = event.clientY;
	emitSize();
};

const handlePointerUp = () => {
	if (!session) return;
	emitSize(true);
	session = undefined;
	window.removeEventListener('pointermove', handlePointerMove);
	window.removeEventListener('pointerup', handlePointerUp);
	window.removeEventListener('pointercancel', handlePointerUp);
};

onBeforeUnmount(() => {
	window.removeEventListener('pointermove', handlePointerMove);
	window.removeEventListener('pointerup', handlePointerUp);
	window.removeEventListener('pointercancel', handlePointerUp);
});
</script>
<style lang="scss">
.docs-renderer-page {
	position: absolute;
	inset: 0;
	z-index: 0;
	pointer-events: none;

	&__handle {
		position: absolute;
		padding: 0;
		pointer-events: auto;
		cursor: ew-resize;
		background: transparent;
		border: 0;

		&--e {
			top: 0;
			right: 0;
			bottom: 0;
			width: 4px;
		}

		&--s {
			right: 0;
			bottom: 0;
			left: 0;
			height: 4px;
			cursor: ns-resize;
		}

		&--se {
			right: 0;
			bottom: 0;
			width: 16px;
			height: 16px;
			cursor: nwse-resize;
		}
	}
}
</style>
