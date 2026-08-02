<template>
	<div class="docs-playground-editor">
		<TransitionFade @after-leave="handleHide">
			<div v-show="isActive" ref="wrapper" class="docs-playground-editor__wrapper">
				<div ref="bar" class="docs-playground-editor__header">
					<span>&lt;/&gt;</span>
					<span style="cursor: pointer;" @click="handleHide">&#10005;</span>
				</div>
				<div class="docs-playground-editor__files">
					<Scroller
						ref="scroller"
						class="docs-playground-editor__scroller"
						:auto-resize="true"
						:native="false"
						:show-bar="true"
						height="40"
						content-class="docs-playground-editor__tabs"
						wrapper-style="overflow-y: hidden;"
					>
						<div
							v-for="filename in filenames"
							:key="filename"
							class="docs-playground-editor__tab"
							:class="{ active: filename === activeFilename }"
							:data-filename="filename"
							@click="handleTabClick($event, filename)"
							@dblclick="handleRename(filename)"
						>
							<input
								v-if="renamingFilename === filename"
								:ref="setFilenameInput"
								v-model="filenameDraft"
								class="docs-playground-editor__filename"
								@click.stop
								@dblclick.stop
								@blur="handleRenameSubmit"
								@keydown.enter.prevent="handleRenameSubmit"
								@keydown.esc.prevent="handleRenameCancel"
							>
							<template v-else>
								<span v-if="filename === currentEntry" title="入口文件">●</span>
								<span>{{ filename }}</span>
								<button
									v-if="filename === currentEntry"
									type="button"
									class="docs-playground-editor__close"
									title="入口文件不能删除"
									aria-label="入口文件不能删除"
									disabled
								></button>
								<Popconfirm
									v-else
									class="docs-playground-editor__delete"
									:title="`确认删除 ${filename}？`"
									:portal="true"
									placement="bottom"
									@ok="handleDelete(filename)"
								>
									<button
										type="button"
										class="docs-playground-editor__close"
										title="删除文件"
										:aria-label="`删除 ${filename}`"
									></button>
								</Popconfirm>
							</template>
						</div>
					</Scroller>
					<div class="docs-playground-editor__actions">
						<button type="button" title="新建文件" @click="handleCreate">＋</button>
						<button
							type="button"
							title="设为入口"
							:disabled="activeFilename === currentEntry"
							@click="handleEntry"
						>
							设为入口
						</button>
					</div>
				</div>
				<div v-if="codeErrorText" class="docs-playground-editor__error">
					{{ codeErrorText }}
				</div>
				<div ref="textarea" class="docs-playground-editor__editor"></div>
			</div>
		</TransitionFade>
	</div>
</template>
<script lang="ts" setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import type { ComponentPublicInstance } from 'vue';
import { Message, Popconfirm, Scroller, TransitionFade } from '@deot/vc';
import { EditorView, basicSetup } from 'codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { vue } from '@codemirror/lang-vue';
import { highlightActiveLine } from '@codemirror/view';
import type { PlaygroundFiles } from '../types';
import type { EditorFilesChange, EditorFilesChangeAction } from './types';
import { Drag } from './drag';

const SUPPORTED_FILE_RE = /\.(vue|js|ts|jsx|tsx|css|json|html)$/i;
const newSFCCode = `<script setup lang="ts"><\/script>\n\n<template>\n  <div>\n    <slot />\n  <\/div>\n<\/template>\n`;

const props = withDefaults(defineProps<{
	value?: string;
	files?: PlaygroundFiles;
	entry?: string;
	onChange?: (value: string) => void;
	onFilesChange?: EditorFilesChange;
	onActiveChange?: (filename: string) => void;
	getCodeErrors?: () => Array<string | Error>;
}>(), {
	value: '',
	files: () => ({}),
	entry: '',
	onChange: () => {},
	onFilesChange: () => {},
	onActiveChange: () => {},
	getCodeErrors: () => []
});

const initialFiles = Object.keys(props.files).length
	? props.files
	: { 'App.vue': props.value };
const editorFiles = ref<PlaygroundFiles>({ ...initialFiles });
const filenames = computed(() => Object.keys(editorFiles.value));
const currentEntry = ref(
	props.entry && editorFiles.value[props.entry] !== undefined
		? props.entry
		: filenames.value[0]
);
const activeFilename = ref(currentEntry.value);
const isActive = ref(false);
const textarea = ref<HTMLDivElement | null>(null);
const filenameInput = ref<HTMLInputElement | null>(null);
const scroller = ref<{
	refresh: () => Promise<void> | void;
	setScrollLeft: (value: number) => void;
} | null>(null);
const editor = ref<EditorView | null>(null);
const bar = ref<HTMLDivElement | null>(null);
const wrapper = ref<HTMLDivElement | null>(null);
const drag = ref<Drag | null>(null);
const renamingFilename = ref('');
const filenameDraft = ref('');
const codeErrorText = computed(() => props.getCodeErrors()
	.map(item => item instanceof Error ? item.message : item)
	.join('\n'));

