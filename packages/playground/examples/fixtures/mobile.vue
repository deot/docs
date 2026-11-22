<template>
	<div class="mobile-demo">
		<p class="mobile-demo__box">列宽 {{ label }}</p>
		<p v-for="item in rows" :key="item">第 {{ item }} 行，用来撑出预览滚动。</p>
	</div>
</template>
<script setup>
const label = 'local';
const rows = Array.from({ length: 24 }, (_, index) => index + 1);
</script>
<style>
.mobile-demo {
	display: flex;
	flex-direction: column;
	gap: var(--gap, calc(var(--vc-rem) * 16));
}

.mobile-demo__box {
	width: calc(var(--vc-rem) * 400);
	padding: var(--padding, calc(var(--vc-rem) * 24));
	margin: 0;
	background: var(--box, #dbeafe);
}
</style>
