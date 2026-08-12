<template>
	<footer class="docs-footer">{{ t('client.common.poweredBy') }}</footer>
</template>
<script setup lang="ts">
import { useLocale } from '@deot/docs-locale';

const { t } = useLocale();
</script>
<style lang="scss">
@use '../../styles/bem' as *;

@include block(docs-footer) {
	display: grid;
	padding: 100px 48px 48px;
	font-family: "PingFang SC", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
	font-size: 14px;
	color: varfix(footer-foreground);
	text-align: center;
	background: varfix(footer-background);
	place-items: start center;
}
</style>