const setFilenameInput = (el: Element | ComponentPublicInstance | null) => {
	filenameInput.value = el instanceof HTMLInputElement ? el : null;
};

const handleHide = () => {
	isActive.value = false;
};

const languageExtension = (filename: string) => {
	if (/\.vue$/i.test(filename)) return vue();
	if (/\.[jt]sx?$/i.test(filename)) {
		return javascript({
			jsx: /x$/i.test(filename),
			typescript: /\.tsx?$/i.test(filename)
		});
	}
	return undefined;
};

const createEditor = () => {
	if (!textarea.value || !activeFilename.value) return;
	editor.value?.destroy();
	const filename = activeFilename.value;
	const language = languageExtension(filename);
	editor.value = new EditorView({
		doc: editorFiles.value[filename] || '',
		extensions: [
			basicSetup,
			...(language ? [language] : []),
			highlightActiveLine(),
			EditorView.updateListener.of((e) => {
				if (!e.docChanged) return;
				const code = e.state.doc.toString();
				editorFiles.value = { ...editorFiles.value, [filename]: code };
				props.onFilesChange({ ...editorFiles.value }, currentEntry.value, {
					type: 'update',
					filename
				});
				if (filename === currentEntry.value) props.onChange(code);
			})
		],
		parent: textarea.value
	});
	editor.value.focus();
};

const handleActive = (filename: string) => {
	if (filename === activeFilename.value || editorFiles.value[filename] === undefined) return;
	activeFilename.value = filename;
	props.onActiveChange(filename);
	createEditor();
};

const handleTabClick = (e: MouseEvent, filename: string) => {
	if ((e.target as Element).closest('.docs-playground-editor__close')) return;
	handleActive(filename);
};

const nextFilename = () => {
	let index = 1;
	let filename = 'comp1.vue';
	while (editorFiles.value[filename] !== undefined) {
		index++;
		filename = `comp${index}.vue`;
	}
	return filename;
};

const focusFilename = () => nextTick(() => {
	filenameInput.value?.focus();
	filenameInput.value?.select();
});

const handleCreate = () => {
	const filename = nextFilename();
	editorFiles.value = { ...editorFiles.value, [filename]: newSFCCode };
	activeFilename.value = filename;
	notifyFilesChange({ type: 'create', filename });
	props.onActiveChange(filename);
	createEditor();
	nextTick(async () => {
		await scroller.value?.refresh();
		scroller.value?.setScrollLeft(Number.MAX_SAFE_INTEGER);
	});
};

const handleRename = (filename: string) => {
	handleActive(filename);
	renamingFilename.value = filename;
	filenameDraft.value = filename;
	focusFilename();
};

const handleRenameCancel = () => {
	renamingFilename.value = '';
	filenameDraft.value = '';
};

const validateFilename = (filename: string, previousFilename = '') => {
	if (!filename) return '请输入文件名';
	if (filename.startsWith('/') || filename.includes('\\')) return '文件名必须是相对 POSIX 路径';
	if (filename.split('/').some(part => !part || part === '.' || part === '..')) return '文件路径不能包含空段、. 或 ..';
	if (!SUPPORTED_FILE_RE.test(filename)) return '不支持该文件类型';
	if (filename !== previousFilename && editorFiles.value[filename] !== undefined) return '文件名已存在';
	return '';
};

const notifyFilesChange = (action: EditorFilesChangeAction) => {
	props.onFilesChange({ ...editorFiles.value }, currentEntry.value, action);
};

const handleRenameSubmit = () => {
	const filename = filenameDraft.value.trim();
	const previousFilename = renamingFilename.value;
	if (!previousFilename) return;
	const operationError = validateFilename(filename, previousFilename);
	if (operationError) {
		Message.error(operationError);
		renamingFilename.value = '';
		filenameDraft.value = '';
		return;
	}

	if (filename !== previousFilename) {
		const renamedFiles: PlaygroundFiles = {};
		for (const [name, code] of Object.entries(editorFiles.value)) {
			renamedFiles[name === previousFilename ? filename : name] = code;
		}
		editorFiles.value = renamedFiles;
		activeFilename.value = filename;
		if (currentEntry.value === previousFilename) currentEntry.value = filename;
		notifyFilesChange({ type: 'rename', filename, previousFilename });
	}

	renamingFilename.value = '';
	filenameDraft.value = '';
	createEditor();
};

const handleDelete = (filename: string) => {
	if (filename === currentEntry.value) return;
	const nextFiles = { ...editorFiles.value };
	delete nextFiles[filename];
	editorFiles.value = nextFiles;
	notifyFilesChange({ type: 'delete', filename });
	if (activeFilename.value === filename) {
		activeFilename.value = currentEntry.value;
		props.onActiveChange(currentEntry.value);
		createEditor();
	}
};

