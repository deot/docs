<template>
	<Scroller
		class="docs-raw-editor-json-editor"
		:native="false"
		:wheel="false"
		:auto-resize="true"
		:always="true"
		height="100%"
	>
		<div ref="host" class="docs-raw-editor-json-editor__host"></div>
	</Scroller>
</template>
<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { Scroller } from '@deot/vc';
import { EditorView, basicSetup } from 'codemirror';
import { Compartment, EditorState } from '@codemirror/state';
import { json } from '@codemirror/lang-json';
import { Theme } from '../../../modules/settings';

const props = defineProps<{
	modelValue: string;
	label: string;
}>();
const emit = defineEmits<{
	'update:modelValue': [value: string];
}>();
const host = ref<HTMLElement>();
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
				json(),
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
</script>
<style lang="scss">
@use '../../../styles/bem' as *;

@include block(docs-raw-editor-json-editor) {
	width: 100%;
	min-width: 0;
	min-height: 0;
	color: varfix(foreground-color);
	background: varfix(background-color);

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
		padding: 12px 0;
		caret-color: varfix(foreground-color);
	}

	.cm-gutters {
		color: varfix(foreground-color-mute);
		background: varfix(background-color-soft);
		border-color: varfix(border-color);
	}

	.cm-activeLine, .cm-activeLineGutter {
		background: varfix(background-color-mute);
	}

	.cm-focused .cm-selectionBackground, .cm-selectionBackground {
		background: varfix(background-color-soft);
	}

	.cm-line {
		padding: 0 12px;
	}
}
</style>
