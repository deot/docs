<template>
	<div class="docs-playground-files">
		<div class="docs-playground-files__toolbar">
			<Scroller
				class="docs-playground-files__scroller"
				:auto-resize="true"
				:native="false"
				:show-bar="true"
				height="48"
				content-class="docs-playground-files__tabs"
				content-style="height: 48px; overflow: hidden;"
				wrapper-style="height: 48px; overflow-x: auto; overflow-y: hidden;"
			>
				<button
					v-for="filename in filenames"
					:key="filename"
					type="button"
					class="docs-playground-files__tab"
					:class="{ active: filename === activeFilename }"
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
						:class="{ active: item === activeView }"
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
<style>
.docs-playground-files {
	display: flex;
	height: 100%;
	max-height: 100%;
	min-height: 0;
	overflow: hidden;
	background: #f7f8fa;
	flex: 1 1 auto;
	flex-direction: column;
}

.docs-playground-files .docs-playground-files__toolbar {
	display: flex;
	height: 48px;
	overflow: hidden;
	box-shadow: inset 0 -1px #dedede;
	box-sizing: border-box;
	flex: 0 0 48px;
}

.docs-playground-files .docs-playground-files__scroller {
	width: 0;
	height: 48px;
	min-width: 0;
	overflow: hidden;
	background: #f7f8fa;
	flex: 1 1 auto;
}

.docs-playground-files .docs-playground-files__scroller .vc-scroller__wrapper {
	height: 48px;
	overflow-y: hidden !important;
	scrollbar-width: none;
}

.docs-playground-files .docs-playground-files__scroller .vc-scroller__wrapper::-webkit-scrollbar {
	display: none;
}

.docs-playground-files .docs-playground-files__scroller .vc-scroller-track.is-y {
	display: none !important;
}

.docs-playground-files .docs-playground-files__tabs {
	display: inline-flex;
	height: 48px;
	min-width: 100%;
	padding: 0 20px;
	box-sizing: border-box;
	gap: 4px;
}

.docs-playground-files .docs-playground-files__tab {
	position: relative;
	display: inline-flex;
	height: 48px;
	padding: 0 14px;
	font: inherit;
	font-size: 15px;
	line-height: 48px;
	color: #52525b;
	white-space: nowrap;
	cursor: pointer;
	background: transparent;
	border: 0;
	box-sizing: border-box;
	gap: 5px;
	align-items: center;
}

.docs-playground-files .docs-playground-files__tab.active {
	color: #18181b;
}

.docs-playground-files .docs-playground-files__tab.active::after {
	position: absolute;
	right: 8px;
	bottom: 0;
	left: 8px;
	height: 3px;
	background: #5495f6;
	border-radius: 2px 2px 0 0;
	content: '';
}

.docs-playground-files .docs-playground-files__entry {
	font-size: 10px;
	line-height: 16px;
	color: #71717a;
}

.docs-playground-files .docs-playground-files__actions {
	display: flex;
	height: 48px;
	background: #f7f8fa;
	box-sizing: border-box;
	flex: 0 0 auto;
	align-items: center;
}

.docs-playground-files .docs-playground__views--files {
	display: flex;
	height: 48px;
	padding: 0 12px;
	box-sizing: border-box;
	gap: 4px;
	align-items: center;
}

.docs-playground-files .docs-playground__view {
	display: inline-flex;
	width: 30px;
	height: 30px;
	padding: 0;
	font: inherit;
	color: #64748b;
	cursor: pointer;
	background: transparent;
	border: 0;
	border-radius: 8px;
	justify-content: center;
	align-items: center;
}

.docs-playground-files .docs-playground__view.active {
	color: #fff;
	background: #2563eb;
}

.docs-playground-files .docs-playground-files__body {
	min-height: 0;
	border-radius: 0;
	flex: 1 1 auto;
}
</style>
