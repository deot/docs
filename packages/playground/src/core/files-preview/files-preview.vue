<template>
	<div class="docs-playground-files">
		<div class="docs-playground-files__toolbar">
			<Scroller
				class="docs-playground-files__scroller"
				:auto-resize="true"
				:native="false"
				:show-bar="true"
				height="44"
				content-class="docs-playground-files__tabs"
				content-style="height: 44px; overflow: hidden;"
				wrapper-style="height: 44px; overflow-x: auto; overflow-y: hidden;"
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
					<small v-if="filename === entry" class="docs-playground-files__entry">入口</small>
				</button>
			</Scroller>
			<div class="docs-playground-files__actions">
				<div v-if="views.length > 1" class="docs-playground__views docs-playground__views--files">
					<button
						v-for="item in views"
						:key="item"
						type="button"
						class="docs-playground__view"
						:class="{ 'is-active': item === activeView }"
						:title="PLAYGROUND_VIEW_TEXT[item]"
						:aria-label="PLAYGROUND_VIEW_TEXT[item]"
						:aria-pressed="item === activeView"
						@click="handleView(item)"
					>
						<PlaygroundIcon :name="item" />
					</button>
				</div>
			</div>
		</div>
		<CodePreview
			class="docs-playground-files__body"
			:code="activeCode"
			:filename="activeFilename"
			copy-label="复制当前文件"
		/>
	</div>
</template>
<script lang="ts" setup>
import { computed } from 'vue';
import { Scroller } from '@deot/vc';
import { PLAYGROUND_VIEW_TEXT } from '../../constants';
import PlaygroundIcon from '../../icon';
import type { PlaygroundFiles, PlaygroundView } from '../../types';
import CodePreview from '../code-preview';

const props = defineProps<{
	files: PlaygroundFiles;
	entry: string;
	activeFilename: string;
	activeView: PlaygroundView;
	views: PlaygroundView[];
}>();
const emit = defineEmits<{
	'active-change': [filename: string];
	'view-change': [view: PlaygroundView];
}>();

const filenames = computed(() => Object.keys(props.files));
const activeCode = computed(() => props.files[props.activeFilename] || '');

const handleActive = (filename: string) => {
	if (filename !== props.activeFilename) emit('active-change', filename);
};
const handleView = (view: PlaygroundView) => emit('view-change', view);
</script>
<style lang="scss">
@use '../../style' as *;

@include block(docs-playground-files) {
	display: flex;
	height: 100%;
	max-height: 100%;
	min-height: 0;
	overflow: hidden;
	background: #f7f8fa;
	flex: 1 1 auto;
	flex-direction: column;

	@include element(toolbar) {
		display: flex;
		overflow: hidden;
		box-shadow: inset 0 -1px #dedede;
		box-sizing: border-box;
		flex: 0 0 44px;
	}

	@include element(scroller) {
		width: 0;
		height: 44px;
		min-width: 0;
		overflow: hidden;
		background: #f7f8fa;
		flex: 1 1 auto;

		.vc-scroller__wrapper {
			height: 44px;
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
		height: 44px;
		min-width: 100%;
		padding: 0 10px;
		box-sizing: border-box;
		gap: 4px;
	}

	@include element(tab) {
		position: relative;
		display: inline-flex;
		height: 44px;
		padding: 0 14px;
		font: inherit;
		font-size: 15px;
		line-height: 44px;
		color: #52525b;
		white-space: nowrap;
		cursor: pointer;
		background: transparent;
		border: 0;
		box-sizing: border-box;
		gap: 5px;
		align-items: center;

		@include when(active) {
			color: #18181b;

			&::after {
				position: absolute;
				right: 8px;
				bottom: 0;
				left: 8px;
				height: 3px;
				background: #5495f6;
				border-radius: 2px 2px 0 0;
				content: '';
			}
		}
	}

	@include element(entry) {
		font-size: 10px;
		line-height: 16px;
		color: #71717a;
	}

	@include element(actions) {
		display: flex;
		height: 44px;
		background: #f7f8fa;
		box-sizing: border-box;
		flex: 0 0 auto;
		align-items: center;
	}

	@include element(body) {
		min-height: 0;
		border-radius: 0;
		flex: 1 1 auto;
	}
}

@include block(docs-playground) {
	@include element(views) {
		@include modifier(files) {
			display: flex;
			height: 44px;
			padding: 0 12px;
			box-sizing: border-box;
			gap: 4px;
			align-items: center;
		}
	}

	@include element(view) {
		display: inline-flex;
		width: 28px;
		height: 28px;
		padding: 0;
		font: inherit;
		color: #64748b;
		cursor: pointer;
		background: transparent;
		border: 0;
		border-radius: 8px;
		justify-content: center;
		align-items: center;

		@include when(active) {
			color: #fff;
			background: #2563eb;
		}
	}
}
</style>
