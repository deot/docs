<template>
	<div class="c-playground-editor">
		<TransitionFade @after-leave="hide">
			<div v-show="isActive" ref="wrapper" class="c-playground-editor__wrapper">
				<div ref="bar" class="c-playground-editor__header">
					<span>&lt;/&gt;</span>
					<span style="cursor: pointer;" @click="hide">&#10005;</span>
				</div>
				<div ref="textarea" class="c-playground-editor__editor">
				</div>
			</div>
		</TransitionFade>
	</div>
</template>
<script setup>
import { ref, onMounted, nextTick, onBeforeUnmount } from 'vue';
import { TransitionFade } from '@deot/vc';
import { EditorView, basicSetup } from "codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { highlightActiveLine } from "@codemirror/view";
import { Drag } from './drag';

const props = defineProps({
	source: String,
	onChange: {
		type: Function,
		default: () => {}
	}
});

const isActive = ref(false);
const textarea = ref();
const editor = ref();
const bar = ref();
const wrapper = ref();
const drag = ref();

const hide = () => {
	isActive.value = false;
};

onMounted(async () => {
	try {
		isActive.value = true;
		await nextTick();
		editor.value = new EditorView({
			doc: props.source,
			extensions: [
				basicSetup,
				javascript(),
				highlightActiveLine(),
				EditorView.updateListener.of((e) => {
					if (e.docChanged) {
						props.onChange(e.state.doc.toString());
					}
				})
			],
			parent: textarea.value
		});
		editor.value.focus();
		drag.value = new Drag({
			el: bar.value,
			wrapper: wrapper.value,
			container: window
		});
	} catch (e) {
		console.log(e);
	}
});

onBeforeUnmount(() => {
	drag.value.off();
	editor.value.destroy();
});

</script>
<style>
.c-playground-editor .c-playground-editor__wrapper {
	width: 600px;
	position: fixed;
	right: 10px;
	bottom: 10px;
	font-size: 13px;
	border-radius: 3px;
	box-shadow: 0 0 50px rgba(#000, 0.2);
	opacity: 1;
	background: white;
	z-index: 99999;
}
.c-playground-editor .c-playground-editor__header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	background: #f6f8fa !important;
	padding: 10px;
	font-size: 20px;
	line-height: 20px;
	cursor: move;
}
.c-playground-editor .c-playground-editor__editor {
	padding: 1px;
	background: #f6f8fa !important;
}
</style>
