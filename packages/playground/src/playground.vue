<template>
	<div v-if="!styleless" class="docs-playground">
		<div class="docs-playground__header">
			<div class="docs-playground__tools">
				<Clipboard :value="modelValue" tag="span">
					{{ copyText['zh-CN'] }}
				</Clipboard>
				<span @click="handleEditor">&lt;/&gt;</span>
			</div>
		</div>
		<div v-if="error" class="docs-playground__error">
			{{ error }}
		</div>
		<section v-show="!error" ref="preview" class="docs-playground__preview">
			<Sandbox
				:store="store"
				:clear-console="clearConsole"
				:preview-options="previewOptions"
			/>
		</section>
	</div>
	<Sandbox v-else :store="store" :preview-options="previewOptions" />
</template>
<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { Sandbox, useStore } from '@vue/repl';
import type { ImportMap, SandboxProps, StoreState } from '@vue/repl';
import { Clipboard } from '@deot/vc';
import { Editor } from './editor';

const emit = defineEmits<{
	'update:modelValue': [value: string];
	'change': [value: string];
}>();
type PlaygroundOptions = Omit<Partial<StoreState>, 'builtinImportMap'> & {
	builtinImportMap?: ImportMap;
};
const props = withDefaults(defineProps<{
	modelValue?: string;
	styleless?: boolean;
	options?: PlaygroundOptions;
}>(), {
	modelValue: '',
	styleless: false,
	options: () => ({})
});
const newSFCCode = `<script setup lang="ts"><\/script>\n\n<template>\n  <div>\n    <slot />\n  <\/div>\n<\/template>\n`;
const welcomeSFCCode = newSFCCode;

const copyText = {
	'zh-CN': '复制',
	'en-US': 'Copy',
};

const env = (import.meta as ImportMeta & { env: { MODE?: string } }).env;
const clearConsole = ref(env.MODE !== 'development');
const error = ref('');
const template = ref({
	welcomeSFC: props.modelValue || welcomeSFCCode,
	newSFC: newSFCCode
});

// https://unpkg.com
const cdnURL = 'https://cdn.jsdelivr.net/npm';
const store = useStore({
	...props.options,
	builtinImportMap: ref({
		...props.options?.builtinImportMap,
		imports: {
			'@deot/vc': `${cdnURL}/@deot/vc/dist/index.js`,
			'@deot/vc-shared': `${cdnURL}/@deot/vc-shared/dist/index.js`,
			'@deot/vc-hooks': `${cdnURL}/@deot/vc-hooks/dist/index.js`,
			'@deot/vc-components': `${cdnURL}/@deot/vc-components/dist/index.js`,
			'@deot/helper-resize': `${cdnURL}/@deot/helper-resize/dist/index.js`,
			'@deot/helper-utils': `${cdnURL}/@deot/helper-utils/dist/index.js`,
			'@deot/helper-cache': `${cdnURL}/@deot/helper-cache/dist/index.js`,
			'@deot/helper-fp': `${cdnURL}/@deot/helper-fp/dist/index.js`,
			'@deot/helper-dom': `${cdnURL}/@deot/helper-dom/dist/index.js`,
			'@deot/helper-wheel': `${cdnURL}/@deot/helper-wheel/dist/index.js`,
			'@deot/helper-validator': `${cdnURL}/@deot/helper-validator/dist/index.js`,
			'@deot/helper-load': `${cdnURL}/@deot/helper-load/dist/index.js`,
			'@deot/helper-scheduler': `${cdnURL}/@deot/helper-scheduler/dist/index.js`,
			'@deot/helper-emitter': `${cdnURL}/@deot/helper-emitter/dist/index.js`,
			'@deot/helper-is': `${cdnURL}/@deot/helper-is/dist/index.js`,
			'@deot/helper-device': `${cdnURL}/@deot/helper-device/dist/index.js`,
			'@deot/helper-route': `${cdnURL}/@deot/helper-route/dist/index.js`,
			'@deot/helper-unicode': `${cdnURL}/@deot/helper-unicode/dist/index.js`,
			'@deot/helper': `${cdnURL}/@deot/helper/dist/index.js`,
			'normalize-wheel': `${cdnURL}/normalize-wheel-es/dist/index.mjs`,
			'photoswipe': `${cdnURL}/photoswipe/dist/photoswipe.esm.js`,
			'photoswipe/lightbox': `${cdnURL}/photoswipe/dist/photoswipe-lightbox.esm.js`,
			'lodash-es': `${cdnURL}/lodash-es/lodash.js`,
			'lodash': `${cdnURL}/lodash/lodash.js`,
			'vue': 'https://play.vuejs.org/vue.runtime.esm-browser.js',
			'vue/server-renderer': 'https://play.vuejs.org/server-renderer.esm-browser.js',
			...props.options?.builtinImportMap?.imports
		},
	}),
	template
});

const previewOptions = computed<SandboxProps['previewOptions']>(() => {
	return {
		headHTML: [
			'<link rel="stylesheet" href="https://unpkg.com/@deot/style/dist/index.normalize-only.css">',
			'<link rel="stylesheet" href="https://unpkg.com/@deot/vc-components/dist/index.style.css">',
			'<link rel="stylesheet" href="https://unpkg.com/@deot/style/dist/index.css">',
			'<style> body{ background: white } </style>'
		].join('\n')
	};
});

const handleEditor = () => {
	Editor.popup({
		value: template.value.welcomeSFC,
		onChange: (code: string) => {
			store.activeFile.code = code;
			emit('update:modelValue', code);
			emit('change', code);
		}
	});
};

watch(() => props.modelValue, (value: string) => (store.activeFile.code = value));

defineExpose({
	store
});
</script>
<style>
.docs-playground {
	display: flex;
	width: 100%;
	margin-bottom: 16px;
	box-shadow: rgb(229 229 229) 0 0 10px;
	box-sizing: border-box;
	justify-content: center;
	flex-direction: column;
}

.docs-playground__header {
	display: flex;
	padding: 10px;
	background: #f6f8fa !important;
	justify-content: flex-end;
	align-items: center;
}

.docs-playground__tools {
	display: flex;
	align-items: center;
	font-size: 14px;
	line-height: 20px;
}

.docs-playground__tools > span {
	margin-left: 10px;
	cursor: pointer;
}

.docs-playground__tools > span:last-child {
	font-size: 20px;
}

.docs-playground__error {
	display: flex;
	justify-content: center;
	align-items: center;
	height: 100%;
	box-sizing: border-box;
}

.docs-playground__preview {
	padding: 10px;
	background: white;
	box-sizing: border-box;
}
</style>
