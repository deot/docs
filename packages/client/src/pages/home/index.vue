<template>
	<div @click="handleClick">{{ message }}</div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const message = ref('a/Home');

const handleClick = () => {
	router.push('/about/main');
};
</script>
