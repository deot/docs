<template>
	<Modal
		v-model="active"
		:title="t('renderer.editor.paintAreas')"
		:width="960"
		:height="640"
		:mask-closable="false"
		wrapper-class="docs-renderer-area-paint-modal"
		@cancel="handleCancel"
	>
		<div class="docs-renderer-area-paint">
			<div
				ref="stage"
				class="docs-renderer-area-paint__stage"
				@pointerdown="handleStagePointerDown"
			>
				<img class="docs-renderer-area-paint__image" :src="src" alt="">
				<div
					v-for="(item, index) in draft"
					:key="index"
					class="docs-renderer-area-paint__zone"
					:class="{ 'is-selected': selected === index }"
					:style="styleOf(item)"
					@pointerdown.stop="event => handleZonePointerDown(event, index, 'move')"
				>
					<span class="docs-renderer-area-paint__label">{{ labelOf(item, index) }}</span>
					<template v-if="selected === index">
						<button
							v-for="handle in AREA_HANDLES"
							:key="handle"
							type="button"
							class="docs-renderer-selection__handle"
							:class="`docs-renderer-selection__handle--${handle}`"
							:aria-label="t('renderer.canvas.resize', { handle })"
							@pointerdown.stop="event => handleZonePointerDown(event, index, handle)"
						/>
					</template>
				</div>
			</div>
			<div class="docs-renderer-area-paint__side">
				<div class="docs-renderer-area-paint__toolbar">
					<Button class="docs-renderer-area-paint__add" :disabled="draft.length >= AREA_ZONE_MAX" @click="handleAdd">
						{{ t('renderer.editor.addArea') }}
					</Button>
					<span>{{ t('renderer.editor.areaMax', { count: AREA_ZONE_MAX }) }}</span>
				</div>
				<div class="docs-renderer-area-paint__list">
					<div
						v-for="(item, index) in draft"
						:key="index"
						class="docs-renderer-area-paint__item"
						:class="{ 'is-selected': selected === index }"
						@click="selected = index"
					>
						<strong>{{ labelOf(item, index) }}</strong>
						<button
							type="button"
							class="docs-renderer-area-paint__remove"
							:title="t('renderer.editor.removeItem')"
							:aria-label="t('renderer.editor.removeItem')"
							@click.stop="handleRemove(index)"
						>
							✕
						</button>
						<Input
							:model-value="item.to"
							:placeholder="t('renderer.editor.target')"
							@update:model-value="value => updateZone(index, { to: String(value || '') })"
						/>
						<Input
							:model-value="item.label"
							:placeholder="t('renderer.editor.label')"
							@update:model-value="value => updateZone(index, { label: String(value || '') })"
						/>
					</div>
				</div>
			</div>
		</div>
		<template #footer>
			<Button class="docs-renderer-area-paint__cancel" @click="handleCancel">{{ t('renderer.json.cancel') }}</Button>
			<Button class="docs-renderer-area-paint__apply" type="primary" @click="handleOk">{{ t('renderer.json.apply') }}</Button>
		</template>
	</Modal>
</template>
<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue';
import type { CSSProperties } from 'vue';
import { Button, Input, Modal } from '@deot/vc';
import { useLocale } from '@deot/docs-locale';
import {
	AREA_HANDLES,
	AREA_ZONE_MAX,
	applyAreaZoneDelta,
	containAreaZone,
	createAreaZone,
	normalizeAreaZones,
	type RendererAreaHandle,
	type RendererAreaZone
} from './zones';

const props = defineProps<{
	src: string;
	areas?: unknown;
}>();
const emit = defineEmits<{
	'portal-fulfilled': [value: RendererAreaZone[]];
	'portal-rejected': [];
}>();
const { t } = useLocale();
const active = ref(true);
const stage = ref<HTMLElement>();
const draft = ref<RendererAreaZone[]>(normalizeAreaZones(props.areas));
const selected = ref(draft.value.length ? 0 : -1);
let session: {
	index: number;
	handle: RendererAreaHandle;
	origin: RendererAreaZone;
	startX: number;
	startY: number;
	width: number;
	height: number;
} | undefined;

