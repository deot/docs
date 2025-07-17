<template>
	<div class="c-md-reset" v-markdown="modelValue || value"></div>
</template>
<script setup>
import { vMarkdown } from './directive';

// 后续再做change
defineEmits(['update:modelValue', 'change']);
defineProps({
	modelValue: String,
	value: String
});
</script>
<style lang="scss">
@use 'highlight.js/styles/github.css';
@use './style.scss';

code.hljs {
	padding: 10px;
	border-radius: 5px!important;
	background-color: #f9fafc;
}
</style>
