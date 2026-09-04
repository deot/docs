<template>
	<div class="docs-playground__tools">
		<button
			type="button"
			class="docs-playground__tool docs-playground__refresh"
			data-action="refresh"
			:title="t('playground.runtime.refresh')"
			:aria-label="t('playground.runtime.refresh')"
			@click="emit('refresh')"
		>
			<PlaygroundIcon name="refresh" />
		</button>
		<Dropdown
			v-if="viewportOptions.length > 1"
			v-model="viewportMenuVisible"
			class="docs-playground__viewport-menu"
			:portal="true"
			trigger="click"
			placement="bottom-right"
		>
			<button
				type="button"
				class="docs-playground__tool docs-playground__viewport-trigger"
				:class="{ 'is-active': viewport !== 'auto' }"
				:title="t('playground.runtime.viewport', { value: viewportLabel })"
				:aria-label="t('playground.runtime.viewport', { value: viewportLabel })"
				:aria-expanded="viewportMenuVisible"
				aria-haspopup="menu"
			>
				<PlaygroundIcon name="viewport" />
			</button>
			<template #content>
				<DropdownMenu
					class="docs-playground__viewport-options"
					role="menu"
					:aria-label="t('playground.runtime.viewportMenu')"
				>
					<DropdownItem
						v-for="(item, index) in viewportOptions"
						:key="getViewportKey(item)"
						class="docs-playground__viewport-option"
						:value="index"
						:selected="viewportEquals(item, viewport)"
						role="menuitemradio"
						:aria-checked="viewportEquals(item, viewport)"
						@click="handleViewport(index)"
					>
						{{ formatViewportLabel(item, t('playground.runtime.auto')) }}
					</DropdownItem>
				</DropdownMenu>
			</template>
		</Dropdown>
		<Clipboard
			class="docs-playground__tool"
			:value="copyValue"
			tag="button"
			type="button"
			:title="t('playground.common.copy')"
			:aria-label="t('playground.common.copy')"
		>
			<PlaygroundIcon name="copy" />
		</Clipboard>
		<button
			type="button"
			class="docs-playground__tool docs-playground__editor"
			data-action="edit"
			:title="t('playground.runtime.editFiles')"
			:aria-label="t('playground.runtime.editFiles')"
			@click="emit('edit')"
		>
			<PlaygroundIcon name="editor" />
		</button>
		<button
			v-if="showOpenPopup"
			type="button"
			class="docs-playground__tool docs-playground__popup"
			data-action="open-popup"
			:title="t('playground.runtime.openPopup')"
			:aria-label="t('playground.runtime.openPopup')"
			@click="emit('open-popup')"
		>
			<PlaygroundIcon name="popup" />
		</button>
		<button
			v-if="showClose"
			type="button"
			class="docs-playground__tool docs-playground__popup-close"
			data-action="close-popup"
			:title="t('playground.runtime.closePopup')"
			:aria-label="t('playground.runtime.closePopup')"
			@click="emit('close-popup')"
		>
			<span class="docs-playground__popup-close-mark" aria-hidden="true">&#10005;</span>
		</button>
	</div>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Clipboard, Dropdown, DropdownItem, DropdownMenu } from '@deot/vc';
import { useLocale } from '@deot/docs-locale';
import PlaygroundIcon from '../../icon';
import type { PlaygroundViewport } from '../../types';
import {
	formatViewportLabel,
	getViewportKey,
	viewportEquals
} from './viewport';

const props = withDefaults(defineProps<{
	copyValue: string;
	viewport?: PlaygroundViewport;
	viewportOptions?: PlaygroundViewport[];
	showOpenPopup?: boolean;
	showClose?: boolean;
}>(), {
	viewport: 'auto',
	viewportOptions: () => ['auto', 375],
	showOpenPopup: false,
	showClose: false
});

const emit = defineEmits<{
	'refresh': [];
	'edit': [];
	'open-popup': [];
	'close-popup': [];
	'viewport-change': [viewport: PlaygroundViewport];
}>();

const { t } = useLocale();
const viewportMenuVisible = ref(false);
const viewportLabel = computed(() => formatViewportLabel(
	props.viewport,
	t('playground.runtime.auto')
));

const handleViewport = (index: number) => {
	const viewport = props.viewportOptions[index];
	if (viewport && !viewportEquals(viewport, props.viewport)) {
		emit('viewport-change', viewport);
	}
};

watch(() => props.viewportOptions.length, (length) => {
	if (length <= 1) viewportMenuVisible.value = false;
});
</script>
