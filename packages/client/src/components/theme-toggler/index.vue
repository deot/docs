<template>
	<div
		v-if="Theme.enabled.value"
		ref="togglerRef"
		class="theme-toggler-content theme-toggler"
		role="switch"
		tabindex="0"
		:aria-checked="isDark"
		:aria-label="label"
		@click.capture="handleToggle"
		@keydown.enter.stop.prevent="handleKeyboard"
		@keydown.space.stop.prevent="handleKeyboard"
	>
		<Switch
			:model-value="Theme.current.value"
			checked-value="dark"
			unchecked-value="light"
			:width="40"
			:height="20"
			:border-width="1"
		/>
		<ClientIcon
			:name="isDark ? 'moon' : 'sun'"
			class="theme-toggler__icon"
			:class="isDark ? 'is-dark' : 'is-light'"
		/>
	</div>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue';
import { Switch } from '@deot/vc';
import { useLocale } from '@deot/docs-locale';
import ClientIcon from '../icon';
import { Theme } from '../../modules/theme';

const { t } = useLocale();
const togglerRef = ref<HTMLElement>();
const isDark = computed(() => Theme.current.value === 'dark');
const label = computed(() => t(isDark.value
	? 'client.header.switchToLight'
	: 'client.header.switchToDark'));
// 始终以完整切换器的中心为动画原点，避免子组件转发事件或键盘点击改变圆心。
const handleToggle = () => Theme.toggle(togglerRef.value);
const handleKeyboard = () => Theme.toggle(togglerRef.value);
</script>
<style lang="scss">
@use '../../styles/bem' as *;

@include block(theme-toggler) {
	position: relative;
	display: inline-flex;
	height: 24px;
	padding: 0 4px;
	border-radius: 12px;
	align-items: center;

	&:focus-visible {
		outline: 2px solid varfix(primary-color);
		outline-offset: 2px;
	}

	.vc-switch {
		display: inline-flex;

		&__wrapper {
			background: varfix(background-color-mute) !important;
			border-color: varfix(border-color) !important;
		}

		&__inner {
			background: varfix(background-color) !important;
		}
	}

	@include element(icon) {
		position: absolute;
		top: 6px;
		width: 12px;
		height: 12px;
		pointer-events: none;
		transition: left 0.2s ease;

		@include when(light) {
			left: 8px;
			color: varfix(foreground-color-mute);
		}

		@include when(dark) {
			left: 28px;
			color: varfix(foreground-color-light);
		}

	}
}
</style>
