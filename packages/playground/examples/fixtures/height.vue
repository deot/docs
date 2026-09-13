<template>
	<div class="height-demo">
		<button @click="open">打开浮层</button>
		<button @click="run">等待任务</button>
		<span>{{ status }}</span>
		<Teleport to="body">
			<div v-if="visible" class="height-demo__overlay">
				<p>高度就绪后打开，关闭后恢复</p>
				<button @click="visible = false">关闭浮层</button>
			</div>
		</Teleport>
	</div>
</template>
<script setup>
import { inject, ref } from 'vue';

const playground = inject('docs:playground');
const visible = ref(false);
const status = ref('尚未运行');
const open = playground.run(560, { visible }, () => {
	visible.value = true;
});
const run = window.$docsPlayground.run(400, async () => {
	status.value = '等待中';
	await new Promise(resolve => setTimeout(resolve, 800));
	status.value = '已完成';
});
</script>
<style scoped>
.height-demo {
	display: flex;
	gap: 12px;
	padding: 16px;
}

.height-demo__overlay {
	position: fixed;
	inset: 0;
	display: grid;
	place-content: center;
	background: #eaf2ff;
}
</style>
