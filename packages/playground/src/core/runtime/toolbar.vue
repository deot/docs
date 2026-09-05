<template>
	<div class="docs-playground__tools">
		<template v-if="showRuntimeActions">
			<div
				v-if="viewportOptions.length > 1"
				class="docs-playground__tool-group"
			>
				<Dropdown
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
			</div>
			<span
				v-if="viewportOptions.length > 1"
				class="docs-playground__tool-divider"
				aria-hidden="true"
			/>
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
			<span
				v-if="showViews"
				class="docs-playground__tool-divider"
				aria-hidden="true"
			/>
		</template>
		<div
			v-if="showViews"
			class="docs-playground__views"
			role="tablist"
			:aria-label="t('playground.runtime.views')"
		>
			<button
				v-for="item in orderedViews"
				:key="item"
				type="button"
				class="docs-playground__view"
				role="tab"
				:class="{ 'is-active': item === activeView }"
				:title="getViewAriaLabel(item)"
				:aria-label="getViewAriaLabel(item)"
				:aria-selected="item === activeView"
				:aria-pressed="item === activeView"
				@click="emit('view-change', item)"
			>
				{{ getViewLabel(item) }}
			</button>
		</div>
		<span
			v-if="showClose && (showRuntimeActions || showViews)"
			class="docs-playground__tool-divider"
			aria-hidden="true"
		/>
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
import type { PlaygroundView, PlaygroundViewport } from '../../types';
import { playgroundViewMessage } from '../../utils';
import {
	formatViewportLabel,
	getViewportKey,
	viewportEquals
} from './viewport';

const props = withDefaults(defineProps<{
	copyValue?: string;
	viewport?: PlaygroundViewport;
	viewportOptions?: PlaygroundViewport[];
	views?: PlaygroundView[];
	activeView?: PlaygroundView;
	showRuntimeActions?: boolean;
	showOpenPopup?: boolean;
	showClose?: boolean;
}>(), {
	copyValue: '',
	viewport: 'auto',
	viewportOptions: () => ['auto', 375],
	views: () => [],
	activeView: 'runtime',
	showRuntimeActions: true,
	showOpenPopup: false,
	showClose: false
});

const emit = defineEmits<{
	'refresh': [];
	'edit': [];
	'open-popup': [];
	'close-popup': [];
	'viewport-change': [viewport: PlaygroundViewport];
	'view-change': [view: PlaygroundView];
}>();

const { t } = useLocale();
const VIEW_ORDER: PlaygroundView[] = ['runtime', 'files'];
const viewportMenuVisible = ref(false);
const orderedViews = computed(() => VIEW_ORDER.filter(view => props.views.includes(view)));
const showViews = computed(() => orderedViews.value.length > 1);
const viewportLabel = computed(() => formatViewportLabel(
	props.viewport,
	t('playground.runtime.auto')
));

const getViewAriaLabel = (view: PlaygroundView) => t(playgroundViewMessage(view));
const getViewLabel = (view: PlaygroundView) => (
	view === 'runtime'
		? t('playground.runtime.previewLabel')
		: t('playground.runtime.codeLabel')
);

const handleViewport = (index: number) => {
	const viewport = props.viewportOptions[index];
	if (viewport && !viewportEquals(viewport, props.viewport)) {
		emit('viewport-change', viewport);
	}
};

watch(() => props.viewportOptions.length, (length) => {
	if (length <= 1) viewportMenuVisible.value = false;
});

watch(() => props.showRuntimeActions, (enabled) => {
	if (!enabled) viewportMenuVisible.value = false;
});
</script>
