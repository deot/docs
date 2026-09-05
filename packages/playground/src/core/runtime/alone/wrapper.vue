<template>
	<div
		class="docs-playground-popup"
		role="dialog"
		aria-modal="true"
		:aria-label="t('playground.runtime.openPopup')"
	>
		<div
			class="docs-playground-popup__mask"
			data-action="popup-mask"
			@click="handleClose"
		></div>
		<div
			class="docs-playground-popup__shell"
			:style="shellStyle"
		>
			<div class="docs-playground-popup__frame">
				<div class="docs-playground-popup__header">
					<span
						v-if="title.trim()"
						class="docs-playground__title"
						:title="title.trim()"
					>
						<span class="docs-playground__title-text">{{ title.trim() }}</span>
					</span>
					<RuntimeToolbar
						:copy-value="copyValue"
						:viewport="currentViewport"
						:viewport-options="viewportOptions"
						:show-close="true"
						@refresh="handleRefresh"
						@edit="emit('edit')"
						@close-popup="handleClose"
						@viewport-change="handleViewportChange"
					/>
				</div>
				<pre
					v-if="errorText"
					class="docs-playground__runtime-error"
					role="alert"
				>{{ errorText }}</pre>
				<div class="docs-playground-popup__body">
					<Scroller
						class="docs-playground-popup__scroller"
						content-class="docs-playground-popup__scroller-content"
						:auto-resize="true"
						:native="false"
						:show-bar="true"
						height="100%"
					>
						<div
							class="docs-playground-popup__canvas"
							:style="canvasStyle"
						>
							<Sandbox
								:key="sandboxKey"
								ref="sandboxRef"
								:store="store"
								:auto-store-init="false"
								:clear-console="clearConsole"
								:preview-options="previewOptions"
							/>
						</div>
					</Scroller>
				</div>
			</div>
		</div>
	</div>
</template>
<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { Scroller } from '@deot/vc';
import { useLocale } from '@deot/docs-locale';
import { Sandbox } from '@vue/repl';
import type { Store } from '@vue/repl';
import type { PlaygroundPreviewOptions, PlaygroundViewport } from '../../../types';
import { resolveSandboxContainer, type SandboxExposed } from '../auto-height';
import {
	formatSandboxRuntimeError,
	toErrorText,
	useSandboxRuntimeErrorGuard
} from '../error-guard';
import { resolvePopupLayout } from './layout';
import { useSandboxTheme } from '../theme';
import RuntimeToolbar from '../toolbar.vue';
import { PLAYGROUND_RUNTIME_CANVAS_BACKGROUND } from '../../store';

const props = withDefaults(defineProps<{
	store: Store;
	copyValue: string;
	title?: string;
	viewport?: PlaygroundViewport;
	viewportOptions?: PlaygroundViewport[];
	previewOptions?: PlaygroundPreviewOptions;
	clearConsole?: boolean;
}>(), {
	title: '',
	viewport: 'auto',
	viewportOptions: () => ['auto', 375],
	clearConsole: true
});

const emit = defineEmits<{
	'edit': [];
	'navigate': [to: string];
	'viewport-change': [viewport: PlaygroundViewport];
	'portal-fulfilled': [];
}>();

const { t } = useLocale();
const currentViewport = ref<PlaygroundViewport>(props.viewport);
const sandboxRef = ref<SandboxExposed | null>(null);
const sandboxKey = ref(0);
const layoutTick = ref(0);
const runtimeError = useSandboxRuntimeErrorGuard(sandboxRef);
useSandboxTheme(sandboxRef);

const storeErrors = computed(() => (props.store.errors || [])
	.map(toErrorText)
	.filter(Boolean)
	.join('\n'));
const errorText = computed(() => {
	const runtime = runtimeError.value
		? formatSandboxRuntimeError(runtimeError.value, t('playground.runtime.importMapTip'))
		: '';
	return [storeErrors.value, runtime].filter(Boolean).join('\n\n');
});
const layout = computed(() => {
	void layoutTick.value;
	return resolvePopupLayout(currentViewport.value);
});
const shellStyle = computed(() => ({
	width: `${layout.value.shellWidth}px`,
	height: `${layout.value.shellHeight}px`
}));
const canvasStyle = computed(() => ({
	width: `${layout.value.canvasWidth}px`,
	height: `${layout.value.canvasHeight}px`,
	background: PLAYGROUND_RUNTIME_CANVAS_BACKGROUND
}));

