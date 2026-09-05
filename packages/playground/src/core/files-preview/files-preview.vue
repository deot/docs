<template>
	<div class="docs-playground-files">
		<div class="docs-playground-files__tabs-row">
			<Scroller
				class="docs-playground-files__scroller"
				:auto-resize="true"
				:native="false"
				:show-bar="true"
				height="40"
				content-class="docs-playground-files__tabs"
				content-style="height: 40px; overflow: hidden;"
				wrapper-style="height: 40px; overflow-x: auto; overflow-y: hidden;"
			>
				<button
					v-for="filename in filenames"
					:key="filename"
					type="button"
					class="docs-playground-files__tab"
					:class="{ 'is-active': filename === activeFilename }"
					:data-filename="filename"
					@click="handleActive(filename)"
				>
					<span>{{ filename }}</span>
					<small v-if="filename === entry" class="docs-playground-files__entry">{{ t('playground.files.entry') }}</small>
				</button>
			</Scroller>
		</div>
		<CodePreview
			class="docs-playground-files__body"
			:code="activeCode"
			:filename="activeFilename"
			:copy-label="t('playground.common.copyCurrentFile')"
		/>
	</div>
</template>
<script lang="ts" setup>
import { computed } from 'vue';
import { Scroller } from '@deot/vc';
import { useLocale } from '@deot/docs-locale';
import type { PlaygroundFilesProps, PlaygroundViewsProps } from '../../types';
import CodePreview from '../code-preview';

const props = defineProps<PlaygroundFilesProps & PlaygroundViewsProps & {
	activeFilename: string;
}>();
const { t } = useLocale();
const emit = defineEmits<{
	'active-change': [filename: string];
}>();

const filenames = computed(() => Object.keys(props.files));
const activeCode = computed(() => props.files[props.activeFilename] || '');

const handleActive = (filename: string) => {
	if (filename !== props.activeFilename) emit('active-change', filename);
};
</script>
<style lang="scss">
@use '../../style' as *;

@include block(docs-playground-files) {
	display: flex;
	height: 100%;
	max-height: 100%;
	min-height: 0;
	overflow: hidden;
	background: var(--docs-code-background, var(--vc-background-color, #f6f8fa));
	border: 1px solid var(--docs-border-color, var(--vc-color-light-deeper, #e2e8f0));
	border-radius: 12px;
	box-sizing: border-box;
	flex: 1 1 auto;
	flex-direction: column;

	@include element(tabs-row) {
		display: flex;
		overflow: hidden;
		background: transparent;
		border-bottom: 1px solid var(--docs-border-color, var(--vc-color-light-deeper, #e2e8f0));
		box-sizing: border-box;
		flex: 0 0 40px;
	}

	@include element(scroller) {
		width: 0;
		height: 40px;
		min-width: 0;
		overflow: hidden;
		flex: 1 1 auto;

		.vc-scroller__wrapper {
			height: 40px;
			overflow-y: hidden !important;
			scrollbar-width: none;

			&::-webkit-scrollbar {
				display: none;
			}
		}

		.vc-scroller-track.is-y {
			display: none !important;
		}
	}

	@include element(tabs) {
		display: inline-flex;
		height: 40px;
		min-width: 100%;
		padding: 0 10px;
		box-sizing: border-box;
		gap: 4px;
	}

	@include element(tab) {
		position: relative;
		display: inline-flex;
		height: 40px;
		padding: 0 12px;
		font: inherit;
		font-size: 13px;
		font-weight: 500;
		line-height: 40px;
		color: var(--docs-foreground-color-mute, var(--vc-color-dark-extralight, #71717a));
		white-space: nowrap;
		cursor: pointer;
		background: transparent;
		border: 0;
		box-sizing: border-box;
		gap: 5px;
		align-items: center;

		@include when(active) {
			color: var(--docs-foreground-color, var(--vc-foreground-color, #18181b));

			&::after {
				position: absolute;
				right: 8px;
				bottom: 0;
				left: 8px;
				height: 3px;
				background: var(--docs-primary-color, var(--vc-color-primary, #5495f6));
				border-radius: 2px 2px 0 0;
				content: '';
			}
		}
	}

	@include element(entry) {
		font-size: 10px;
		line-height: 16px;
		color: var(--docs-foreground-color-mute, var(--vc-color-dark-extralight, #71717a));
	}

	@include element(body) {
		min-height: 0;
		border-radius: 0;
		flex: 1 1 auto;
	}
}
</style>
