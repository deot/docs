<template>
	<div
		v-show="active"
		ref="root"
		class="docs-renderer-right-menu"
		:data-vc-theme="theme"
		role="menu"
		:style="{ left: `${event.clientX}px`, top: `${top}px` }"
	>
		<div class="docs-renderer-right-menu__content">
			<button
				v-for="(item, index) in items"
				:key="item"
				type="button"
				role="menuitem"
				class="docs-renderer-right-menu__item"
				:class="{
					'is-divided': isDivided(item, index),
					'is-danger': item === RENDERER_RIGHT_MENU.DELETE
				}"
				@click="handleClick(item)"
				@mousedown.stop
			>
				{{ labelOf(item) }}
			</button>
		</div>
	</div>
</template>
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useLocale } from '@deot/docs-locale';
import type { Language } from '@deot/docs-locale';
import {
	RENDERER_RIGHT_MENU,
	RENDERER_RIGHT_MENU_ORDER,
	type RendererRightMenuAction
} from './constants';

const MENU_GROUP: Record<RendererRightMenuAction, number> = {
	TOP: 0,
	BOTTOM: 0,
	UP: 0,
	DOWN: 0,
	DELETE: 1,
	SELECTION: 2,
	LOCK: 2,
	COPY: 3,
	PASTE: 3
};

const props = withDefaults(defineProps<{
	event: MouseEvent;
	items: RendererRightMenuAction[];
	locked?: boolean;
	locale?: Language;
	theme?: 'light' | 'dark';
}>(), {
	items: () => [...RENDERER_RIGHT_MENU_ORDER],
	locked: false,
	theme: undefined
});
const emit = defineEmits<{
	'portal-fulfilled': [value: RendererRightMenuAction];
	'portal-rejected': [];
}>();
const { t } = useLocale(computed(() => props.locale));
const root = ref<HTMLElement>();
const active = ref(false);
const wrapHeight = ref(175);
const top = computed(() => (
	window.innerHeight - props.event.clientY < wrapHeight.value
		? props.event.clientY - wrapHeight.value
		: props.event.clientY
));
const labelOf = (item: RendererRightMenuAction) => {
	if (item === RENDERER_RIGHT_MENU.LOCK) {
		return props.locked ? t('renderer.canvas.unlock') : t('renderer.canvas.lock');
	}
	const keys: Record<RendererRightMenuAction, string> = {
		TOP: 'renderer.canvas.bringToFront',
		BOTTOM: 'renderer.canvas.sendToBack',
		UP: 'renderer.canvas.forward',
		DOWN: 'renderer.canvas.backward',
		DELETE: 'renderer.inspector.delete',
		SELECTION: 'renderer.canvas.ungroup',
		LOCK: 'renderer.canvas.lock',
		COPY: 'renderer.canvas.copy',
		PASTE: 'renderer.canvas.paste'
	};
	return t(keys[item] as 'renderer.canvas.copy');
};
const isDivided = (item: RendererRightMenuAction, index: number) => {
	if (index === 0) return false;
	return MENU_GROUP[item] !== MENU_GROUP[props.items[index - 1]];
};
const handleClick = (item: RendererRightMenuAction) => {
	active.value = false;
	emit('portal-fulfilled', item);
};
const handleDeselect = (event: Event) => {
	const path = event.composedPath?.() || [];
	if (path.some(value => value === root.value || value === props.event.target)) return;
	active.value = false;
	emit('portal-rejected');
};
let dismissTimer = 0;
onMounted(() => {
	active.value = true;
	dismissTimer = window.setTimeout(() => {
		wrapHeight.value = root.value?.offsetHeight || 175;
		document.documentElement.addEventListener('click', handleDeselect);
		document.documentElement.addEventListener('contextmenu', handleDeselect);
	}, 0);
});
onBeforeUnmount(() => {
	window.clearTimeout(dismissTimer);
	document.documentElement.removeEventListener('click', handleDeselect);
	document.documentElement.removeEventListener('contextmenu', handleDeselect);
});
</script>
