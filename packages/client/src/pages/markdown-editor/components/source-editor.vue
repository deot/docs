<template>
	<Scroller
		ref="scroller"
		class="docs-markdown-editor-source-editor"
		:native="false"
		:wheel="false"
		:auto-resize="true"
		:always="true"
		height="100%"
		@scroll="emit('scroll')"
	>
		<div ref="host" class="docs-markdown-editor-source-editor__host"></div>
	</Scroller>
</template>
<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { ComponentPublicInstance } from 'vue';
import { Scroller } from '@deot/vc';
import type { ScrollerExposed } from '@deot/vc';
import { EditorView, basicSetup } from 'codemirror';
import { Compartment, EditorState } from '@codemirror/state';
import { markdown } from '@codemirror/lang-markdown';
import { Theme } from '../../../modules/settings';

const props = defineProps<{
	modelValue: string;
	label: string;
}>();
const emit = defineEmits<{
	'update:modelValue': [value: string];
	'scroll': [];
}>();
const host = ref<HTMLElement>();
const scroller = ref<ScrollerExposed & ComponentPublicInstance>();
const theme = new Compartment();
const attributes = new Compartment();
let editor: EditorView | undefined;
const editorTheme = () => EditorView.theme({}, { dark: Theme.current.value === 'dark' });
const editorAttributes = () => EditorView.contentAttributes.of({ 'aria-label': props.label });
onMounted(() => {
	editor = new EditorView({
		parent: host.value,
		state: EditorState.create({
			doc: props.modelValue,
			extensions: [
				basicSetup,
				markdown(),
				EditorView.lineWrapping,
				theme.of(editorTheme()),
				attributes.of(editorAttributes()),
				EditorView.updateListener.of((update) => {
					if (!update.docChanged) return;
					const value = update.state.doc.toString();
					if (value !== props.modelValue) emit('update:modelValue', value);
				})
			]
		})
	});
});
watch(() => props.modelValue, (value) => {
	if (!editor || value === editor.state.doc.toString()) return;
	editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: value } });
});
watch(Theme.current, () => editor?.dispatch({ effects: theme.reconfigure(editorTheme()) }));
watch(() => props.label, () => editor?.dispatch({ effects: attributes.reconfigure(editorAttributes()) }));
onBeforeUnmount(() => editor?.destroy());
defineExpose({
	getScrollElement: () => scroller.value?.$el as HTMLElement | undefined,
	getLineTop: (line: number) => editor?.lineBlockAt(editor.state.doc.line(line).from).top ?? 0,
	setScrollTop: (top: number) => scroller.value?.setScrollTop(top)
});
</script>
<style lang="scss">
@use '../../../styles/bem' as *;

@include block(docs-markdown-editor-source-editor) {
	width: 100%;
	min-width: 0;
	min-height: 0;
	color: varfix(foreground-color-dark);
	background: varfix(background-color-lightest);

	.cm-editor {
		height: auto;
		min-height: 100%;
		font-size: 14px;
	}

	.cm-scroller {
		overflow: visible;
		font-family: monospace;
		line-height: 1.6;
	}

	.cm-content {
		padding: 24px 0;
		caret-color: varfix(foreground-color-dark);
	}

	.cm-gutters {
		color: varfix(foreground-color-light);
		background: varfix(background-color-light);
		border-color: varfix(border-color);
	}

	.cm-activeLine, .cm-activeLineGutter {
		background: varfix(background-color-lighter);
	}

	.cm-focused .cm-selectionBackground, .cm-selectionBackground {
		background: varfix(background-color-light);
	}

	.cm-line {
		padding: 0 24px;
	}
}
</style>