const handleEntry = () => {
	if (activeFilename.value === currentEntry.value) return;
	currentEntry.value = activeFilename.value;
	notifyFilesChange({ type: 'entry', filename: currentEntry.value });
};

onMounted(async () => {
	isActive.value = true;
	await nextTick();
	if (!textarea.value || !bar.value || !wrapper.value) return;
	createEditor();
	drag.value = new Drag({
		el: bar.value,
		wrapper: wrapper.value,
		container: window
	});
});

onBeforeUnmount(() => {
	drag.value?.off();
	editor.value?.destroy();
});
</script>
<style>
.docs-playground-editor .docs-playground-editor__wrapper {
	position: fixed;
	right: 10px;
	bottom: 10px;
	z-index: 1001;
	width: 680px;
	font-size: 13px;
	background: white;
	border-radius: 8px;
	opacity: 1;
	box-shadow: 0 0 50px rgb(0 0 0 / 20%);
}

.docs-playground-editor .docs-playground-editor__header {
	display: flex;
	padding: 10px;
	font-size: 20px;
	line-height: 20px;
	cursor: move;
	background: #f6f8fa !important;
	justify-content: space-between;
	align-items: center;
}

.docs-playground-editor .docs-playground-editor__files {
	display: flex;
	width: 100%;
	min-width: 0;
	padding: 6px 8px;
	overflow: hidden;
	background: #f6f8fa;
	border-top: 1px solid #e5e7eb;
	border-bottom: 1px solid #e5e7eb;
	box-sizing: border-box;
	gap: 8px;
	justify-content: space-between;
}

.docs-playground-editor .docs-playground-editor__actions {
	display: flex;
	flex: 0 0 auto;
	gap: 4px;
}

.docs-playground-editor .docs-playground-editor__scroller {
	width: 0;
	flex: 1 1 0;
	min-width: 0;
	overflow: hidden;
}

.docs-playground-editor .docs-playground-editor__scroller .vc-scroller__wrapper {
	scrollbar-width: none;
}

.docs-playground-editor .docs-playground-editor__scroller .vc-scroller__wrapper::-webkit-scrollbar {
	display: none;
}

.docs-playground-editor .docs-playground-editor__tabs {
	display: inline-flex;
	min-width: 100%;
	padding: 6px 6px 0 0;
	box-sizing: border-box;
	gap: 8px;
}

.docs-playground-editor .docs-playground-editor__tab {
	position: relative;
	display: inline-flex;
	height: 26px;
	padding: 3px 12px 3px 7px;
	line-height: 18px;
	white-space: nowrap;
	cursor: pointer;
	background: white;
	border: 1px solid #d1d5db;
	border-radius: 8px;
	box-sizing: border-box;
	gap: 5px;
	align-items: center;
}

.docs-playground-editor button {
	padding: 3px 7px;
	white-space: nowrap;
	cursor: pointer;
	background: white;
	border: 1px solid #d1d5db;
	border-radius: 8px;
}

.docs-playground-editor .docs-playground-editor__tab.active {
	color: white;
	background: #2563eb;
	border-color: #2563eb;
}

.docs-playground-editor button:disabled {
	cursor: not-allowed;
	opacity: 0.5;
}

.docs-playground-editor .docs-playground-editor__filename {
	width: 100px;
	height: 18px;
	padding: 0 3px;
	font: inherit;
	line-height: 16px;
	border: 1px solid #d1d5db;
	box-sizing: border-box;
}

.docs-playground-editor .docs-playground-editor__close {
	position: absolute;
	top: -6px;
	right: -6px;
	z-index: 1;
	display: flex;
	width: 14px;
	height: 14px;
	padding: 0;
	font-size: 0;
	line-height: 0;
	color: #fff;
	background-color: #5495f6;
	border: 0;
	border-radius: 7px;
	justify-content: center;
	align-items: center;
}

.docs-playground-editor .docs-playground-editor__close::before,
.docs-playground-editor .docs-playground-editor__close::after {
	position: absolute;
	top: 50%;
	left: 50%;
	width: 8px;
	height: 1px;
	background-color: currentcolor;
	content: '';
}

.docs-playground-editor .docs-playground-editor__close::before {
	transform: translate(-50%, -50%) rotate(45deg);
}

.docs-playground-editor .docs-playground-editor__close::after {
	transform: translate(-50%, -50%) rotate(-45deg);
}

.docs-playground-editor .docs-playground-editor__delete {
	position: static !important;
}

.docs-playground-editor .docs-playground-editor__error {
	padding: 5px 10px;
	color: #b91c1c;
	white-space: pre-wrap;
	background: #fef2f2;
}

.docs-playground-editor .docs-playground-editor__editor {
	min-height: 240px;
	padding: 1px;
	background: #f6f8fa !important;
}
</style>
