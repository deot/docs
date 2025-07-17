<template>
	<div v-if="!styleless" class="c-playground">
		<div class="c-playground__header">
			<div class="c-playground__tools">
				<Clipboard :value="modelValue" tag="span">
					{{ copyText['zh-CN'] }}
				</Clipboard>
				<span @click="handleEditor">&lt;/&gt;</span>
			</div>
		</div>
		<div v-if="error" class="c-playground__error">
			{{ error }}
		</div>
		<section v-show="!error" ref="preview" class="c-playground__preview">
			<Sandbox
				:store="store"
				:preview-options="previewOptions"
			/>
		</section>
	</div>
	<Sandbox v-else :store="store" :preview-options="previewOptions" />
</template>
<script setup>
import { ref, watch, computed } from 'vue';
import { Sandbox, useStore } from '@vue/repl';
import { Clipboard } from '@deot/vc';
import { Editor } from './editor';

const emit = defineEmits(['update:modelValue', 'change']);
const props = defineProps({
	modelValue: String,
	styleless: {
		type: Boolean,
		default: false
	},
	options: {
		type: Object,
		default: () => ({})
	}
});
const newSFCCode = `<script setup><\/script>\n\n<template>\n  <div>\n    <slot />\n  <\/div>\n<\/template>\n`;
const welcomeSFCCode = newSFCCode;

const copyText = {
	'zh-CN': '复制',
	'en-US': 'Copy',
};

const error = ref('');
const template = ref({
	welcomeSFC: props.modelValue || welcomeSFCCode,
	newSFC: newSFCCode
});

const store = useStore({
	...props.options,
	builtinImportMap: ref({
		...props.options?.builtinImportMap,
		imports: {
			'@deot/vc': 'https://unpkg.com/@deot/vc/dist/index.js',
			'@deot/vc-shared': 'https://unpkg.com/@deot/vc-shared/dist/index.js',
			'@deot/vc-hooks': 'https://unpkg.com/@deot/vc-hooks/dist/index.js',
			'@deot/vc-components': 'https://unpkg.com/@deot/vc-components/dist/index.js',
			'@deot/helper-resize': 'https://unpkg.com/@deot/helper-resize/dist/index.js',
			'@deot/helper-utils': 'https://unpkg.com/@deot/helper-utils/dist/index.js',
			'@deot/helper-cache': 'https://unpkg.com/@deot/helper-cache/dist/index.js',
			'@deot/helper-fp': 'https://unpkg.com/@deot/helper-fp/dist/index.js',
			'@deot/helper-dom': 'https://unpkg.com/@deot/helper-dom/dist/index.js',
			'@deot/helper-wheel': 'https://unpkg.com/@deot/helper-wheel/dist/index.js',
			'@deot/helper-validator': 'https://unpkg.com/@deot/helper-validator/dist/index.js',
			'@deot/helper-load': 'https://unpkg.com/@deot/helper-load/dist/index.js',
			'@deot/helper-scheduler': 'https://unpkg.com/@deot/helper-scheduler/dist/index.js',
			'@deot/helper-emitter': 'https://unpkg.com/@deot/helper-emitter/dist/index.js',
			'@deot/helper-is': 'https://unpkg.com/@deot/helper-is/dist/index.js',
			'@deot/helper-device': 'https://unpkg.com/@deot/helper-device/dist/index.js',
			'@deot/helper-route': 'https://unpkg.com/@deot/helper-route/dist/index.js',
			'@deot/helper-unicode': 'https://unpkg.com/@deot/helper-unicode/dist/index.js',
			'@deot/helper': 'https://unpkg.com/@deot/helper/dist/index.js',
			'normalize-wheel': 'https://unpkg.com/normalize-wheel-es/dist/index.mjs',
			'photoswipe': 'https://unpkg.com/photoswipe/dist/photoswipe.esm.js',
			'photoswipe/lightbox': 'https://unpkg.com/photoswipe/dist/photoswipe-lightbox.esm.js',
			'lodash-es': 'https://unpkg.com/lodash-es/lodash.js',
			'lodash': 'https://unpkg.com/lodash/lodash.js',
			'vue': 'https://play.vuejs.org/vue.runtime.esm-browser.js',
			'vue/server-renderer': 'https://play.vuejs.org/server-renderer.esm-browser.js',
			...props.options?.builtinImportMap?.imports
		},
	}),
	template
});

const previewOptions = computed(() => {
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
		onChange: (code) => {
			store.activeFile.code = code;
			emit('update:modelValue', code);
			emit('change', code);
		}
	});
};

watch(() => props.modelValue, v => (store.activeFile.code = v));

defineExpose({
	store
});
</script>
<style>
.c-playground {
	width: 100%;
	display: flex;
	justify-content: center;
	flex-direction: column;
	box-shadow: rgb(229, 229, 229) 0px 0px 10px;
	margin-bottom: 16px;
	box-sizing: border-box;
}
.c-playground__header {
	display: flex;
	justify-content: flex-end;
	align-items: center;
	background: #f6f8fa !important;
	padding: 10px;
}
.c-playground__tools {
	display: flex;
	align-items: center;
	font-size: 14px;
	line-height: 20px;
}
.c-playground__tools > span {
	cursor: pointer;
	margin-left: 10px;
}
.c-playground__tools > span:last-child {
	font-size: 20px;
}
.c-playground__error {
	display: flex;
	justify-content: center;
	align-items: center;
	height: 100%;
	box-sizing: border-box;
}
.c-playground__preview {
	padding: 10px;
	margin-top: 10px;
	box-sizing: border-box;
}
</style>