const handleRefresh = () => {
	runtimeError.value = '';
	sandboxKey.value++;
};
const handleViewportChange = (viewport: PlaygroundViewport) => {
	currentViewport.value = viewport;
	emit('viewport-change', viewport);
};
const handleClose = () => emit('portal-fulfilled');
const isPlaygroundEditorOpen = () => {
	if (typeof document === 'undefined') return false;
	const editor = document.querySelector('.docs-playground-editor__wrapper');
	if (!(editor instanceof HTMLElement)) return false;
	const style = getComputedStyle(editor);
	return style.display !== 'none' && style.visibility !== 'hidden';
};
const handleKeydown = (event: KeyboardEvent) => {
	if (event.key !== 'Escape') return;
	if (isPlaygroundEditorOpen()) return;
	event.preventDefault();
	handleClose();
};
const handleResize = () => {
	layoutTick.value++;
};
const handleBridgeMessage = (event: MessageEvent) => {
	const iframe = resolveSandboxContainer(sandboxRef.value)?.querySelector('iframe');
	if (!iframe || event.source !== iframe.contentWindow) return;
	const data = event.data;
	if (
		!data
		|| data.action !== 'docs:navigate'
		|| typeof data.to !== 'string'
	) return;
	emit('navigate', data.to);
};

watch(() => props.viewport, (viewport) => {
	currentViewport.value = viewport;
});

if (typeof window !== 'undefined') {
	window.addEventListener('keydown', handleKeydown);
	window.addEventListener('resize', handleResize);
	window.addEventListener('message', handleBridgeMessage);
}
onBeforeUnmount(() => {
	window.removeEventListener('keydown', handleKeydown);
	window.removeEventListener('resize', handleResize);
	window.removeEventListener('message', handleBridgeMessage);
});
</script>
<style lang="scss">
@use '../../../style' as *;

@include block(docs-playground-popup) {
	position: fixed;
	inset: 0;
	z-index: 1000;
	display: flex;
	padding: 20px 40px;
	box-sizing: border-box;
	justify-content: center;
	align-items: center;

	@include element(mask) {
		position: absolute;
		inset: 0;
		background: rgb(15 23 42 / 45%);
	}

	@include element(shell) {
		position: relative;
		z-index: 1;
		display: flex;
		max-width: 100%;
		max-height: 100%;
		overflow: hidden;
		background: var(--docs-background-color, var(--vc-background-color-light, #fff));
		border-radius: 12px;
		box-sizing: border-box;
	}

	// 预留外边框适配位；本期不加视觉边框。
	@include element(frame) {
		display: flex;
		width: 100%;
		height: 100%;
		min-width: 0;
		min-height: 0;
		overflow: hidden;
		flex-direction: column;
	}

	@include element(header) {
		display: flex;
		padding: 0 4px 0 0;
		background: transparent;
		box-sizing: border-box;
		justify-content: space-between;
		align-items: center;
		gap: 12px;
		flex: 0 0 44px;
	}

	@include element(body) {
		min-width: 0;
		min-height: 0;
		overflow: hidden;
		flex: 1 1 auto;
	}

	@include element(scroller) {
		width: 100%;
		height: 100%;

		.vc-scroller__wrapper {
			height: 100%;
		}
	}

	@include element(scroller-content) {
		min-height: 100%;
		box-sizing: border-box;
	}

	@include element(canvas) {
		position: relative;
		overflow: hidden;
		box-sizing: border-box;

		.sandbox,
		.iframe-container,
		.iframe-container iframe {
			display: block;
			width: 100%;
			height: 100%;
			min-height: 100%;
			background: var(--vc-background-color-light, var(--docs-background-color, #fff)) !important;
		}

		.iframe-container iframe {
			border: 0;
		}
	}
}
</style>
