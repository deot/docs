<template>
	<span
		class="docs-tag"
		:data-type="currentType"
		:style="{
			backgroundColor: currentColor[0],
			color: currentColor[1]
		}"
	>
		<span
			class="docs-tag__label"
			:class="{ 'docs-tag__label--ellipsis': ellipsis }"
		>
			<slot>{{ currentLabel }}</slot>
		</span>
	</span>
</template>
<script setup lang="ts">
import { computed } from 'vue';

type TagValue = string | number;
type TagColor = readonly [background: string, foreground: string];

const props = withDefaults(defineProps<{
	type?: string;
	value?: TagValue;
	label?: string | Record<string, string>;
	options?: Record<string, TagValue[]>;
	color?: Record<string, TagColor>;
	ellipsis?: boolean;
}>(), {
	type: 'default',
	value: 0,
	label: '',
	options: () => ({}),
	color: () => ({}),
	ellipsis: true
});

const colorMap = computed<Record<string, TagColor>>(() => ({
	default: ['#EDF0F2', '#080F20'],
	waiting: ['#EDF0F2', '#080F20'],
	pending: ['#FAEDDB', '#A55205'],
	success: ['#DBF4ED', '#1DB88C'],
	error: ['#FEE8E8', '#F53F3F'],
	green: ['#E9F6ED', '#54B675'],
	orange: ['#FEF0E6', '#F3833A'],
	red: ['#FDE7E7', '#F53F3F'],
	blue: ['#E9ECFE', '#456CF6'],
	purple: ['#F1E9FF', '#8E51FF'],
	...props.color
}));

// 显式 type 优先；未指定时从第一个匹配的 value 分组中推导。
const currentType = computed(() => {
	if (props.type !== 'default') return props.type;
	return Object.keys(props.options).find(key => props.options[key]?.includes(props.value))
		|| 'default';
});
const currentColor = computed(() => colorMap.value[currentType.value] || colorMap.value.default);
const currentLabel = computed(() => (
	typeof props.label === 'object'
		? props.label[currentType.value]
		: props.label
));
</script>
<style lang="scss">
@use '../../styles/bem' as *;

@include block(docs-tag) {
	display: inline-flex;
	max-width: 100%;
	min-width: 0;
	padding: 2px 8px;
	font-size: 13px;
	font-weight: 400;
	line-height: 20px;
	vertical-align: middle;
	border-radius: 6px;
	align-items: center;

	@include element(label) {
		white-space: nowrap;

		@include modifier(ellipsis) {
			overflow: hidden;
			text-overflow: ellipsis;
		}
	}
}
</style>