const styleOf = (item: RendererAreaZone) => ({
	left: `${item.x}%`,
	top: `${item.y}%`,
	width: `${item.width}%`,
	height: `${item.height}%`,
	zIndex: item.zIndex
}) as CSSProperties;
const labelOf = (item: RendererAreaZone, index: number) => (
	item.label.trim() || t('renderer.editor.areaItem', { index: index + 1 })
);
const updateZone = (index: number, patch: Partial<RendererAreaZone>) => {
	const current = draft.value[index];
	if (!current) return;
	draft.value[index] = containAreaZone({ ...current, ...patch });
};
const handleAdd = () => {
	if (draft.value.length >= AREA_ZONE_MAX) return;
	draft.value = [...draft.value, createAreaZone(draft.value.length)];
	selected.value = draft.value.length - 1;
};
const handleRemove = (index: number) => {
	draft.value = draft.value.filter((_, item) => item !== index);
	if (selected.value === index) selected.value = draft.value.length ? Math.min(index, draft.value.length - 1) : -1;
	else if (selected.value > index) selected.value -= 1;
};
const handleStagePointerDown = () => {
	selected.value = -1;
};
const handleZonePointerDown = (event: PointerEvent, index: number, handle: RendererAreaHandle) => {
	if (event.button !== 0) return;
	event.preventDefault();
	selected.value = index;
	const box = stage.value?.getBoundingClientRect();
	if (!box || !box.width || !box.height) return;
	session = {
		index,
		handle,
		origin: { ...draft.value[index] },
		startX: event.clientX,
		startY: event.clientY,
		width: box.width,
		height: box.height
	};
	window.addEventListener('pointermove', handlePointerMove);
	window.addEventListener('pointerup', handlePointerUp);
};
const handlePointerMove = (event: PointerEvent) => {
	if (!session) return;
	const dx = ((event.clientX - session.startX) / session.width) * 100;
	const dy = ((event.clientY - session.startY) / session.height) * 100;
	draft.value[session.index] = applyAreaZoneDelta(session.origin, session.handle, dx, dy);
};
const handlePointerUp = () => {
	session = undefined;
	window.removeEventListener('pointermove', handlePointerMove);
	window.removeEventListener('pointerup', handlePointerUp);
};
const handleOk = () => emit('portal-fulfilled', draft.value.map(item => containAreaZone(item)));
const handleCancel = () => emit('portal-rejected');
onBeforeUnmount(handlePointerUp);
</script>
<style lang="scss">
@use '../../../../node_modules/@deot/docs-theme/src/functions' as *;

.docs-renderer-area-paint {
	display: grid;
	grid-template-columns: minmax(0, 500px) minmax(240px, 1fr);
	gap: 16px;
	height: 100%;
	min-width: 0;
	min-height: 0;
	overflow: hidden;
	text-align: left;

	&__stage {
		position: relative;
		min-width: 0;
		overflow: auto;
		background: varfix(background-color-soft);
		user-select: none;
	}

	&__image {
		display: block;
		width: 100%;
		height: auto;
		-webkit-user-drag: none;
		pointer-events: none;
	}

	&__zone {
		position: absolute;
		overflow: visible;
		cursor: move;
		border: 1px dashed varfix(primary-color);
		box-sizing: border-box;

		&.is-selected {
			z-index: 20 !important;
			background: color-mix(in srgb, varfix(primary-color) 12%, transparent);
		}
	}

	&__label {
		display: inline-block;
		padding: 1px 4px;
		font-size: 12px;
		line-height: 1.2;
		color: #fff;
		white-space: nowrap;
		pointer-events: none;
		background: varfix(primary-color);
	}

	&__side {
		display: grid;
		grid-template-rows: auto minmax(0, 1fr);
		min-width: 0;
		min-height: 0;
	}

	&__toolbar {
		display: flex;
		padding-bottom: 8px;
		border-bottom: 1px solid varfix(border-color-light);
		align-items: flex-end;
		justify-content: space-between;
		gap: 8px;

		span {
			font-size: 12px;
			color: varfix(foreground-color-mute);
		}
	}

	&__list {
		display: grid;
		gap: 12px;

		// 给角上探出的关闭按钮留空，避免 overflow 裁切或引出横向滚动。
		padding: 12px 10px 4px 2px;
		overflow: hidden auto;
		align-content: start;
	}

	&__item {
		position: relative;
		display: grid;
		gap: 8px;
		min-width: 0;
		padding: 12px 10px 10px;
		cursor: pointer;
		border: 1px dashed varfix(border-color);
		box-sizing: border-box;

		&.is-selected {
			border-color: varfix(primary-color);
		}

		strong {
			overflow: hidden;
			font-size: 12px;
			text-overflow: ellipsis;
			white-space: nowrap;
		}

		.vc-input {
			max-width: 100%;
			min-width: 0;
		}
	}

	&__remove {
		position: absolute;
		top: -8px;
		right: -8px;
		z-index: 1;
		width: 18px;
		height: 18px;
		padding: 0;
		font-size: 12px;
		line-height: 16px;
		color: varfix(foreground-color-mute);
		cursor: pointer;
		background: varfix(background-color);
		border: 1px solid varfix(border-color);
		border-radius: 50%;
	}
}
</style>
