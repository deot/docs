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
